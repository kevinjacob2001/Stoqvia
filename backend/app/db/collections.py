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
    "supplier_deliveries",
    "purchase_orders",
    "stock_transfers",
    "promotions",
    "weather_daily",
)


def _object_id() -> dict[str, str]:
    return {"bsonType": "objectId"}


def _string(min_length: int = 1) -> dict[str, Any]:
    return {"bsonType": "string", "minLength": min_length}


def _int_min(minimum: int = 0) -> dict[str, Any]:
    return {"bsonType": "int", "minimum": minimum}


def _double_min(minimum: float = 0) -> dict[str, Any]:
    return {"bsonType": "double", "minimum": minimum}


def _date() -> dict[str, str]:
    return {"bsonType": "date"}


def _bool() -> dict[str, str]:
    return {"bsonType": "bool"}


COLLECTION_VALIDATORS: dict[str, dict[str, Any]] = {
    "products": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": [
                "sku",
                "name",
                "category",
                "unit",
                "safety_stock",
                "unit_cost",
                "status",
            ],
            "properties": {
                "sku": _string(),
                "name": _string(),
                "category": _string(),
                "unit": {"enum": ["each", "pack", "kg", "litre", "metre"]},
                "safety_stock": _int_min(0),
                "unit_cost": _double_min(0),
                "status": {"enum": ["active", "discontinued"]},
            },
            "additionalProperties": True,
        }
    },
    "stores": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["store_code", "name", "city", "state", "status"],
            "properties": {
                "store_code": _string(),
                "name": _string(),
                "city": _string(),
                "state": {
                    "enum": ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]
                },
                "geo": {
                    "bsonType": "object",
                    "required": ["type", "coordinates"],
                    "properties": {
                        "type": {"enum": ["Point"]},
                        "coordinates": {
                            "bsonType": "array",
                            "minItems": 2,
                            "maxItems": 2,
                            "items": {"bsonType": "double"},
                        },
                    },
                },
                "status": {"enum": ["active", "inactive"]},
            },
            "additionalProperties": True,
        }
    },
    "inventory": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["store_id", "product_id", "on_hand"],
            "properties": {
                "store_id": _object_id(),
                "product_id": _object_id(),
                "on_hand": _int_min(0),
            },
            "additionalProperties": True,
        }
    },
    "sales_daily": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["store_id", "product_id", "date", "qty"],
            "properties": {
                "store_id": _object_id(),
                "product_id": _object_id(),
                "date": _date(),
                "qty": _int_min(0),
            },
            "additionalProperties": True,
        }
    },
    "suppliers": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": [
                "supplier_code",
                "name",
                "approved",
                "lead_time_days",
                "min_order_qty",
                "status",
            ],
            "properties": {
                "supplier_code": _string(),
                "name": _string(),
                "approved": _bool(),
                "lead_time_days": _int_min(0),
                "min_order_qty": _int_min(1),
                "status": {"enum": ["active", "inactive"]},
            },
            "additionalProperties": True,
        }
    },
    "supplier_products": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["supplier_id", "product_id", "unit_cost", "moq"],
            "properties": {
                "supplier_id": _object_id(),
                "product_id": _object_id(),
                "unit_cost": _double_min(0),
                "moq": _int_min(1),
            },
            "additionalProperties": True,
        }
    },
    "supplier_deliveries": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": [
                "delivery_code",
                "supplier_id",
                "store_id",
                "product_id",
                "qty",
                "status",
                "ordered_at",
                "expected_at",
            ],
            "properties": {
                "delivery_code": _string(),
                "supplier_id": _object_id(),
                "store_id": _object_id(),
                "product_id": _object_id(),
                "qty": _int_min(1),
                "status": {
                    "enum": ["ordered", "in_transit", "delivered", "cancelled"]
                },
                "ordered_at": _date(),
                "expected_at": _date(),
                "delivered_at": _date(),
            },
            "additionalProperties": True,
        }
    },
    "purchase_orders": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": [
                "po_code",
                "supplier_id",
                "store_id",
                "status",
                "ordered_at",
                "lines",
            ],
            "properties": {
                "po_code": _string(),
                "supplier_id": _object_id(),
                "store_id": _object_id(),
                "status": {
                    "enum": ["draft", "submitted", "approved", "received", "cancelled"]
                },
                "ordered_at": _date(),
                "lines": {
                    "bsonType": "array",
                    "minItems": 1,
                    "items": {
                        "bsonType": "object",
                        "required": ["product_id", "qty", "unit_cost"],
                        "properties": {
                            "product_id": _object_id(),
                            "qty": _int_min(1),
                            "unit_cost": _double_min(0),
                        },
                    },
                },
            },
            "additionalProperties": True,
        }
    },
    "stock_transfers": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": [
                "transfer_code",
                "from_store_id",
                "to_store_id",
                "product_id",
                "qty",
                "status",
                "requested_at",
            ],
            "properties": {
                "transfer_code": _string(),
                "from_store_id": _object_id(),
                "to_store_id": _object_id(),
                "product_id": _object_id(),
                "qty": _int_min(1),
                "status": {
                    "enum": ["requested", "in_transit", "received", "cancelled"]
                },
                "requested_at": _date(),
                "received_at": _date(),
            },
            "additionalProperties": True,
        }
    },
    "promotions": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": [
                "promo_code",
                "name",
                "product_ids",
                "discount_pct",
                "start_date",
                "end_date",
                "status",
            ],
            "properties": {
                "promo_code": _string(),
                "name": _string(),
                "product_ids": {
                    "bsonType": "array",
                    "minItems": 1,
                    "items": _object_id(),
                },
                "store_ids": {
                    "bsonType": "array",
                    "items": _object_id(),
                },
                "discount_pct": {
                    "bsonType": "double",
                    "minimum": 0,
                    "maximum": 100,
                },
                "start_date": _date(),
                "end_date": _date(),
                "status": {"enum": ["scheduled", "active", "ended", "cancelled"]},
            },
            "additionalProperties": True,
        }
    },
    "weather_daily": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": [
                "store_id",
                "date",
                "temp_max_c",
                "temp_min_c",
                "rainfall_mm",
            ],
            "properties": {
                "store_id": _object_id(),
                "date": _date(),
                "temp_max_c": {"bsonType": "double"},
                "temp_min_c": {"bsonType": "double"},
                "rainfall_mm": _double_min(0),
            },
            "additionalProperties": True,
        }
    },
}


