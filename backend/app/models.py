import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, LargeBinary, String, Text
from sqlalchemy.orm import DeclarativeBase, relationship


def _utcnow():
    return datetime.now(timezone.utc)


def _new_id():
    return uuid.uuid4().hex


class Base(DeclarativeBase):
    pass


class Piece(Base):
    __tablename__ = "pieces"

    id = Column(String(32), primary_key=True, default=_new_id)
    brand = Column(String(255), nullable=False)
    image_filename = Column(String(255), nullable=False)
    image_embedding = Column(LargeBinary, nullable=True)
    category = Column(String(255), nullable=True)
    material = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    results = relationship("SearchResult", back_populates="piece", cascade="all, delete-orphan")


class SearchResult(Base):
    __tablename__ = "search_results"

    id = Column(String(32), primary_key=True, default=_new_id)
    piece_id = Column(String(32), ForeignKey("pieces.id", ondelete="CASCADE"), nullable=False)
    source = Column(String(32), default="vinted", nullable=False)
    vinted_item_id = Column(String(64), nullable=False)
    title = Column(String(512), nullable=True)
    price = Column(Float, nullable=True)
    currency = Column(String(10), nullable=True)
    image_url = Column(Text, nullable=True)
    item_url = Column(Text, nullable=False)
    similarity_score = Column(Float, nullable=True)
    brand = Column(String(255), nullable=True)
    size = Column(String(64), nullable=True)
    is_favorited = Column(Boolean, default=False, nullable=False)
    is_seen = Column(Boolean, default=True, nullable=False)
    fetched_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    piece = relationship("Piece", back_populates="results")
