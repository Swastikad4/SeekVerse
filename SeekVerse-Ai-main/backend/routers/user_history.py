"""Routes for search history and reading history."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import User, SearchHistory, ReadingHistory
from backend.schemas import LogSearchRequest, LogHistoryRequest, SearchHistoryResponse, ReadingHistoryResponse
from backend.auth_middleware import get_current_user
import datetime

router = APIRouter(prefix="/user", tags=["history"])


# ── Search History ──
@router.get("/searches")
def list_searches(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    searches = db.query(SearchHistory).filter(
        SearchHistory.user_id == current_user.id
    ).order_by(SearchHistory.searched_at.desc()).limit(20).all()
    return [
        SearchHistoryResponse(
            query=s.query, results_count=s.results_count or 0, searched_at=s.searched_at
        ) for s in searches
    ]


@router.post("/searches")
def log_search(req: LogSearchRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    entry = SearchHistory(
        user_id=current_user.id,
        query=req.query,
        results_count=req.results_count,
        searched_at=datetime.datetime.utcnow()
    )
    db.add(entry)
    db.commit()
    return {"status": "logged"}


# ── Reading History ──
@router.get("/history")
def list_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    history = db.query(ReadingHistory).filter(
        ReadingHistory.user_id == current_user.id
    ).order_by(ReadingHistory.last_visited.desc()).limit(30).all()
    return [
        ReadingHistoryResponse(
            paper_id=h.paper_id, title=h.title or "", pdf_url=h.pdf_url or "",
            difficulty_level=h.difficulty_level or "",
            first_visited=h.first_visited, last_visited=h.last_visited
        ) for h in history
    ]


@router.post("/history")
def log_paper_view(req: LogHistoryRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    existing = db.query(ReadingHistory).filter(
        ReadingHistory.user_id == current_user.id,
        ReadingHistory.paper_id == req.paper_id
    ).first()
    if existing:
        existing.last_visited = datetime.datetime.utcnow()
        db.commit()
        return {"status": "updated"}
    entry = ReadingHistory(
        user_id=current_user.id,
        paper_id=req.paper_id,
        title=req.title,
        pdf_url=req.pdf_url,
        difficulty_level=req.difficulty_level,
        first_visited=datetime.datetime.utcnow(),
        last_visited=datetime.datetime.utcnow()
    )
    db.add(entry)
    db.commit()
    return {"status": "logged"}
