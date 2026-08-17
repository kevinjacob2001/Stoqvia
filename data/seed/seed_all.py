"""Master synthetic data seed script.

Usage (from repo root):
    PYTHONPATH=. python -m data.seed.seed_all
    PYTHONPATH=. python -m data.seed.seed_all --reset
"""

from __future__ import annotations

import json
import random
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

# repo root on path
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

from data.seed.config import RANDOM_SEED, SALES_END_DATE, SALES_START_DATE
from data.seed.generators.inventory import generate_inventory, strip_inventory_meta
from data.seed.generators.products import generate_products, strip_product_meta
from data.seed.generators.promotions import generate_promotions, strip_promotion_meta
from data.seed.generators.purchase_orders import generate_purchase_orders, strip_po_meta
from data.seed.generators.sales import generate_sales
from data.seed.generators.stock_transfers import generate_stock_transfers, strip_transfer_meta
from data.seed.generators.stores import generate_stores, strip_store_meta
from data.seed.generators.supplier_deliveries import (
    generate_supplier_deliveries,
    strip_delivery_meta,
)
from data.seed.generators.suppliers import (
    generate_supplier_products,
    generate_suppliers,
    strip_supplier_meta,
)
from data.seed.generators.weather import generate_weather
from data.seed.validation import validate_dataset


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


def _insert(db, name: str, docs: list[dict[str, Any]], stripper: Callable | None = None) -> int:
    if not docs:
        return 0
    payload = [stripper(d) if stripper else d for d in docs]
    # bulk in chunks for large collections
    chunk = 5000
    total = 0
    coll = db[name]
    for i in range(0, len(payload), chunk):
        result = coll.insert_many(payload[i : i + chunk], ordered=False)
        total += len(result.inserted_ids)
    return total


def clear_collections(db) -> None:
    for name in COLLECTIONS:
        db[name].delete_many({})
        print(f"cleared  {name}")


def seed(reset: bool = True) -> dict[str, int]:
    settings = get_settings()
    rng = random.Random(settings.seed_random_seed or RANDOM_SEED)

    print(f"Mongo URI : {settings.mongo_uri}")
    print(f"Database  : {settings.mongo_db}")
    print(f"RNG seed  : {settings.seed_random_seed or RANDOM_SEED}")
    print(f"Sales     : {SALES_START_DATE} → {SALES_END_DATE}")
    ping()
    print("ping      ok")

    db = get_db()
    if reset:
        clear_collections(db)

    print("\nGenerating...")
    products = generate_products(rng)
    stores = generate_stores()
    suppliers = generate_suppliers()
    supplier_products = generate_supplier_products(rng, products, suppliers)
    weather = generate_weather(rng, stores)
    promotions = generate_promotions(rng, products, stores)
    inventory = generate_inventory(rng, stores, products)
    print("  sales_daily (this may take a minute)...")
    sales = generate_sales(rng, products, stores, promotions, weather)
    deliveries = generate_supplier_deliveries(rng, suppliers, products, supplier_products)
    purchase_orders = generate_purchase_orders(
        rng, stores, products, suppliers, supplier_products
    )
    transfers = generate_stock_transfers(rng, stores, products)

    print("\nInserting...")
    counts = {
        "products": _insert(db, "products", products, strip_product_meta),
        "stores": _insert(db, "stores", stores, strip_store_meta),
        "suppliers": _insert(db, "suppliers", suppliers, strip_supplier_meta),
        "supplier_products": _insert(db, "supplier_products", supplier_products),
        "weather_daily": _insert(db, "weather_daily", weather),
        "promotions": _insert(db, "promotions", promotions, strip_promotion_meta),
        "inventory": _insert(db, "inventory", inventory, strip_inventory_meta),
        "sales_daily": _insert(db, "sales_daily", sales),
        "supplier_deliveries": _insert(
            db, "supplier_deliveries", deliveries, strip_delivery_meta
        ),
        "purchase_orders": _insert(db, "purchase_orders", purchase_orders, strip_po_meta),
        "stock_transfers": _insert(db, "stock_transfers", transfers, strip_transfer_meta),
    }

    print("\n=== DOCUMENT COUNTS ===")
    for name in COLLECTIONS:
        print(f"{name:22s} {counts.get(name, db[name].count_documents({})):8d}")

    report = validate_dataset(db)
    report.print()

    print("=== SAMPLE DOCUMENTS ===")
    for name in ("products", "stores", "inventory", "sales_daily", "suppliers"):
        sample = db[name].find_one()
        print(f"\n{name}:")
        print(json.dumps(_jsonable(sample), indent=2))

    if not report.ok:
        raise SystemExit(1)

    print("Dataset ready for next phase: Supply Service API")
    return counts


def main() -> None:
    reset = "--no-reset" not in sys.argv
    try:
        seed(reset=reset)
    finally:
        close_client()


if __name__ == "__main__":
    main()