COLLECTION_INDEXES: dict[str, list[list[tuple[str, int]] | dict[str, Any]]] = {
    "products": [
        ([("sku", 1)], {"unique": True, "name": "uniq_sku"}),
        ([("category", 1), ("status", 1)], {"name": "category_status"}),
    ],
    "stores": [
        ([("store_code", 1)], {"unique": True, "name": "uniq_store_code"}),
        ([("geo", "2dsphere")], {"name": "geo_2dsphere"}),
        ([("state", 1), ("status", 1)], {"name": "state_status"}),
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
        ([("supplier_code", 1)], {"unique": True, "name": "uniq_supplier_code"}),
        ([("approved", 1), ("status", 1)], {"name": "approved_status"}),
    ],
    "supplier_products": [
        (
            [("supplier_id", 1), ("product_id", 1)],
            {"unique": True, "name": "uniq_supplier_product"},
        ),
        ([("product_id", 1)], {"name": "by_product"}),
    ],
    "supplier_deliveries": [
        ([("delivery_code", 1)], {"unique": True, "name": "uniq_delivery_code"}),
        ([("store_id", 1), ("status", 1)], {"name": "store_status"}),
        ([("supplier_id", 1), ("expected_at", 1)], {"name": "supplier_expected"}),
    ],
    "purchase_orders": [
        ([("po_code", 1)], {"unique": True, "name": "uniq_po_code"}),
        ([("store_id", 1), ("status", 1)], {"name": "store_status"}),
        ([("supplier_id", 1), ("ordered_at", 1)], {"name": "supplier_ordered"}),
    ],
    "stock_transfers": [
        ([("transfer_code", 1)], {"unique": True, "name": "uniq_transfer_code"}),
        ([("from_store_id", 1), ("status", 1)], {"name": "from_status"}),
        ([("to_store_id", 1), ("status", 1)], {"name": "to_status"}),
    ],
    "promotions": [
        ([("promo_code", 1)], {"unique": True, "name": "uniq_promo_code"}),
        ([("start_date", 1), ("end_date", 1)], {"name": "date_range"}),
        ([("status", 1)], {"name": "by_status"}),
    ],
    "weather_daily": [
        (
            [("store_id", 1), ("date", 1)],
            {"unique": True, "name": "uniq_store_date"},
        ),
        ([("date", 1)], {"name": "by_date"}),
    ],
}
