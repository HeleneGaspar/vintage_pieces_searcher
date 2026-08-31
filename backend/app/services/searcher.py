import logging

from sqlalchemy import and_, delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import SEARCH_TOP_K, UPLOADS_DIR
from app.database import async_session
from app.models import Piece, SearchResult
from app.services.search_item import SearchItem
from app.services.vinted_browser import VintedSessionExpired, search_vinted_by_image

logger = logging.getLogger(__name__)


async def _merge_results(
    piece: Piece,
    db: AsyncSession,
    items: list[SearchItem],
) -> int:
    """Merge Vinted search results into the DB.

    Preserves favorites, detects new items.
    """
    if not items:
        return 0

    top_items = items[:SEARCH_TOP_K]
    new_item_ids = {it.item_id for it in top_items}

    old_results = await db.execute(
        select(SearchResult).where(SearchResult.piece_id == piece.id)
    )
    existing: dict[str, SearchResult] = {}
    for r in old_results.scalars().all():
        existing[r.vinted_item_id] = r

    to_delete = [
        r.id for vid, r in existing.items()
        if vid not in new_item_ids and not r.is_favorited
    ]
    if to_delete:
        await db.execute(
            delete(SearchResult).where(SearchResult.id.in_(to_delete))
        )

    count = 0
    for item in top_items:
        prev = existing.get(item.item_id)
        if prev:
            prev.title = item.title
            prev.price = item.price
            prev.currency = item.currency
            prev.image_url = item.image_url
            prev.item_url = item.item_url
            prev.brand = item.brand
            prev.size = item.size
        else:
            result = SearchResult(
                piece_id=piece.id,
                vinted_item_id=item.item_id,
                title=item.title,
                price=item.price,
                currency=item.currency,
                image_url=item.image_url,
                item_url=item.item_url,
                brand=item.brand,
                size=item.size,
                is_favorited=False,
                is_seen=False,
            )
            db.add(result)
        count += 1

    return count


async def search_for_piece(piece: Piece, db: AsyncSession) -> int:
    """Run a Vinted search for a single piece."""
    image_path = str(UPLOADS_DIR / piece.image_filename)

    try:
        vinted_raw = await search_vinted_by_image(
            image_path=image_path,
            brand=piece.brand,
            category=piece.category,
        )
    except VintedSessionExpired:
        raise
    except Exception as exc:
        logger.error("Vinted search failed for %s: %s", piece.id, exc)
        vinted_raw = []

    vinted_items: list[SearchItem] = [
        SearchItem(
            item_id=it.item_id,
            title=it.title,
            price=it.price,
            currency=it.currency,
            image_url=it.image_url,
            item_url=it.item_url,
            brand=it.brand,
            size=it.size,
        )
        for it in vinted_raw
    ]

    total = await _merge_results(piece, db, vinted_items)
    await db.commit()

    logger.info(
        "Found %d results for piece %s (%s)",
        total, piece.id, piece.brand,
    )
    return total


async def search_all_pieces() -> dict:
    """Search for all active pieces. Called by the scheduler and resync endpoint."""
    async with async_session() as db:
        stmt = select(Piece).where(Piece.is_active == True)
        result = await db.execute(stmt)
        pieces = result.scalars().all()

        logger.info("Starting search for %d active pieces", len(pieces))
        total = 0
        for piece in pieces:
            try:
                count = await search_for_piece(piece, db)
                total += count
            except Exception:
                logger.error("Search failed for piece %s", piece.id, exc_info=True)

        return {"pieces_searched": len(pieces), "total_results": total}
