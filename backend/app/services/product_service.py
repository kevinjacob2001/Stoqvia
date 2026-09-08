"""Read-only product lookups."""

from __future__ import annotations

import re
from typing import Any, Dict, Optional

from pymongo.database import Database

from app.db import get_db

SKU_PATTERN = re.compile(r"\b([A-Z]{2,}-[A-Z0-9]+-\d+)\b", re.IGNORECASE)


def normalize_sku(value: str) -> str:
    return value.strip().upper()


def extract_sku_from_message(message: str) -> Optional[str]:
    """Pull the first catalog-style SKU from a manager question."""
    match = SKU_PATTERN.search(message)
    if match is None:
        return None
    return normalize_sku(match.group(1))


def get_product_by_sku(
    sku: str,
    db: Optional[Database] = None,
) -> Optional[Dict[str, Any]]:
    """Return the product document for an exact SKU match (case-insensitive)."""
    cleaned = normalize_sku(sku)
    if not cleaned:
        return None

    database = db if db is not None else get_db()
    for doc in database.products.find({}, {"sku": 1, "name": 1, "category": 1}):
        if normalize_sku(str(doc.get("sku", ""))) == cleaned:
            return doc
    return None
