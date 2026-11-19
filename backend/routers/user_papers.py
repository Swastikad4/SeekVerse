"""CRUD routes for user saved papers."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import User, SavedPaper
from backend.schemas import SavePaperRequest, SavedPaperResponse
from backend.auth_middleware import get_current_user
import datetime

router = APIRouter(prefix="/user/saved-papers", tags=["saved-papers"])


@router.get("")
def list_saved(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    papers = db.query(SavedPaper).filter(
        SavedPaper.user_id == current_user.id
    ).order_by(SavedPaper.saved_at.desc()).all()
    return [
        SavedPaperResponse(
            id=str(p.id), paper_id=p.paper_id, title=p.title,
            authors_csv=p.authors_csv or "", abstract=p.abstract or "",
            pdf_url=p.pdf_url or "", published=p.published or "",
            citation_count=p.citation_count or 0,
            difficulty_level=p.difficulty_level or "",
            eli5=p.eli5 or "", technical_summary=p.technical_summary or "",
            saved_at=p.saved_at
        ) for p in papers
    ]


@router.post("")
def save_paper(req: SavePaperRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    existing = db.query(SavedPaper).filter(
        SavedPaper.user_id == current_user.id,
        SavedPaper.paper_id == req.paper_id
    ).first()
    if existing:
        return {"status": "already_saved", "id": str(existing.id)}

    paper = SavedPaper(
        user_id=current_user.id,
        paper_id=req.paper_id,
        title=req.title,
        authors_csv=", ".join(req.authors) if req.authors else "",
        abstract=req.abstract,
        pdf_url=req.pdf_url,
        published=req.published,
        citation_count=req.citation_count,
        difficulty_level=req.difficulty_level,
        eli5=req.eli5,
        technical_summary=req.technical_summary,
        saved_at=datetime.datetime.utcnow()
    )
    db.add(paper)
    db.commit()
    return {"status": "saved", "id": str(paper.id)}


@router.delete("/{paper_id}")
def unsave_paper(paper_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    paper = db.query(SavedPaper).filter(
        SavedPaper.user_id == current_user.id,
        SavedPaper.paper_id == paper_id
    ).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found in saved list")
    db.delete(paper)
    db.commit()
    return {"status": "removed"}
