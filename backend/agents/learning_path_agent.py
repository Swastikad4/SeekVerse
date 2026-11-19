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
                print(f"[path_gen] Rate limited, waiting {wait}s... (attempt {i+1}/{retries})")
                await asyncio.sleep(wait)
            else:
                raise e

async def generate_path(state: dict) -> dict:
    papers = state.get("explained_papers", [])
    query = state.get("query", "")
    
    if not papers:
        return {"learning_path": {"steps": ""}, "research_gaps": []}
    
    model_name = os.getenv("GROQ_FAST_MODEL", "openai/gpt-oss-20b")
    llm = ChatGroq(model=model_name, api_key=os.getenv("GROQ_API_KEY"), max_tokens=600)
    
    titles = [f"{i+1}. {p['title']} ({p.get('difficulty', {}).get('level', 'intermediate')})" 
              for i, p in enumerate(papers)]
    abstracts = " ".join([(p.get("abstract") or "")[:200] for p in papers[:3]])

    prompt = f"""Topic: {query}
Papers:
{chr(10).join(titles)}
Context: {abstracts[:600]}

Provide TWO sections:
[LEARNING_PATH]
Step 1: [paper title] - [reason]
Step 2: [paper title] - [reason]
(1 line per step)

[RESEARCH_GAPS]
Gap: [specific unexplored area 1]
Gap: [specific unexplored area 2]
Gap: [specific unexplored area 3]"""

    try:
        resp = await _safe_ainvoke(llm, prompt)
        content = resp.content.strip()
        
        learning_path = ""
        gaps = []
        
        if "[RESEARCH_GAPS]" in content:
            parts = content.split("[RESEARCH_GAPS]")
            learning_path = parts[0].replace("[LEARNING_PATH]", "").strip()
            gaps = [line.replace("Gap:", "").strip() for line in parts[1].split("\n") if "Gap:" in line]
        else:
            learning_path = content
            gaps = [f"Exploring scalability in {query}", f"Benchmarking efficiency in {query}"]
            
        return {
            "learning_path": {"steps": learning_path},
            "research_gaps": gaps
        }
    except Exception as e:
        print(f"[path_gen] Fast combined generator fallback: {e}")
        steps = "\n".join([f"Step {i+1}: {p['title']} - Core foundational concepts" for i, p in enumerate(papers[:4])])
        return {
            "learning_path": {"steps": steps},
            "research_gaps": [f"Scalability in {query}", f"Real-world deployment of {query}"]
        }
