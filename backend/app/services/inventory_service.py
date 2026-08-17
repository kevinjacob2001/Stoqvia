"""Inventory read service. No writes."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException, status
from pymongo.database import Database

from app.db import get_db
from app.models.inventory import (
    InventoryItem,
    NetworkInventoryResponse,
    ProductInventoryResponse,
    StoreInventoryResponse,
    StoreSummary,
)


def calculate_usable_stock(on_hand: int, reserved: int) -> int:
    if on_hand < 0 or reserved < 0:
        raise ValueError("on_hand and reserved must be >= 0")
    return max(0, on_hand - reserved)


def parse_object_id(value: str, label: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {label}: {value}",
        )


def _require(doc: Optional[Dict[str, Any]], detail: str) -> Dict[str, Any]:
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
    return doc


def _item(
    store: Dict[str, Any],
    product: Dict[str, Any],
    inventory: Dict[str, Any],
) -> InventoryItem:
    on_hand = int(inventory["on_hand"])
    reserved = int(inventory["reserved"])
    return InventoryItem(
        store_id=str(store["_id"]),
        store_name=store["name"],
        product_id=str(product["_id"]),
        sku=product["sku"],
        product_name=product["name"],
        on_hand=on_hand,
        reserved=reserved,
        usable_stock=calculate_usable_stock(on_hand, reserved),
        safety_stock=int(inventory["safety_stock"]),
        updated_at=inventory["updated_at"],
    )


def list_stores(db: Optional[Database] = None) -> List[StoreSummary]:
    database = db if db is not None else get_db()
    stores = list(database.stores.find().sort("name", 1))
    return [
        StoreSummary(
            store_id=str(store["_id"]),
            name=store["name"],
            region=store["region"],
            latitude=float(store["latitude"]),
            longitude=float(store["longitude"]),
        )
        for store in stores
    ]


def get_store_inventory(
    store_id: str,
    db: Optional[Database] = None,
) -> StoreInventoryResponse:
    database = db if db is not None else get_db()
    oid = parse_object_id(store_id, "store_id")
    store = _require(database.stores.find_one({"_id": oid}), f"Store not found: {store_id}")

    rows = list(database.inventory.find({"store_id": oid}))
    product_ids = [row["product_id"] for row in rows]
    products = {
        product["_id"]: product
        for product in database.products.find({"_id": {"$in": product_ids}})
    }

    items = []
    for row in rows:
        product = products.get(row["product_id"])
        if product is None:
            continue
        items.append(_item(store, product, row))
    items.sort(key=lambda item: item.sku)

    return StoreInventoryResponse(
        store_id=str(store["_id"]),
        store_name=store["name"],
        region=store["region"],
        item_count=len(items),
        items=items,
    )


def get_product_inventory(
    store_id: str,
    product_id: str,
    db: Optional[Database] = None,
) -> ProductInventoryResponse:
    database = db if db is not None else get_db()
    store_oid = parse_object_id(store_id, "store_id")
    product_oid = parse_object_id(product_id, "product_id")

    store = _require(database.stores.find_one({"_id": store_oid}), f"Store not found: {store_id}")
    product = _require(
        database.products.find_one({"_id": product_oid}),
        f"Product not found: {product_id}",
    )
    inventory = _require(
        database.inventory.find_one({"store_id": store_oid, "product_id": product_oid}),
        f"Inventory not found for store {store_id} and product {product_id}",
    )
    return ProductInventoryResponse.model_validate(_item(store, product, inventory).model_dump())


def get_network_inventory(
    product_id: str,
    db: Optional[Database] = None,
) -> NetworkInventoryResponse:
    database = db if db is not None else get_db()
    product_oid = parse_object_id(product_id, "product_id")
    product = _require(
        database.products.find_one({"_id": product_oid}),
        f"Product not found: {product_id}",
    )

    rows = list(database.inventory.find({"product_id": product_oid}))
    store_ids = [row["store_id"] for row in rows]
    stores = {
        store["_id"]: store
        for store in database.stores.find({"_id": {"$in": store_ids}})
    }

    items = []
    for row in rows:
        store = stores.get(row["store_id"])
        if store is None:
            continue
        items.append(_item(store, product, row))
    items.sort(key=lambda item: item.store_name)

    return NetworkInventoryResponse(
        product_id=str(product["_id"]),
        sku=product["sku"],
        product_name=product["name"],
        category=product["category"],
        store_count=len(items),
        total_on_hand=sum(item.on_hand for item in items),
        total_reserved=sum(item.reserved for item in items),
        total_usable_stock=sum(item.usable_stock for item in items),
        stores=items,
    )
