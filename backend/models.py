import uuid
import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from backend.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    auth0_sub = Column(String, unique=True, nullable=False, index=True)
    email = Column(String)
    display_name = Column(String)
    avatar_url = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_login = Column(DateTime, default=datetime.datetime.utcnow)


class SavedPaper(Base):
    __tablename__ = "saved_papers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    paper_id = Column(String, nullable=False)
    title = Column(Text, nullable=False)
    authors_csv = Column(Text)
    abstract = Column(Text)
    pdf_url = Column(String)
    published = Column(String)
    citation_count = Column(Integer, default=0)
    difficulty_level = Column(String)
    eli5 = Column(Text)
    technical_summary = Column(Text)
    saved_at = Column(DateTime, default=datetime.datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "paper_id", name="uq_user_paper"),
        Index("idx_saved_papers_user", "user_id"),
    )


class UserNote(Base):
    __tablename__ = "user_notes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    paper_id = Column(String, nullable=True)  # NULL = general note
    paper_title = Column(Text)
    content = Column(Text, default="")
    color = Column(String, default="#FFF9C4")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    __table_args__ = (
        Index("idx_user_notes_user", "user_id"),
    )


class SearchHistory(Base):
    __tablename__ = "search_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    query = Column(Text, nullable=False)
    results_count = Column(Integer, default=0)
    searched_at = Column(DateTime, default=datetime.datetime.utcnow)

    __table_args__ = (
        Index("idx_search_history_user", "user_id", "searched_at"),
    )


class ReadingHistory(Base):
    __tablename__ = "reading_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    paper_id = Column(String, nullable=False)
    title = Column(Text)
    pdf_url = Column(String)
    difficulty_level = Column(String)
    first_visited = Column(DateTime, default=datetime.datetime.utcnow)
    last_visited = Column(DateTime, default=datetime.datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "paper_id", name="uq_user_reading"),
        Index("idx_reading_history_user", "user_id", "last_visited"),
    )
