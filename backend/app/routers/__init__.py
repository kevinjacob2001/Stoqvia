from fastapi import APIRouter

from app.config import get_settings
from app.db import get_db, ping
from app.db.collections import COLLECTIONS
from app.models import CollectionInfo, HealthResponse

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


@router.get("/collections", response_model=list[CollectionInfo])
def list_collections() -> list[CollectionInfo]:
    db = get_db()
    result: list[CollectionInfo] = []
    for name in COLLECTIONS:
        if name not in db.list_collection_names():
            result.append(CollectionInfo(name=name, count=0, indexes=[]))
            continue
        coll = db[name]
        result.append(
            CollectionInfo(
                name=name,
                count=coll.count_documents({}),
                indexes=list(coll.index_information().keys()),
            )
        )
    return result
