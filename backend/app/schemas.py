from datetime import datetime

from pydantic import BaseModel


class PieceCreate(BaseModel):
    brand: str
    category: str | None = None
    material: str | None = None
    description: str | None = None


class PieceUpdate(BaseModel):
    brand: str | None = None
    category: str | None = None
    material: str | None = None
    description: str | None = None
    is_active: bool | None = None


class PieceOut(BaseModel):
    id: str
    brand: str
    image_filename: str
    category: str | None
    material: str | None
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    result_count: int = 0
    unseen_count: int = 0

    model_config = {"from_attributes": True}


class SearchResultOut(BaseModel):
    id: str
    piece_id: str
    vinted_item_id: str
    title: str | None
    price: float | None
    currency: str | None
    image_url: str | None
    item_url: str
    similarity_score: float | None
    brand: str | None
    size: str | None
    is_favorited: bool
    is_seen: bool
    fetched_at: datetime

    model_config = {"from_attributes": True}


class PieceWithResults(PieceOut):
    results: list[SearchResultOut] = []


class SearchStatus(BaseModel):
    status: str
    message: str


class NotificationGroup(BaseModel):
    piece_id: str
    brand: str
    image_filename: str
    unseen_count: int


class NotificationsOut(BaseModel):
    total_unseen: int
    groups: list[NotificationGroup]
