import io
import logging

import httpx
import numpy as np
from PIL import Image

from app.config import CLIP_MODEL_NAME

logger = logging.getLogger(__name__)

_model = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        logger.info("Loading CLIP model '%s' …", CLIP_MODEL_NAME)
        _model = SentenceTransformer(CLIP_MODEL_NAME)
        logger.info("CLIP model loaded.")
    return _model


def compute_embedding(image: Image.Image) -> np.ndarray:
    model = _get_model()
    embedding = model.encode(image)
    return np.array(embedding, dtype=np.float32)


def embedding_to_bytes(embedding: np.ndarray) -> bytes:
    return embedding.tobytes()


def bytes_to_embedding(data: bytes) -> np.ndarray:
    return np.frombuffer(data, dtype=np.float32)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    dot = np.dot(a, b)
    norm = np.linalg.norm(a) * np.linalg.norm(b)
    if norm == 0:
        return 0.0
    return float(dot / norm)


async def download_image(url: str) -> Image.Image | None:
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return Image.open(io.BytesIO(resp.content)).convert("RGB")
    except Exception:
        logger.warning("Failed to download image: %s", url, exc_info=True)
        return None


def rank_by_similarity(
    reference_embedding: np.ndarray,
    candidate_images: list[Image.Image],
) -> list[tuple[int, float]]:
    """Return list of (index, similarity_score) sorted by descending similarity."""
    model = _get_model()
    if not candidate_images:
        return []
    candidate_embeddings = model.encode(candidate_images)
    scores = []
    for i, emb in enumerate(candidate_embeddings):
        score = cosine_similarity(reference_embedding, np.array(emb, dtype=np.float32))
        scores.append((i, score))
    scores.sort(key=lambda x: x[1], reverse=True)
    return scores
