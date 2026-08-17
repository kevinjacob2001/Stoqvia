"""Load seed JSON into MongoDB.

Usage (from repo root):
    PYTHONPATH=. python -m data.seed.seed_all
"""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

_BACKEND = _REPO_ROOT / "backend"
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from bson import ObjectId
from bson.decimal128 import Decimal128

from app.config import get_settings
from app.db import close_client, get_db, ping
from app.db.collections import COLLECTIONS
from data.seed.build_sales import build_sales_jsonl
from data.seed.loader import convert_many, load_json_array, load_jsonl
from data.seed.validation import validate_dataset

LOAD_ORDER = (
    ("products", "products.json", False),
    ("stores", "stores.json", False),
    ("suppliers", "suppliers.json", False),
    ("supplier_products", "supplier_products.json", False),
    ("inventory", "inventory.json", False),
    ("sales_daily", "sales_daily.jsonl", True),
    ("purchase_orders", "purchase_orders.json", False),
    ("stock_transfers", "stock_transfers.json", False),
)


def _jsonable(value: Any) -> Any:
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, Decimal128):
        return str(value.to_decimal())
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_jsonable(v) for v in value]
    return value


def _insert(db, name: str, docs: List[dict]) -> int:
    if not docs:
        return 0
    total = 0
    chunk = 5000
    coll = db[name]
    for i in range(0, len(docs), chunk):
        result = coll.insert_many(docs[i : i + chunk], ordered=False)
        total += len(result.inserted_ids)
    return total


def clear_collections(db) -> None:
    for name in COLLECTIONS:
        db[name].delete_many({})
        print(f"cleared  {name}")


def seed(reset: bool = True) -> Dict[str, int]:
    settings = get_settings()
    print(f"Mongo URI : {settings.mongo_uri}")
    print(f"Database  : {settings.mongo_db}")
    ping()
    print("ping      ok")

    print("\nBuilding sales_daily.jsonl from JSON params...")
    build_sales_jsonl()

    db = get_db()
    if reset:
        clear_collections(db)

    id_map: Dict[str, ObjectId] = {}
    counts: Dict[str, int] = {}

    print("\nLoading JSON -> MongoDB...")
    for name, filename, is_jsonl in LOAD_ORDER:
        raw = load_jsonl(filename) if is_jsonl else load_json_array(filename)
        docs = convert_many(raw, id_map)
        counts[name] = _insert(db, name, docs)
        print(f"inserted {name:22s} {counts[name]:8d}  ({filename})")

    print("\n=== DOCUMENT COUNTS ===")
    for name in COLLECTIONS:
        print(f"{name:22s} {counts.get(name, 0):8d}")

    report = validate_dataset(db)
    report.print_report()

    print("=== SAMPLE DOCUMENTS ===")
    for name in ("products", "stores", "inventory", "sales_daily", "suppliers"):
        sample = db[name].find_one()
        print(f"\n{name}:")
        print(json.dumps(_jsonable(sample), indent=2))

    drill = db.products.find_one({"sku": "HW-PT-001"})
    cbd = db.stores.find_one({"name": "Adelaide CBD"})
    marion = db.stores.find_one({"name": "Marion"})
    if drill and cbd and marion:
        print("\n=== DRILL DEMO ===")
        for store in (cbd, marion):
            inv = db.inventory.find_one(
                {"store_id": store["_id"], "product_id": drill["_id"]}
            )
            if inv is None:
                continue
            usable = inv["on_hand"] - inv["reserved"]
            print(
                f"{store['name']}: on_hand={inv['on_hand']} reserved={inv['reserved']} "
                f"usable={usable} safety={inv['safety_stock']}"
            )

    if not report.ok:
        raise SystemExit(1)

    print("\nPhase 0 complete. Dataset ready for Phase 1: Inventory API.")
    return counts


def main() -> None:
    reset = "--no-reset" not in sys.argv
    try:
        seed(reset=reset)
    finally:
        close_client()


if __name__ == "__main__":
    main()
