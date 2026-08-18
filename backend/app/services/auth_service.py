"""Store-admin login and signed session tokens."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Any, Dict, Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException, status
from pymongo.database import Database

from app.config import get_settings
from app.db import get_db
from app.models.auth import LoginResponse, MeResponse
from app.services.passwords import verify_password

_INVALID = "Invalid username or password"


def _b64encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64decode(text: str) -> bytes:
    padding = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(text + padding)


def create_token(user_id: str, store_id: str, username: str) -> str:
    settings = get_settings()
    payload = {
        "user_id": user_id,
        "store_id": store_id,
        "username": username,
        "exp": int(time.time()) + settings.auth_token_hours * 3600,
    }
    body = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    signature = hmac.new(
        settings.auth_secret.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()
    return f"{_b64encode(body)}.{signature}"


def decode_token(token: str) -> Dict[str, Any]:
    settings = get_settings()
    try:
        encoded_body, signature = token.split(".", 1)
        body = _b64decode(encoded_body)
        expected = hmac.new(
            settings.auth_secret.encode("utf-8"),
            body,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError("bad signature")
        payload = json.loads(body.decode("utf-8"))
        if int(payload["exp"]) < int(time.time()):
            raise ValueError("expired")
        return payload
    except (AttributeError, KeyError, TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


def _as_object_id(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


def _load_store(db: Database, store_id: ObjectId) -> Dict[str, Any]:
    store = db.stores.find_one({"_id": store_id})
    if store is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return store


def login(
    username: str,
    password: str,
    db: Optional[Database] = None,
) -> LoginResponse:
    database = db if db is not None else get_db()
    user = database.store_users.find_one({"username": username})
    if user is None or not verify_password(password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=_INVALID)

    store = _load_store(database, user["store_id"])
    token = create_token(str(user["_id"]), str(user["store_id"]), user["username"])
    return LoginResponse(
        token=token,
        store_id=str(store["_id"]),
        store_name=store["name"],
        username=user["username"],
    )


def get_me(token: str, db: Optional[Database] = None) -> MeResponse:
    database = db if db is not None else get_db()
    payload = decode_token(token)
    store = _load_store(database, _as_object_id(str(payload["store_id"])))
    user = database.store_users.find_one(
        {
            "_id": _as_object_id(str(payload["user_id"])),
            "store_id": store["_id"],
            "username": payload["username"],
        }
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return MeResponse(
        store_id=str(store["_id"]),
        store_name=store["name"],
        username=user["username"],
    )
