from dataclasses import dataclass


@dataclass
class SearchItem:
    item_id: str
    title: str
    price: float
    currency: str
    image_url: str
    item_url: str
    brand: str
    size: str
