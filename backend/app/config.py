from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

DATABASE_URL = f"sqlite+aiosqlite:///{BASE_DIR / 'db.sqlite3'}"

VINTED_BASE_URL = "https://www.vinted.fr"

CLIP_MODEL_NAME = "clip-ViT-B-32"

SEARCH_CANDIDATE_COUNT = 50
SEARCH_TOP_K = 10

SCHEDULE_HOURS = [9, 12, 15, 20]
