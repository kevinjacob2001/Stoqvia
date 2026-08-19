"""MongoDB collection names, validators, and indexes."""

from __future__ import annotations

from typing import Any

COLLECTIONS: tuple[str, ...] = (
    "products",
    "stores",
    "inventory",
    "sales_daily",
    "suppliers",
    "supplier_products",
    "purchase_orders",
    "stock_transfers",
    "store_users",
)

RETIRED_COLLECTIONS: tuple[str, ...] = (
    "supplier_deliveries",
    "promotions",
    "weather_daily",
)


def _object_id() -> dict[str, str]:
    return {"bsonType": "objectId"}


def _string(min_length: int = 1) -> dict[str, Any]:
    return {"bsonType": "string", "minLength": min_length}


def _int_min(minimum: int = 0) -> dict[str, Any]:
    return {"bsonType": "int", "minimum": minimum}


def _double() -> dict[str, str]:
    return {"bsonType": "double"}


def _decimal() -> dict[str, str]:
    return {"bsonType": "decimal"}


def _date() -> dict[str, str]:
    return {"bsonType": "date"}


def _bool() -> dict[str, str]:
    return {"bsonType": "bool"}


COLLECTION_VALIDATORS: dict[str, dict[str, Any]] = {
    "products": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["sku", "name", "category", "unit_cost", "sell_price"],
            "properties": {
                "_id": _object_id(),
                "sku": _string(),
                "name": _string(),
                "category": _string(),
                "unit_cost": _decimal(),
                "sell_price": _decimal(),
            },
            "additionalProperties": False,
        }
    },
    "stores": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["name", "region", "latitude", "longitude"],
            "properties": {
                "_id": _object_id(),
                "name": _string(),
                "region": _string(),
                "latitude": _double(),
                "longitude": _double(),
            },
            "additionalProperties": False,
        }
    },
    "inventory": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": [
                "store_id",
                "product_id",
                "on_hand",
                "reserved",
                "safety_stock",
                "updated_at",
            ],
            "properties": {
                "_id": _object_id(),
                "store_id": _object_id(),
                "product_id": _object_id(),
                "on_hand": _int_min(0),
                "reserved": _int_min(0),
                "safety_stock": _int_min(0),
                "updated_at": _date(),
            },
            "additionalProperties": False,
        }
    },
    "sales_daily": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": [
                "date",
                "store_id",
                "product_id",
                "units_sold",
                "sell_price",
            ],
            "properties": {
                "_id": _object_id(),
                "date": _date(),
                "store_id": _object_id(),
                "product_id": _object_id(),
                "units_sold": _int_min(0),
                "sell_price": _decimal(),
            },
            "additionalProperties": False,
        }
    },
    "suppliers": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": [
                "name",
                "approved",
                "min_order_qty",
            ],
            "properties": {
                "_id": _object_id(),
                "name": _string(),
                "approved": _bool(),
                "min_order_qty": _int_min(1),
            },
            "additionalProperties": False,
        }
    },
    "supplier_products": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": [
                "supplier_id",
                "product_id",
                "unit_cost",
                "available_qty",
                "lead_days",
            ],
            "properties": {
                "_id": _object_id(),
                "supplier_id": _object_id(),
                "product_id": _object_id(),
                "unit_cost": _decimal(),
                "available_qty": _int_min(0),
                "lead_days": _int_min(0),
            },
            "additionalProperties": False,
        }
    },
    "purchase_orders": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": [
                "supplier_id",
                "store_id",
                "product_id",
                "qty",
                "expected_date",
                "status",
            ],
            "properties": {
                "_id": _object_id(),
                "supplier_id": _object_id(),
                "store_id": _object_id(),
                "product_id": _object_id(),
                "qty": _int_min(1),
                "expected_date": _date(),
                "status": _string(),
            },
            "additionalProperties": False,
        }
    },
    "stock_transfers": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": [
                "product_id",
                "requester_store_id",
                "qty",
                "status",
                "created_at",
                "invited",
            ],
            "properties": {
                "_id": _object_id(),
                "product_id": _object_id(),
                "requester_store_id": _object_id(),
                "qty": _int_min(1),
                "status": _string(),
                "created_at": _date(),
                "invited": {
                    "bsonType": "array",
                    "minItems": 1,
                    "items": {
                        "bsonType": "object",
                        "required": ["store_id", "status"],
                        "properties": {
                            "store_id": _object_id(),
                            "status": _string(),
                        },
                        "additionalProperties": False,
                    },
                },
                # Optional fields set as the transfer progresses
                "accepted_store_id": _object_id(),
                "accepted_at": _date(),
                "dispatched_at": _date(),
                "completed_at": _date(),
                "lead_days": _int_min(0),
                "events": {
                    "bsonType": "array",
                    "items": {
                        "bsonType": "object",
                        "required": ["at", "actor", "action"],
                        "properties": {
                            "at": _date(),
                            "actor": _string(),
                            "action": _string(),
                        },
                        "additionalProperties": False,
                    },
                },
            },
            "additionalProperties": False,
        }
    },
    "store_users": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["store_id", "username", "password_hash"],
            "properties": {
                "_id": _object_id(),
                "store_id": _object_id(),
                "username": _string(),
                "password_hash": _string(),
            },
            "additionalProperties": False,
        }
    },
}


COLLECTION_INDEXES: dict[str, list[tuple[list[tuple[str, Any]], dict[str, Any]]]] = {
    "products": [
        ([("sku", 1)], {"unique": True, "name": "uniq_sku"}),
    ],
    "stores": [
        ([("name", 1)], {"unique": True, "name": "uniq_store_name"}),
    ],
    "inventory": [
        (
            [("store_id", 1), ("product_id", 1)],
            {"unique": True, "name": "uniq_store_product"},
        ),
        ([("product_id", 1)], {"name": "by_product"}),
    ],
    "sales_daily": [
        (
            [("store_id", 1), ("product_id", 1), ("date", 1)],
            {"unique": True, "name": "uniq_store_product_date"},
        ),
        ([("date", 1)], {"name": "by_date"}),
    ],
    "suppliers": [
        ([("name", 1)], {"unique": True, "name": "uniq_supplier_name"}),
        ([("approved", 1)], {"name": "by_approved"}),
    ],
    "supplier_products": [
        (
            [("supplier_id", 1), ("product_id", 1)],
            {"unique": True, "name": "uniq_supplier_product"},
        ),
        ([("product_id", 1)], {"name": "by_product"}),
    ],
    "purchase_orders": [
        ([("store_id", 1), ("status", 1)], {"name": "store_status"}),
        ([("supplier_id", 1), ("expected_date", 1)], {"name": "supplier_expected"}),
        ([("product_id", 1)], {"name": "by_product"}),
    ],
    "stock_transfers": [
        (
            [("requester_store_id", 1), ("product_id", 1), ("status", 1)],
            {"name": "requester_product_status"},
        ),
        ([("invited.store_id", 1), ("status", 1)], {"name": "invited_status"}),
    ],
    "store_users": [
        ([("username", 1)], {"unique": True, "name": "uniq_username"}),
        ([("store_id", 1)], {"unique": True, "name": "uniq_store_admin"}),
    ],
}
