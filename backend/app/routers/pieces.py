import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from PIL import Image
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import UPLOADS_DIR
from app.database import get_db
from app.models import Piece, SearchResult
from app.schemas import PieceOut, PieceUpdate, PieceWithResults, SearchResultOut, SearchStatus
from app.services.clip_matcher import compute_embedding, embedding_to_bytes
from app.services.searcher import search_all_pieces, search_for_piece

router = APIRouter(prefix="/api/pieces", tags=["pieces"])


def _save_upload(file: UploadFile) -> tuple[str, Image.Image]:
    ext = Path(file.filename or "image.jpg").suffix or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    path = UPLOADS_DIR / filename
    contents = file.file.read()
    path.write_bytes(contents)
    img = Image.open(path).convert("RGB")
    return filename, img


@router.post("", response_model=PieceOut, status_code=201)
async def create_piece(
    brand: str = Form(...),
    category: str | None = Form(None),
    material: str | None = Form(None),
    description: str | None = Form(None),
    image: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
):
    filename, img = _save_upload(image)
    embedding = compute_embedding(img)

    piece = Piece(
        brand=brand,
        image_filename=filename,
        image_embedding=embedding_to_bytes(embedding),
        category=category,
        material=material,
        description=description,
    )
    db.add(piece)
    await db.commit()
    await db.refresh(piece)

    async def _initial_search(piece_id: str):
        from app.database import async_session

        async with async_session() as session:
            result = await session.execute(select(Piece).where(Piece.id == piece_id))
            p = result.scalar_one_or_none()
            if p:
                await search_for_piece(p, session)

    background_tasks.add_task(_initial_search, piece.id)

    return PieceOut(
        id=piece.id,
        brand=piece.brand,
        image_filename=piece.image_filename,
        category=piece.category,
        material=piece.material,
        description=piece.description,
        is_active=piece.is_active,
        created_at=piece.created_at,
        updated_at=piece.updated_at,
        result_count=0,
    )


@router.get("", response_model=list[PieceOut])
async def list_pieces(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(
            Piece,
            func.count(SearchResult.id).label("result_count"),
        )
        .outerjoin(SearchResult)
        .group_by(Piece.id)
        .order_by(Piece.created_at.desc())
    )
    rows = await db.execute(stmt)
    pieces = []
    for piece, count in rows.all():
        pieces.append(
            PieceOut(
                id=piece.id,
                brand=piece.brand,
                image_filename=piece.image_filename,
                category=piece.category,
                material=piece.material,
                description=piece.description,
                is_active=piece.is_active,
                created_at=piece.created_at,
                updated_at=piece.updated_at,
                result_count=count,
            )
        )
    return pieces


@router.get("/feed", response_model=list[PieceWithResults])
async def feed(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Piece)
        .where(Piece.is_active == True)
        .options(selectinload(Piece.results))
        .order_by(Piece.created_at.desc())
    )
    result = await db.execute(stmt)
    pieces = result.scalars().all()
    out = []
    for p in pieces:
        sorted_results = sorted(p.results, key=lambda r: r.similarity_score or 0, reverse=True)
        out.append(
            PieceWithResults(
                id=p.id,
                brand=p.brand,
                image_filename=p.image_filename,
                category=p.category,
                material=p.material,
                description=p.description,
                is_active=p.is_active,
                created_at=p.created_at,
                updated_at=p.updated_at,
                result_count=len(sorted_results),
                results=[SearchResultOut.model_validate(r) for r in sorted_results],
            )
        )
    return out


@router.get("/{piece_id}", response_model=PieceWithResults)
async def get_piece(piece_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Piece).where(Piece.id == piece_id).options(selectinload(Piece.results))
    result = await db.execute(stmt)
    piece = result.scalar_one_or_none()
    if not piece:
        raise HTTPException(status_code=404, detail="Piece not found")
    sorted_results = sorted(piece.results, key=lambda r: r.similarity_score or 0, reverse=True)
    return PieceWithResults(
        id=piece.id,
        brand=piece.brand,
        image_filename=piece.image_filename,
        category=piece.category,
        material=piece.material,
        description=piece.description,
        is_active=piece.is_active,
        created_at=piece.created_at,
        updated_at=piece.updated_at,
        result_count=len(sorted_results),
        results=[SearchResultOut.model_validate(r) for r in sorted_results],
    )


