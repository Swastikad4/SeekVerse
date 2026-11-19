from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_groq import ChatGroq
from dotenv import load_dotenv
import asyncio
import os

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

_embeddings = None
def get_embeddings():
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    return _embeddings

def get_vectorstore():
    return Chroma(
        collection_name="research_papers",
        embedding_function=get_embeddings(),
        persist_directory="./chroma_db"
    )

def ingest_papers(papers: list):
    if not papers:
        return None
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)
    documents = []
    for paper in papers:
        if not paper.get("abstract"):
            continue
        chunks = splitter.split_text(paper["abstract"])
        for chunk in chunks:
            documents.append(Document(
                page_content=chunk,
                metadata={"paper_id": paper["id"], "title": paper["title"], "pdf_url": paper["pdf_url"]}
            ))
    if not documents:
        return None
    vectorstore = get_vectorstore()
    vectorstore.add_documents(documents)
    return vectorstore

async def ensure_abstract(paper: dict, llm) -> dict:
    if not paper.get("abstract") or len(paper["abstract"]) < 50:
        loop = asyncio.get_event_loop()
        def _infer():
            return llm.invoke(f"""Based on this research paper title, write a 3-4 sentence abstract describing what this paper is likely about.
Title: {paper['title']}
Write only the abstract, nothing else.""").content
        paper["abstract"] = await loop.run_in_executor(None, _infer)
    return paper

async def safe_ainvoke(llm, prompt, retries=5):
    for i in range(retries):
        try:
            return await llm.ainvoke(prompt)
        except Exception as e:
            if ("429" in str(e) or "rate" in str(e).lower()) and i < retries - 1:
                wait = 20 * (i + 1)
                print(f"[explainer] Rate limited, waiting {wait}s... (attempt {i+1}/{retries})")
                await asyncio.sleep(wait)
            else:
                raise e

async def explain_single(paper: dict, llm) -> dict:
    """Explain a single paper with ONE combined LLM call instead of three."""
    abstract_snippet = paper['abstract'][:300]

    combined_resp = await safe_ainvoke(llm,
        f"""Analyze this research paper and respond in EXACTLY this format with three sections:

ELI5: (2 simple sentences explaining the paper for a beginner, no jargon)
TECHNICAL: (2 sentences on key technical contributions)
LIMITATIONS: (2 sentences on limitations)

Title: {paper['title']}
Abstract: {abstract_snippet}""")

    text = combined_resp.content.strip()

    # Parse the three sections
    eli5 = ""
    technical = ""
    limitations = ""

    sections = {"ELI5": "", "TECHNICAL": "", "LIMITATIONS": ""}
    current_key = None
    for line in text.split("\n"):
        line_stripped = line.strip()
        matched = False
        for key in sections:
            if line_stripped.upper().startswith(key + ":"):
                current_key = key
                sections[key] = line_stripped[len(key)+1:].strip()
                matched = True
                break
        if not matched and current_key:
            sections[current_key] += " " + line_stripped

    eli5 = sections["ELI5"].strip() or text[:200]
    technical = sections["TECHNICAL"].strip() or text[200:400] if len(text) > 200 else ""
    limitations = sections["LIMITATIONS"].strip() or "Limitations not available."

    return {
        "eli5": eli5,
        "technical_summary": technical,
        "limitations": limitations,
        "keywords": ""
    }

async def generate_explanations_parallel(papers: list) -> list:
    if not papers:
        return []

    model_name = os.getenv("GROQ_FAST_MODEL", "openai/gpt-oss-20b")
    llm = ChatGroq(model=model_name, api_key=os.getenv("GROQ_API_KEY"), max_tokens=1200)

    # Format all papers in a single batched prompt for ultra-fast generation (0s sleep)
    lines = ["Analyze each research paper and respond strictly in this format for each:\n[PAPER 1]\nELI5: (2 simple sentences, no jargon)\nTECHNICAL: (2 sentences on technical contribution)\nLIMITATIONS: (1-2 sentences on limitations)\n"]
    for i, p in enumerate(papers, 1):
        abstract = (p.get("abstract") or p.get("title", ""))[:350]
        lines.append(f"Paper {i}: {p.get('title', '')}\nAbstract: {abstract}\n")

    prompt = "\n".join(lines)
    try:
        resp = await safe_ainvoke(llm, prompt)
        text = resp.content.strip()

        import re
        sections = re.split(r'\[PAPER\s*(\d+)\]', text, flags=re.IGNORECASE)
        parsed = {}
        for idx in range(1, len(sections), 2):
            try:
                p_num = int(sections[idx])
                p_text = sections[idx+1]
                eli5, technical, limitations = "", "", ""
                for l in p_text.split("\n"):
                    l_s = l.strip()
                    if l_s.upper().startswith("ELI5:"):
                        eli5 = l_s[5:].strip()
                    elif l_s.upper().startswith("TECHNICAL:"):
                        technical = l_s[10:].strip()
                    elif l_s.upper().startswith("LIMITATIONS:"):
                        limitations = l_s[12:].strip()
                parsed[p_num] = {
                    "eli5": eli5 or p_text[:180].strip(),
                    "technical_summary": technical or "Key contributions detailed in the paper.",
                    "limitations": limitations or "Limitations analysis not noted.",
                    "keywords": ""
                }
            except Exception:
                continue

        for i, paper in enumerate(papers, 1):
            if i in parsed and parsed[i]["eli5"]:
                paper.update(parsed[i])
            else:
                paper.setdefault("eli5", (paper.get("abstract") or "")[:180])
                paper.setdefault("technical_summary", "Technical details presented in the full publication.")
                paper.setdefault("limitations", "Limitations detailed in the publication.")
                paper.setdefault("keywords", "")
    except Exception as e:
        print(f"[explainer] Fast batch explainer fallback: {e}")
        for paper in papers:
            paper.setdefault("eli5", (paper.get("abstract") or "")[:180])
            paper.setdefault("technical_summary", "Technical details presented in the full publication.")
            paper.setdefault("limitations", "Limitations detailed in the publication.")
            paper.setdefault("keywords", "")

    return papers

def retrieve_papers_from_chromadb(query: str, threshold: int = 3) -> list:
    try:
        vectorstore = get_vectorstore()
        docs = vectorstore.similarity_search(query, k=10)

        if len(docs) < threshold:
            return []

        seen = set()
        papers = []
        for doc in docs:
            pid = doc.metadata.get("paper_id")
            if pid and pid not in seen:
                seen.add(pid)
                papers.append({
                    "id": pid,
                    "title": doc.metadata.get("title", ""),
                    "pdf_url": doc.metadata.get("pdf_url", ""),
                    "abstract": doc.page_content,
                    "citation_count": 0,
                    "published": "",
                    "source": "chromadb"
                })
        return papers
    except:
        return []

def retrieve_chat_context(paper_title: str, question: str) -> str:
    try:
        vectorstore = get_vectorstore()
        query = f"{paper_title} {question}"
        docs = vectorstore.similarity_search(query, k=3)
        matching = [d.page_content for d in docs if d.metadata.get("title", "").strip().lower() == paper_title.strip().lower()]
        if matching:
            return "\n\n".join(matching)
        if docs:
            return "\n\n".join([d.page_content for d in docs[:2]])
        return ""
    except Exception:
        return ""
