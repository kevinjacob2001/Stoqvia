"""Load seed JSON files into MongoDB documents."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, Iterable, List

from bson import ObjectId
from bson.decimal128 import Decimal128

from app.services.passwords import hash_password

JSON_DIR = Path(__file__).resolve().parent / "json"

MONEY_FIELDS = frozenset({"unit_cost", "sell_price"})
DATE_FIELDS = frozenset({"date", "expected_date", "updated_at"})
REF_FIELDS = frozenset(
    {
        "store_id",
        "product_id",
        "supplier_id",
        "from_store_id",
        "to_store_id",
    }
)


def oid_from_key(key: str) -> ObjectId:
    return ObjectId(hashlib.md5(key.encode("utf-8")).hexdigest()[:24])


def money(value: Any) -> Decimal128:
    quantized = Decimal(str(value)).quantize(Decimal("0.01"))
    return Decimal128(str(quantized))


def parse_date(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    text = str(value)
    if text.endswith("Z"):
        text = text[:-1]
    if "T" in text:
        return datetime.fromisoformat(text)
    return datetime.fromisoformat(text + "T00:00:00")


def load_json_array(name: str) -> List[dict]:
    path = JSON_DIR / name
    with path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise ValueError(f"{name} must be a JSON array")
    return data


def load_jsonl(name: str) -> List[dict]:
    path = JSON_DIR / name
    rows: List[dict] = []
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def to_mongo_doc(raw: dict, id_map: Dict[str, ObjectId]) -> dict:
    doc: dict[str, Any] = {}
    source_id = raw.get("id")
    if source_id is not None:
        doc["_id"] = id_map.setdefault(str(source_id), oid_from_key(str(source_id)))

    for key, value in raw.items():
        if key == "id":
            continue
        if key == "password":
            doc["password_hash"] = hash_password(str(value))
            continue
        if key in REF_FIELDS:
            ref = str(value)
            doc[key] = id_map.setdefault(ref, oid_from_key(ref))
        elif key in MONEY_FIELDS:
            doc[key] = money(value)
        elif key in DATE_FIELDS:
            doc[key] = parse_date(value)
        else:
            doc[key] = value
    return doc


def convert_many(rows: Iterable[dict], id_map: Dict[str, ObjectId]) -> List[dict]:
    return [to_mongo_doc(row, id_map) for row in rows]
