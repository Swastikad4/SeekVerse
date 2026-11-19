import asyncio
from backend.rag.paper_rag import ingest_papers, generate_explanations_parallel

async def explain_papers(state: dict) -> dict:
    papers = state.get("classified_papers", [])
    if papers:
        # Ingest into vectorstore in background so search response is not blocked by PyTorch/Chroma
        asyncio.create_task(asyncio.to_thread(ingest_papers, papers))
        papers = await generate_explanations_parallel(papers)
    return {"explained_papers": papers}