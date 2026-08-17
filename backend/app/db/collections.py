"""MongoDB collection names, validators, and indexes (aligned to data spec)."""

from __future__ import annotations

from typing import Any

COLLECTIONS: tuple[str, ...] = (
    "products",
    "stores",
    "inventory",
    "sales_daily",
    "suppliers",
    "supplier_products",
    "supplier_deliveries",
    "purchase_orders",
    "stock_transfers",
    "promotions",
    "weather_daily",
)


def _object_id() -> dict[str, str]:
    return {"bsonType": "objectId"}


def _object_id_or_null() -> dict[str, Any]:
    return {"bsonType": ["objectId", "null"]}


def _string(min_length: int = 1) -> dict[str, Any]:
    return {"bsonType": "string", "minLength": min_length}


def _int_min(minimum: int = 0) -> dict[str, Any]:
    return {"bsonType": "int", "minimum": minimum}


def _double() -> dict[str, str]:
    return {"bsonType": "double"}


def _double_min(minimum: float = 0) -> dict[str, Any]:
    return {"bsonType": "double", "minimum": minimum}


def _decimal() -> dict[str, str]:
    return {"bsonType": "decimal"}


def _date() -> dict[str, str]:
    return {"bsonType": "date"}


def _date_or_null() -> dict[str, Any]:
    return {"bsonType": ["date", "null"]}


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
                "promotion_id": _object_id_or_null(),
                "weather_id": _object_id_or_null(),
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
                "default_lead_days",
                "min_order_qty",
            ],
            "properties": {
                "_id": _object_id(),
                "name": _string(),
                "approved": _bool(),
                "default_lead_days": _int_min(0),
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
    "supplier_deliveries": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": [
                "supplier_id",
                "product_id",
                "expected_date",
                "ordered_qty",
                "received_qty",
            ],
            "properties": {
                "_id": _object_id(),
                "supplier_id": _object_id(),
                "product_id": _object_id(),
                "expected_date": _date(),
                "actual_date": _date_or_null(),
                "ordered_qty": _int_min(1),
                "received_qty": _int_min(0),
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
                "from_store_id",
                "to_store_id",
                "qty",
                "expected_date",
                "status",
            ],
            "properties": {
                "_id": _object_id(),
                "product_id": _object_id(),
                "from_store_id": _object_id(),
                "to_store_id": _object_id(),
                "qty": _int_min(1),
                "expected_date": _date(),
                "status": _string(),
            },
            "additionalProperties": False,
        }
    },
    "promotions": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": [
                "product_id",
                "store_ids",
                "start_date",
                "end_date",
                "uplift_pct",
            ],
            "properties": {
                "_id": _object_id(),
                "product_id": _object_id(),
                "store_ids": {
                    "bsonType": "array",
                    "items": _object_id(),
                },
                "start_date": _date(),
                "end_date": _date(),
                "uplift_pct": _double(),
            },
            "additionalProperties": False,
        }
    },
    "weather_daily": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": [
                "date",
                "region",
                "max_temp",
                "rainfall_mm",
                "severe_weather",
            ],
            "properties": {
                "_id": _object_id(),
                "date": _date(),
                "region": _string(),
                "max_temp": _double(),
                "rainfall_mm": _double_min(0),
                "severe_weather": _bool(),
            },
            "additionalProperties": False,
        }
    },
}


COLLECTION_INDEXES: dict[str, list[tuple[list[tuple[str, Any]], dict[str, Any]]]] = {
    "products": [
        ([("sku", 1)], {"unique": True, "name": "uniq_sku"}),
        ([("category", 1)], {"name": "by_category"}),
    ],
    "stores": [
        ([("name", 1)], {"unique": True, "name": "uniq_store_name"}),
        ([("region", 1)], {"name": "by_region"}),
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
        ([("promotion_id", 1)], {"name": "by_promotion", "sparse": True}),
        ([("weather_id", 1)], {"name": "by_weather", "sparse": True}),
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
    "supplier_deliveries": [
        ([("supplier_id", 1), ("expected_date", 1)], {"name": "supplier_expected"}),
        ([("product_id", 1), ("expected_date", 1)], {"name": "product_expected"}),
    ],
    "purchase_orders": [
        ([("store_id", 1), ("status", 1)], {"name": "store_status"}),
        ([("supplier_id", 1), ("expected_date", 1)], {"name": "supplier_expected"}),
        ([("product_id", 1)], {"name": "by_product"}),
    ],
    "stock_transfers": [
        ([("from_store_id", 1), ("status", 1)], {"name": "from_status"}),
        ([("to_store_id", 1), ("status", 1)], {"name": "to_status"}),
        ([("product_id", 1), ("expected_date", 1)], {"name": "product_expected"}),
    ],
    "promotions": [
        ([("product_id", 1), ("start_date", 1), ("end_date", 1)], {"name": "product_dates"}),
        ([("start_date", 1), ("end_date", 1)], {"name": "date_range"}),
    ],
    "weather_daily": [
        (
            [("region", 1), ("date", 1)],
            {"unique": True, "name": "uniq_region_date"},
        ),
        ([("date", 1)], {"name": "by_date"}),
    ],
}
