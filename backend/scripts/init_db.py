"""Create MongoDB collections, validators, and indexes."""

from __future__ import annotations

import sys
from pathlib import Path

# Allow `python -m scripts.init_db` from backend/
_BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from pymongo import ASCENDING
from pymongo.errors import CollectionInvalid, OperationFailure

from app.config import get_settings
from app.db import close_client, get_db, ping
from app.db.collections import (
    COLLECTION_INDEXES,
    COLLECTION_VALIDATORS,
    COLLECTIONS,
    RETIRED_COLLECTIONS,
)


def ensure_collections(drop_existing: bool = False) -> None:
    db = get_db()
    existing = set(db.list_collection_names())

    if drop_existing:
        for name in RETIRED_COLLECTIONS:
            if name in existing:
                db.drop_collection(name)
                existing.discard(name)
                print(f"dropped  {name} (retired)")

    for name in COLLECTIONS:
        validator = COLLECTION_VALIDATORS[name]

        if drop_existing and name in existing:
            db.drop_collection(name)
            existing.discard(name)
            print(f"dropped  {name}")

        if name not in existing:
            try:
                db.create_collection(name, validator=validator)
                print(f"created  {name}")
            except CollectionInvalid:
                print(f"exists   {name}")
        else:
            try:
                db.command(
                    {
                        "collMod": name,
                        "validator": validator,
                        "validationLevel": "moderate",
                    }
                )
                print(f"updated  {name} validator")
            except OperationFailure as exc:
                print(f"warn     {name} validator: {exc.details}")

        _ensure_indexes(db, name)


def _ensure_indexes(db, name: str) -> None:
    coll = db[name]
    for keys, options in COLLECTION_INDEXES[name]:
        # Convert ("geo", "2dsphere") style keys
        index_keys = []
        for field, direction in keys:
            if direction == "2dsphere":
                index_keys.append((field, "2dsphere"))
            else:
                index_keys.append((field, ASCENDING if direction == 1 else direction))
        coll.create_index(index_keys, **options)
    print(f"indexes  {name}: {coll.index_information().keys()}")


def main() -> None:
    settings = get_settings()
    drop = "--reset" in sys.argv
    print(f"Mongo URI : {settings.mongo_uri}")
    print(f"Database  : {settings.mongo_db}")
    print(f"Reset     : {drop}")
    ping()
    print("ping     ok")
    ensure_collections(drop_existing=drop)
    db = get_db()
    print("---")
    for name in COLLECTIONS:
        print(f"{name}: {db[name].count_documents({})} docs")
    close_client()


if __name__ == "__main__":
    main()
