from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class MongoModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class ProductCreate(MongoModel):
    sku: str = Field(min_length=1)
    name: str = Field(min_length=1)
    category: str = Field(min_length=1)
    unit: Literal["each", "pack", "kg", "litre", "metre"]
    safety_stock: int = Field(ge=0)
    unit_cost: float = Field(ge=0)
    status: Literal["active", "discontinued"] = "active"


class Product(ProductCreate):
    id: str = Field(alias="_id")


class GeoPoint(MongoModel):
    type: Literal["Point"] = "Point"
    coordinates: list[float] = Field(min_length=2, max_length=2)

    @field_validator("coordinates")
    @classmethod
    def validate_lon_lat(cls, value: list[float]) -> list[float]:
        lon, lat = value
        if not (-180 <= lon <= 180 and -90 <= lat <= 90):
            raise ValueError("coordinates must be [longitude, latitude]")
        return value


class StoreCreate(MongoModel):
    store_code: str = Field(min_length=1)
    name: str = Field(min_length=1)
    city: str = Field(min_length=1)
    state: Literal["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]
    geo: GeoPoint | None = None
    status: Literal["active", "inactive"] = "active"


class Store(StoreCreate):
    id: str = Field(alias="_id")


class InventoryCreate(MongoModel):
    store_id: str
    product_id: str
    on_hand: int = Field(ge=0)


class Inventory(InventoryCreate):
    id: str = Field(alias="_id")


class SalesDailyCreate(MongoModel):
    store_id: str
    product_id: str
    date: date
    qty: int = Field(ge=0)


class SalesDaily(SalesDailyCreate):
    id: str = Field(alias="_id")


class SupplierCreate(MongoModel):
    supplier_code: str = Field(min_length=1)
    name: str = Field(min_length=1)
    approved: bool = True
    lead_time_days: int = Field(ge=0)
    min_order_qty: int = Field(ge=1)
    status: Literal["active", "inactive"] = "active"


class Supplier(SupplierCreate):
    id: str = Field(alias="_id")


class SupplierProductCreate(MongoModel):
    supplier_id: str
    product_id: str
    unit_cost: float = Field(ge=0)
    moq: int = Field(ge=1)


class SupplierProduct(SupplierProductCreate):
    id: str = Field(alias="_id")


class SupplierDeliveryCreate(MongoModel):
    delivery_code: str = Field(min_length=1)
    supplier_id: str
    store_id: str
    product_id: str
    qty: int = Field(ge=1)
    status: Literal["ordered", "in_transit", "delivered", "cancelled"]
    ordered_at: datetime
    expected_at: datetime
    delivered_at: datetime | None = None


class SupplierDelivery(SupplierDeliveryCreate):
    id: str = Field(alias="_id")


class PurchaseOrderLine(MongoModel):
    product_id: str
    qty: int = Field(ge=1)
    unit_cost: float = Field(ge=0)


class PurchaseOrderCreate(MongoModel):
    po_code: str = Field(min_length=1)
    supplier_id: str
    store_id: str
    status: Literal["draft", "submitted", "approved", "received", "cancelled"]
    ordered_at: datetime
    lines: list[PurchaseOrderLine] = Field(min_length=1)


class PurchaseOrder(PurchaseOrderCreate):
    id: str = Field(alias="_id")


class StockTransferCreate(MongoModel):
    transfer_code: str = Field(min_length=1)
    from_store_id: str
    to_store_id: str
    product_id: str
    qty: int = Field(ge=1)
    status: Literal["requested", "in_transit", "received", "cancelled"]
    requested_at: datetime
    received_at: datetime | None = None


class StockTransfer(StockTransferCreate):
    id: str = Field(alias="_id")


class PromotionCreate(MongoModel):
    promo_code: str = Field(min_length=1)
    name: str = Field(min_length=1)
    product_ids: list[str] = Field(min_length=1)
    store_ids: list[str] = Field(default_factory=list)
    discount_pct: float = Field(ge=0, le=100)
    start_date: date
    end_date: date
    status: Literal["scheduled", "active", "ended", "cancelled"] = "scheduled"


class Promotion(PromotionCreate):
    id: str = Field(alias="_id")


class WeatherDailyCreate(MongoModel):
    store_id: str
    date: date
    temp_max_c: float
    temp_min_c: float
    rainfall_mm: float = Field(ge=0)


class WeatherDaily(WeatherDailyCreate):
    id: str = Field(alias="_id")


class CollectionInfo(BaseModel):
    name: str
    count: int
    indexes: list[str]


class HealthResponse(BaseModel):
    status: str
    app: str
    env: str
    mongo: str
    database: str
    collections: list[str]
