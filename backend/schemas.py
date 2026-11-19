from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ── Saved Papers ──
class SavePaperRequest(BaseModel):
    paper_id: str
    title: str
    authors: Optional[List[str]] = []
    abstract: Optional[str] = ""
    pdf_url: Optional[str] = ""
    published: Optional[str] = ""
    citation_count: Optional[int] = 0
    difficulty_level: Optional[str] = ""
    eli5: Optional[str] = ""
    technical_summary: Optional[str] = ""


class SavedPaperResponse(BaseModel):
    id: str
    paper_id: str
    title: str
    authors_csv: Optional[str] = ""
    abstract: Optional[str] = ""
    pdf_url: Optional[str] = ""
    published: Optional[str] = ""
    citation_count: int = 0
    difficulty_level: Optional[str] = ""
    eli5: Optional[str] = ""
    technical_summary: Optional[str] = ""
    saved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Notes ──
class NoteCreateRequest(BaseModel):
    paper_id: Optional[str] = None
    paper_title: Optional[str] = None
    content: Optional[str] = ""
    color: Optional[str] = "#FFF9C4"


class NoteUpdateRequest(BaseModel):
    content: Optional[str] = None
    color: Optional[str] = None


class NoteResponse(BaseModel):
    id: str
    paper_id: Optional[str] = None
    paper_title: Optional[str] = None
    content: str
    color: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Search History ──
class LogSearchRequest(BaseModel):
    query: str
    results_count: Optional[int] = 0


class SearchHistoryResponse(BaseModel):
    query: str
    results_count: int
    searched_at: Optional[datetime] = None


# ── Reading History ──
class LogHistoryRequest(BaseModel):
    paper_id: str
    title: Optional[str] = ""
    pdf_url: Optional[str] = ""
    difficulty_level: Optional[str] = ""


class ReadingHistoryResponse(BaseModel):
    paper_id: str
    title: Optional[str] = ""
    pdf_url: Optional[str] = ""
    difficulty_level: Optional[str] = ""
    first_visited: Optional[datetime] = None
    last_visited: Optional[datetime] = None
