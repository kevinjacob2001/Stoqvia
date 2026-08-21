from fastapi import APIRouter

from app.config import get_settings
from app.db import get_db, ping
from app.db.collections import COLLECTIONS
from app.models import HealthResponse

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    settings = get_settings()
    ping()
    db = get_db()
    present = [name for name in COLLECTIONS if name in db.list_collection_names()]
    return HealthResponse(
        status="ok",
        app=settings.app_name,
        env=settings.app_env,
        mongo="ok",
        database=settings.mongo_db,
        collections=present,
    )
