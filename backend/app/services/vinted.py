import logging
from dataclasses import dataclass

from app.config import VINTED_BASE_URL

logger = logging.getLogger(__name__)

ITEMS_PER_PAGE = 96
MAX_PAGES = 2


@dataclass
class VintedItem:
    item_id: str
    title: str
    price: float
    currency: str
    image_url: str
    item_url: str
    brand: str
    size: str


def _parse_price(price_field) -> tuple[float, str]:
    if isinstance(price_field, dict):
        amount = float(price_field.get("amount", 0) or 0)
        currency = price_field.get("currency_code", "EUR")
        return amount, currency
    return float(price_field or 0), "EUR"


def _build_search_text(brand: str, category: str | None = None) -> str:
    """Build a search query that includes brand + category for more targeted results."""
    parts = [brand]
    if category:
        parts.append(category)
    return " ".join(parts)


async def search_vinted(
    brand: str,
    description: str | None = None,
    category: str | None = None,
) -> list[VintedItem]:
    """Search Vinted by brand + category. Fetches multiple pages for a larger candidate pool."""
    search_text = _build_search_text(brand, category)
    all_results: list[VintedItem] = []

    try:
        from vinted import VintedClient

        async with VintedClient(persist_cookies=True, storage_format="json") as client:
            for page in range(1, MAX_PAGES + 1):
                search_url = f"{VINTED_BASE_URL}/catalog?search_text={search_text}"
                raw_items = await client.search_items(
                    url=search_url,
                    per_page=ITEMS_PER_PAGE,
                    page=page,
                    order="relevance",
                    raw_data=True,
                )

                if not raw_items:
                    break

                for item in raw_items:
                    photo_url = ""
                    photo = item.get("photo")
                    if isinstance(photo, dict) and photo.get("url"):
                        photo_url = photo["url"]
                    elif item.get("photos") and len(item["photos"]) > 0:
                        first_photo = item["photos"][0]
                        if isinstance(first_photo, dict):
                            photo_url = first_photo.get("url", "")

                    item_url_path = item.get("url") or item.get("path", "")
                    if item_url_path and not item_url_path.startswith("http"):
                        item_url_path = f"{VINTED_BASE_URL}{item_url_path}"

                    price, currency = _parse_price(item.get("price"))

                    all_results.append(
                        VintedItem(
                            item_id=str(item.get("id", "")),
                            title=item.get("title", ""),
                            price=price,
                            currency=currency,
                            image_url=photo_url,
                            item_url=item_url_path,
                            brand=item.get("brand_title", ""),
                            size=item.get("size_title", "") or "",
                        )
                    )

                if len(raw_items) < ITEMS_PER_PAGE:
                    break

        logger.info(
            "Vinted search for '%s' returned %d items across %d page(s)",
            search_text,
            len(all_results),
            min(MAX_PAGES, page),
        )
        return all_results

    except Exception:
        logger.error("Vinted search failed for '%s'", search_text, exc_info=True)
        return []
