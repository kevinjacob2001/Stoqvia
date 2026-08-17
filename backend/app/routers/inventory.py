from __future__ import annotations

from fastapi import APIRouter

from app.models.inventory import (
    NetworkInventoryResponse,
    ProductInventoryResponse,
    StoreInventoryResponse,
    StoreSummary,
)
from app.services import inventory_service

router = APIRouter(tags=["inventory"])


@router.get("/stores", response_model=list[StoreSummary])
def list_stores() -> list[StoreSummary]:
    return inventory_service.list_stores()


@router.get("/stores/{store_id}/inventory", response_model=StoreInventoryResponse)
def get_store_inventory(store_id: str) -> StoreInventoryResponse:
    return inventory_service.get_store_inventory(store_id)


@router.get(
    "/stores/{store_id}/products/{product_id}/inventory",
    response_model=ProductInventoryResponse,
)
def get_product_inventory(store_id: str, product_id: str) -> ProductInventoryResponse:
    return inventory_service.get_product_inventory(store_id, product_id)


@router.get(
    "/products/{product_id}/network-inventory",
    response_model=NetworkInventoryResponse,
)
def get_network_inventory(product_id: str) -> NetworkInventoryResponse:
    return inventory_service.get_network_inventory(product_id)
