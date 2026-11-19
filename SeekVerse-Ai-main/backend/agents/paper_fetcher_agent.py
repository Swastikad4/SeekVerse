from backend.tools.arxiv_tool import search_arxiv_papers, search_semantic_scholar, search_openalex
from langchain_groq import ChatGroq
from dotenv import load_dotenv
import asyncio
import os

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

async def _safe_ainvoke(llm, prompt, retries=5):
    for i in range(retries):
        try:
            return await llm.ainvoke(prompt)
        except Exception as e:
            if ("429" in str(e) or "rate" in str(e).lower()) and i < retries - 1:
                wait = 30 * (i + 1)
                print(f"[fetcher] Rate limited, waiting {wait}s... (attempt {i+1}/{retries})")
                await asyncio.sleep(wait)
            else:
                raise e

async def fetch_papers(state: dict) -> dict:
    query = state["query"]
    model_name = os.getenv("GROQ_FAST_MODEL", "openai/gpt-oss-20b")
    llm = ChatGroq(model=model_name, api_key=os.getenv("GROQ_API_KEY"), max_tokens=250)
    
    # Fetch all 3 academic sources in parallel
    openalex_task = asyncio.to_thread(search_openalex, query, 6)
    semantic_task = asyncio.to_thread(search_semantic_scholar, query, 5)
    arxiv_task = asyncio.to_thread(search_arxiv_papers, query, 3)
    
    results = await asyncio.gather(openalex_task, semantic_task, arxiv_task, return_exceptions=True)
    
    openalex_papers = results[0] if isinstance(results[0], list) else []
    semantic_papers = results[1] if isinstance(results[1], list) else []
    arxiv_papers = results[2] if isinstance(results[2], list) else []
    
    combined = []
    seen_titles = set()
    
    for p in openalex_papers + semantic_papers + arxiv_papers:
        title_key = p.get("title", "").lower()[:50]
        if title_key and title_key not in seen_titles and p.get("abstract"):
            seen_titles.add(title_key)
            combined.append(p)
    
    if not combined:
        return {"papers": []}
    
    # Strict relevance filter
    titles = "\n".join([f"{i}. {p['title']}" for i, p in enumerate(combined[:8])])
    try:
        resp = await _safe_ainvoke(llm, f"""Query: "{query}"

Rate each paper's relevance to the query from 1-10.
Papers:
{titles}

Reply ONLY in this format, one per line:
0: 7
1: 3
2: 9
(index: score)""")
        scores_resp = resp.content.strip()
        
        scored = []
        for line in scores_resp.split("\n"):
            try:
                idx, score = line.split(":")
                idx, score = int(idx.strip()), int(score.strip())
                if score >= 5 and idx < len(combined):
                    combined[idx]["relevance_score"] = score
                    scored.append(combined[idx])
            except:
                continue
        
        if len(scored) >= 2:
            combined = sorted(scored, key=lambda x: x.get("relevance_score", 0), reverse=True)
    except Exception as e:
        print(f"[fetcher] Fast relevance scoring fallback: {e}")
    
    print(f"Papers after scoring: {len(combined)}")
    return {"papers": combined[:6]}