@router.put("/{piece_id}", response_model=PieceOut)
async def update_piece(piece_id: str, updates: PieceUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Piece).where(Piece.id == piece_id))
    piece = result.scalar_one_or_none()
    if not piece:
        raise HTTPException(status_code=404, detail="Piece not found")

    update_data = updates.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(piece, key, value)

    await db.commit()
    await db.refresh(piece)

    count_result = await db.execute(
        select(func.count(SearchResult.id)).where(SearchResult.piece_id == piece.id)
    )
    count = count_result.scalar() or 0

    return PieceOut(
        id=piece.id,
        brand=piece.brand,
        image_filename=piece.image_filename,
        category=piece.category,
        material=piece.material,
        description=piece.description,
        is_active=piece.is_active,
        created_at=piece.created_at,
        updated_at=piece.updated_at,
        result_count=count,
    )


@router.put("/{piece_id}/image", response_model=PieceOut)
async def update_piece_image(
    piece_id: str,
    image: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Piece).where(Piece.id == piece_id))
    piece = result.scalar_one_or_none()
    if not piece:
        raise HTTPException(status_code=404, detail="Piece not found")

    old_path = UPLOADS_DIR / piece.image_filename
    if old_path.exists():
        old_path.unlink()

    filename, img = _save_upload(image)
    embedding = compute_embedding(img)

    piece.image_filename = filename
    piece.image_embedding = embedding_to_bytes(embedding)

    await db.commit()
    await db.refresh(piece)

    count_result = await db.execute(
        select(func.count(SearchResult.id)).where(SearchResult.piece_id == piece.id)
    )
    count = count_result.scalar() or 0

    return PieceOut(
        id=piece.id,
        brand=piece.brand,
        image_filename=piece.image_filename,
        category=piece.category,
        material=piece.material,
        description=piece.description,
        is_active=piece.is_active,
        created_at=piece.created_at,
        updated_at=piece.updated_at,
        result_count=count,
    )


@router.delete("/{piece_id}", status_code=204)
async def delete_piece(piece_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Piece).where(Piece.id == piece_id))
    piece = result.scalar_one_or_none()
    if not piece:
        raise HTTPException(status_code=404, detail="Piece not found")

    image_path = UPLOADS_DIR / piece.image_filename
    if image_path.exists():
        image_path.unlink()

    await db.delete(piece)
    await db.commit()


@router.get("/{piece_id}/results", response_model=list[SearchResultOut])
async def get_results(piece_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Piece).where(Piece.id == piece_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Piece not found")

    stmt = (
        select(SearchResult)
        .where(SearchResult.piece_id == piece_id)
        .order_by(SearchResult.similarity_score.desc())
    )
    results = await db.execute(stmt)
    return [SearchResultOut.model_validate(r) for r in results.scalars().all()]


@router.post("/{piece_id}/search", response_model=SearchStatus)
async def trigger_search(piece_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Piece).where(Piece.id == piece_id))
    piece = result.scalar_one_or_none()
    if not piece:
        raise HTTPException(status_code=404, detail="Piece not found")

    count = await search_for_piece(piece, db)
    return SearchStatus(status="ok", message=f"Found {count} results for '{piece.brand}'")


search_router = APIRouter(tags=["search"])


@search_router.post("/api/search-all", response_model=SearchStatus)
async def trigger_search_all(background_tasks: BackgroundTasks):
    background_tasks.add_task(search_all_pieces)
    return SearchStatus(status="ok", message="Search started for all active pieces")


@search_router.post("/api/vinted-login", response_model=SearchStatus)
async def vinted_login():
    from app.services.vinted_browser import login_to_vinted

    success = await login_to_vinted()
    if success:
        return SearchStatus(status="ok", message="Logged in to Vinted successfully")
    raise HTTPException(status_code=408, detail="Login timed out or failed. Try again.")


@search_router.get("/api/vinted-login/status", response_model=SearchStatus)
async def vinted_login_status():
    from pathlib import Path

    chrome_profile = Path.home() / "Library" / "Application Support" / "Google" / "Chrome" / "Profile 1"
    if chrome_profile.exists():
        return SearchStatus(status="ok", message="Chrome profile available")
    return SearchStatus(status="missing", message="Chrome profile not found")
