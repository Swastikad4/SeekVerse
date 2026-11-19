from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import time
import requests
import asyncio
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

from backend.agents.supervisor import run_scholar_pipeline
from backend.tools.arxiv_tool import search_arxiv_papers, fetch_paper_from_url, search_semantic_scholar
from backend.ml.classifier import classify_difficulty
from langchain_groq import ChatGroq

# ── Database & Auth ──
from backend.database import engine, Base
from backend.routers.user_papers import router as saved_papers_router
from backend.routers.user_notes import router as notes_router
from backend.routers.user_history import router as history_router

app = FastAPI(title="SeekVerse AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create PostgreSQL tables on startup
@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

# Register user routers
app.include_router(saved_papers_router)
app.include_router(notes_router)
app.include_router(history_router)

groq_api_key = os.getenv("GROQ_API_KEY") or "gsk_placeholder"
model_name = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")
fast_model_name = os.getenv("GROQ_FAST_MODEL", "openai/gpt-oss-20b")
llm = ChatGroq(model=model_name, api_key=groq_api_key, max_tokens=300)
llm_fast = ChatGroq(model=fast_model_name, api_key=groq_api_key, max_tokens=150)

async def async_safe_llm(prompt, retries=5, use_fast=False):
    model = llm_fast if use_fast else llm
    for i in range(retries):
        try:
            res = await model.ainvoke(prompt)
            return res.content
        except Exception as e:
            if ("429" in str(e) or "rate" in str(e).lower()) and i < retries - 1:
                wait = 30 * (i + 1)
                print(f"Rate limited, waiting {wait}s... (attempt {i+1}/{retries})")
                await asyncio.sleep(wait)
            else:
                raise e

def safe_llm(prompt, retries=5):
    for i in range(retries):
        try:
            return llm.invoke(prompt).content
        except Exception as e:
            if ("429" in str(e) or "rate" in str(e).lower()) and i < retries - 1:
                wait = 30 * (i + 1)
                print(f"Rate limited, waiting {wait}s... (attempt {i+1}/{retries})")
                time.sleep(wait)
            else:
                raise e

class SearchRequest(BaseModel):
    query: str
    offset: int = 0

class ChatRequest(BaseModel):
    question: str
    paper_title: str
    paper_abstract: str

class CompareRequest(BaseModel):
    paper1_title: str
    paper1_abstract: str
    paper2_title: str
    paper2_abstract: str

class QuizRequest(BaseModel):
    paper_title: str
    paper_abstract: str

class RelatedRequest(BaseModel):
    paper_title: str
    paper_abstract: str

class ExplainRequest(BaseModel):
    paper_title: str
    paper_abstract: str
    level: str

class PaperURLRequest(BaseModel):
    url: str

@app.get("/")
def root():
    return {"status": "SeekVerse Ai Running"}

# In-memory query cache for instant responses on repeated searches
_SEARCH_CACHE = {}

@app.post("/search")
async def search_papers(request: SearchRequest):
    query_key = request.query.strip().lower()

    if request.offset == 0:
        # 1. Instant in-memory cache hit (< 10ms)
        if query_key in _SEARCH_CACHE:
            print(f"[search] In-memory cache hit for: '{request.query}'")
            return _SEARCH_CACHE[query_key]

        # 2. Run optimized scholar pipeline directly (parallel fetch, batched fast LLM, 0s sleep)
        try:
            result = await run_scholar_pipeline(request.query)
            if result and result.get("explained_papers"):
                response_data = {
                    "papers": result["explained_papers"],
                    "learning_path": result.get("learning_path") or {"steps": ""},
                    "research_gaps": result.get("research_gaps") or []
                }
                # Cache up to 50 queries in memory
                if len(_SEARCH_CACHE) > 50:
                    _SEARCH_CACHE.pop(next(iter(_SEARCH_CACHE)))
                _SEARCH_CACHE[query_key] = response_data
                return response_data
        except Exception as e:
            print(f"[search] Pipeline error: {e}")

        # Fallback if pipeline returned empty
        return {"papers": [], "learning_path": {"steps": ""}, "research_gaps": []}
    else:
        papers = search_arxiv_papers(request.query, max_results=5, offset=request.offset)
        if not papers:
            papers = search_semantic_scholar(request.query, max_results=5)
        for paper in papers:
            paper["difficulty"] = classify_difficulty(paper["abstract"], paper["citation_count"], paper["published"])
            paper["eli5"] = ""
            paper["technical_summary"] = ""
            paper["limitations"] = ""
        return {"papers": papers, "learning_path": None, "research_gaps": None}

@app.post("/chat")
async def chat_about_paper(request: ChatRequest):
    from backend.rag.paper_rag import retrieve_chat_context

    context = retrieve_chat_context(request.paper_title, request.question)
    if not context:
        context = request.paper_abstract

    response = safe_llm(f"""You are a research paper expert. Answer clearly and concisely.
Paper Title: {request.paper_title}
Context: {context}
Question: {request.question}
Answer in 2-3 sentences.""")
    return {"answer": response}

@app.post("/compare")
async def compare_papers(request: CompareRequest):
    response = safe_llm(f"""Compare these two research papers.
Paper 1: {request.paper1_title}
Abstract 1: {request.paper1_abstract[:300]}
Paper 2: {request.paper2_title}
Abstract 2: {request.paper2_abstract[:300]}
Format:
METHODOLOGY: [compare approaches]
CONTRIBUTIONS: [compare what each adds]
LIMITATIONS: [compare weaknesses]
VERDICT: [which is better for beginners, which for experts, and why]""")
    return {"comparison": response}

@app.post("/quiz")
async def generate_quiz(request: QuizRequest):
    response = safe_llm(f"""Generate 3 multiple choice questions to test understanding of this paper.
Title: {request.paper_title}
Abstract: {request.paper_abstract[:400]}
Format exactly:
Q: [question]
A) [option]
B) [option]
C) [option]
D) [option]
ANSWER: [correct letter]
EXPLANATION: [why correct]
---""")
    return {"quiz": response}

@app.post("/related")
async def related_papers(request: RelatedRequest):
    related = []
    
    smart_query = safe_llm(f"""Given this paper title, generate the best search query to find similar academic papers.
Title: "{request.paper_title}"
Abstract hint: "{request.paper_abstract[:200] if request.paper_abstract else ''}"
Rules:
- Extract the CORE topic/domain
- Use academic terms
- 3-5 words only
- Reply with ONLY the query""").strip().replace('"', '')

    print(f"Related query: {smart_query}")
    
    try:
        papers = search_semantic_scholar(smart_query, max_results=6)
        for p in papers:
            if p.get("title") != request.paper_title and p.get("abstract"):
                p["difficulty"] = classify_difficulty(p["abstract"], p["citation_count"], p["published"])
                related.append({
                    "title": p["title"],
                    "pdf_url": p["pdf_url"],
                    "difficulty": p["difficulty"],
                    "published": p["published"],
                    "abstract": p["abstract"]
                })
    except:
        pass
    
    if not related:
        try:
            papers = search_arxiv_papers(smart_query, max_results=5)
            for p in papers:
                if p.get("title") != request.paper_title and p.get("abstract"):
                    p["difficulty"] = classify_difficulty(p["abstract"], p["citation_count"], p["published"])
                    related.append({
                        "title": p["title"],
                        "pdf_url": p["pdf_url"],
                        "difficulty": p["difficulty"],
                        "published": p["published"],
                        "abstract": p["abstract"]
                    })
        except Exception as e:
            print(f"ArXiv fallback error: {e}")
    
    if related:
        titles_list = "\n".join([f"{i}. {p['title']}" for i, p in enumerate(related)])
        filter_resp = safe_llm(f"""Main paper topic: "{request.paper_title}"
        
Fetched papers:
{titles_list}

Remove papers that are CLEARLY unrelated to the main topic.
Reply with comma-separated INDEX numbers to REMOVE, or "none".
Be strict.""").strip()
        
        if filter_resp.lower() != "none":
            try:
                bad = [int(x.strip()) for x in filter_resp.split(",") if x.strip().isdigit()]
                related = [p for i, p in enumerate(related) if i not in bad]
            except:
                pass

    if len(related) < 2:
        try:
            from backend.tools.arxiv_tool import search_openalex
            papers = search_openalex(smart_query, max_results=6)
            for p in papers:
                if p.get("title") != request.paper_title and p.get("abstract"):
                    p["difficulty"] = classify_difficulty(p["abstract"], p["citation_count"], p["published"])
                    related.append({
                        "title": p["title"],
                        "pdf_url": p["pdf_url"],
                        "difficulty": p["difficulty"],
                        "published": p["published"],
                        "abstract": p["abstract"]
                    })
        except Exception as e:
            print(f"OpenAlex error: {e}")

    return {"related": related[:3]}

@app.post("/explain")
async def explain_for_level(request: ExplainRequest):
    prompts = {
        "child": "Explain this paper to a 10 year old using simple words and a fun analogy.",
        "student": "Explain this paper to an undergraduate student. Use some technical terms but keep it clear.",
        "expert": "Explain this paper to a PhD researcher. Be technically precise and highlight novel contributions."
    }
    prompt = prompts.get(request.level, prompts["student"])
    response = safe_llm(f"""{prompt}
Title: {request.paper_title}
Abstract: {request.paper_abstract[:400]}
Reply with only the explanation.""")
    return {"explanation": response}

@app.post("/analyze-url")
async def analyze_paper_url(request: PaperURLRequest):
    url = request.url.strip()

    if not url.startswith('http'):
        return {"error": "Please enter a valid URL starting with http or https."}

    paper = None

    if "arxiv.org" in url:
        paper = fetch_paper_from_url(url)

    if not paper:
        try:
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            resp = requests.get(url, headers=headers, timeout=15)

            if resp.status_code != 200:
                return {"error": f"Could not access URL (status {resp.status_code})."}

            content_type = resp.headers.get('content-type', '')
            text = ""

            if 'pdf' in content_type or url.endswith('.pdf'):
                try:
                    import pdfplumber
                    import tempfile
                    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
                        f.write(resp.content)
                        tmp_path = f.name
                    text = ""
                    with pdfplumber.open(tmp_path) as pdf:
                        for page in pdf.pages[:5]:
                            t = page.extract_text()
                            if t:
                                text += t + "\n"
                    os.unlink(tmp_path)
                except Exception as e:
                    return {"error": f"Could not read PDF: {str(e)}"}
            else:
                from html.parser import HTMLParser
                class TextExtractor(HTMLParser):
                    def __init__(self):
                        super().__init__()
                        self.text = []
                        self.skip = False
                    def handle_starttag(self, tag, attrs):
                        if tag in ['script', 'style', 'nav', 'footer']:
                            self.skip = True
                    def handle_endtag(self, tag):
                        if tag in ['script', 'style', 'nav', 'footer']:
                            self.skip = False
                    def handle_data(self, data):
                        if not self.skip and data.strip():
                            self.text.append(data.strip())
                parser = TextExtractor()
                parser.feed(resp.text)
                text = " ".join(parser.text)[:5000]

            if not text.strip():
                return {"error": "Could not extract text from this URL."}

            title_resp = safe_llm(f"Extract only the title of this research paper. Reply with just the title, nothing else.\n\n{text[:1000]}")
            abstract_resp = safe_llm(f"Extract or summarize the abstract of this research paper in 3-4 sentences.\n\n{text[:3000]}")

            paper = {
                "id": url,
                "title": title_resp.strip(),
                "authors": ["See paper"],
                "abstract": abstract_resp.strip(),
                "pdf_url": url,
                "published": "2024",
                "categories": [],
                "citation_count": 0
            }
        except Exception as e:
            return {"error": f"Could not analyze URL: {str(e)}"}

    if not paper:
        return {"error": "Could not fetch paper. Try a direct PDF or ArXiv link."}

    paper["difficulty"] = classify_difficulty(paper["abstract"], paper["citation_count"], paper["published"])
    paper["eli5"] = safe_llm(f"Explain in 3 simple sentences for a beginner. No labels.\nTitle: {paper['title']}\nAbstract: {paper['abstract'][:400]}").strip()
    paper["technical_summary"] = safe_llm(f"Summarize key technical contributions in 3 sentences. No labels.\nTitle: {paper['title']}\nAbstract: {paper['abstract'][:400]}").strip()
    paper["limitations"] = safe_llm(f"What are 2 limitations of this paper? No labels.\nTitle: {paper['title']}\nAbstract: {paper['abstract'][:400]}").strip()

    related_raw = search_semantic_scholar(paper["title"], max_results=6)
    related = []
    for p in related_raw:
        if p.get("title") != paper["title"] and p.get("abstract"):
            p["difficulty"] = classify_difficulty(p["abstract"], p["citation_count"], p["published"])
            p["eli5"] = safe_llm(f"Explain in 2 simple sentences for a beginner. No labels.\nTitle: {p['title']}\nAbstract: {p['abstract'][:300]}").strip()
            p["technical_summary"] = safe_llm(f"Summarize key technical contributions in 2 sentences. No labels.\nTitle: {p['title']}\nAbstract: {p['abstract'][:300]}").strip()
            p["limitations"] = ""
            related.append(p)

    if related:
        titles_list = "\n".join([f"{i}. {p['title']}" for i, p in enumerate(related)])
        filter_resp = safe_llm(f"""Main paper: "{paper['title']}"
Related papers:
{titles_list}
Which numbers are CLEARLY irrelevant? Reply comma-separated numbers or "none".""").strip()
        if filter_resp.lower() != "none":
            try:
                bad = [int(x.strip()) for x in filter_resp.split(",") if x.strip().isdigit()]
                related = [p for i, p in enumerate(related) if i not in bad]
            except:
                pass

    path_resp = safe_llm(f"""Create a 5-step learning path to understand this paper:
Title: {paper['title']}
Abstract: {paper['abstract'][:400]}
Format: Step 1: [what to study] - [why]""")

    return {
        "paper": paper,
        "related": related[:3],
        "learning_path": path_resp,
        "research_gaps": [safe_llm(f"List 3 specific research gaps or future directions for this paper in plain sentences. No markdown.\nTitle: {paper['title']}\nAbstract: {paper['abstract'][:400]}").strip()]
    }