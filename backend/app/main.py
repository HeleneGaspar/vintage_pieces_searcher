import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import SCHEDULE_HOURS, UPLOADS_DIR
from app.database import engine
from app.models import Base
from app.routers.pieces import router as pieces_router
from app.routers.pieces import search_router
from app.services.searcher import search_all_pieces

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created.")

    for hour in SCHEDULE_HOURS:
        scheduler.add_job(
            search_all_pieces,
            CronTrigger(hour=hour, minute=0),
            id=f"search_all_{hour}",
            replace_existing=True,
        )
    scheduler.start()
    logger.info("Scheduler started with jobs at hours: %s", SCHEDULE_HOURS)

    yield

    scheduler.shutdown(wait=False)
    await engine.dispose()


app = FastAPI(title="Vintage Piece Searcher", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

app.include_router(pieces_router)
app.include_router(search_router)
