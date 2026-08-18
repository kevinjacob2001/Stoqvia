"""Inventory API response models."""

from typing import List

from pydantic import BaseModel, Field


class StoreSummary(BaseModel):
    store_id: str
    name: str


class InventoryItem(BaseModel):
    store_id: str
    store_name: str
    product_id: str
    sku: str
    product_name: str
    on_hand: int = Field(ge=0)
    reserved: int = Field(ge=0)
    usable_stock: int = Field(ge=0)
    safety_stock: int = Field(ge=0)


class StoreInventoryResponse(BaseModel):
    store_id: str
    store_name: str
    item_count: int
    items: List[InventoryItem]


class ProductInventoryResponse(InventoryItem):
    pass


class NetworkInventoryResponse(BaseModel):
    product_id: str
    sku: str
    product_name: str
    category: str
    store_count: int
    total_on_hand: int
    total_reserved: int
    total_usable_stock: int
    stores: List[InventoryItem]
