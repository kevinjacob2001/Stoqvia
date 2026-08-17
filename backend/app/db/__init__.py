from typing import Any, Optional

from pymongo import MongoClient
from pymongo.database import Database

from app.config import get_settings

_client: Optional[MongoClient] = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        settings = get_settings()
        _client = MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=5000)
    return _client


def get_db() -> Database:
    settings = get_settings()
    return get_client()[settings.mongo_db]


def ping() -> dict:
    return get_client().admin.command("ping")


def close_client() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None
