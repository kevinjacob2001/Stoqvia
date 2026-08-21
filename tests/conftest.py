"""Shared pytest fixtures."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

# Repo root on path for data.seed imports when running from backend/.
_REPO_ROOT = Path(__file__).resolve().parents[1]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))


@pytest.fixture(autouse=True)
def _disable_auto_complete_job(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AUTO_COMPLETE_INTERVAL_SECONDS", "0")
    from app.config import get_settings

    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def _reset_inventory_and_open_transfers() -> None:
    """Keep transfer tests isolated after inventory mutations."""
    from app.db import get_db
    from data.seed.loader import load_json_array, oid_from_key, parse_date

    db = get_db()
    db.stock_transfers.delete_many({})
    db.purchase_orders.delete_many({})
    for raw in load_json_array("inventory.json"):
        db.inventory.update_one(
            {
                "store_id": oid_from_key(str(raw["store_id"])),
                "product_id": oid_from_key(str(raw["product_id"])),
            },
            {
                "$set": {
                    "on_hand": int(raw["on_hand"]),
                    "reserved": int(raw["reserved"]),
                    "safety_stock": int(raw["safety_stock"]),
                    "updated_at": parse_date(raw["updated_at"]),
                }
            },
        )
