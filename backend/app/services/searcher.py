import asyncio
import logging

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import SEARCH_TOP_K, UPLOADS_DIR
from app.database import async_session
from app.models import Piece, SearchResult
from app.services.vinted_browser import search_vinted_by_image

logger = logging.getLogger(__name__)


async def search_for_piece(piece: Piece, db: AsyncSession) -> int:
    """Run a full search cycle for a single piece using Vinted's image search."""
    image_path = str(UPLOADS_DIR / piece.image_filename)

    vinted_items = await search_vinted_by_image(
        image_path=image_path,
        brand=piece.brand,
        category=piece.category,
    )

    if not vinted_items:
        logger.info("No Vinted results for piece %s (%s)", piece.id, piece.brand)
        return 0

    # Clear old results
    await db.execute(delete(SearchResult).where(SearchResult.piece_id == piece.id))

    count = 0
    for item in vinted_items[:SEARCH_TOP_K]:
        result = SearchResult(
            piece_id=piece.id,
            vinted_item_id=item.item_id,
            title=item.title,
            price=item.price,
            currency=item.currency,
            image_url=item.image_url,
            item_url=item.item_url,
            similarity_score=None,
            brand=item.brand,
            size=item.size,
        )
        db.add(result)
        count += 1

    await db.commit()
    logger.info("Stored %d results for piece %s (%s)", count, piece.id, piece.brand)
    return count


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
