"""CRUD routes for user notes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import User, UserNote
from backend.schemas import NoteCreateRequest, NoteUpdateRequest, NoteResponse
from backend.auth_middleware import get_current_user
import datetime

router = APIRouter(prefix="/user/notes", tags=["notes"])


@router.get("")
def list_notes(paper_id: str = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(UserNote).filter(UserNote.user_id == current_user.id)
    if paper_id:
        q = q.filter(UserNote.paper_id == paper_id)
    notes = q.order_by(UserNote.updated_at.desc()).all()
    return [
        NoteResponse(
            id=str(n.id), paper_id=n.paper_id, paper_title=n.paper_title,
            content=n.content or "", color=n.color or "#FFF9C4",
            created_at=n.created_at, updated_at=n.updated_at
        ) for n in notes
    ]


@router.post("")
def create_note(req: NoteCreateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    note = UserNote(
        user_id=current_user.id,
        paper_id=req.paper_id,
        paper_title=req.paper_title,
        content=req.content,
        color=req.color
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return NoteResponse(
        id=str(note.id), paper_id=note.paper_id, paper_title=note.paper_title,
        content=note.content, color=note.color,
        created_at=note.created_at, updated_at=note.updated_at
    )


@router.put("/{note_id}")
def update_note(note_id: str, req: NoteUpdateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    note = db.query(UserNote).filter(
        UserNote.id == note_id, UserNote.user_id == current_user.id
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if req.content is not None:
        note.content = req.content
    if req.color is not None:
        note.color = req.color
    note.updated_at = datetime.datetime.utcnow()
    db.commit()
    return {"status": "updated"}


@router.delete("/{note_id}")
def delete_note(note_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    note = db.query(UserNote).filter(
        UserNote.id == note_id, UserNote.user_id == current_user.id
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(note)
    db.commit()
    return {"status": "deleted"}
