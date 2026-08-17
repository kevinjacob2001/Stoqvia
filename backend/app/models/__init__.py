from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class MongoModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class ProductCreate(MongoModel):
    sku: str = Field(min_length=1)
    name: str = Field(min_length=1)
    category: str = Field(min_length=1)
    unit_cost: Decimal = Field(ge=0)
    sell_price: Decimal = Field(ge=0)


class Product(ProductCreate):
    id: str = Field(alias="_id")


class StoreCreate(MongoModel):
    name: str = Field(min_length=1)
    region: str = Field(min_length=1)
    latitude: float
    longitude: float

    @field_validator("latitude")
    @classmethod
    def validate_latitude(cls, value: float) -> float:
        if not -90 <= value <= 90:
            raise ValueError("latitude must be between -90 and 90")
        return value

    @field_validator("longitude")
    @classmethod
    def validate_longitude(cls, value: float) -> float:
        if not -180 <= value <= 180:
            raise ValueError("longitude must be between -180 and 180")
        return value


class Store(StoreCreate):
    id: str = Field(alias="_id")


class InventoryCreate(MongoModel):
    store_id: str
    product_id: str
    on_hand: int = Field(ge=0)
    reserved: int = Field(ge=0)
    safety_stock: int = Field(ge=0)
    updated_at: datetime


class Inventory(InventoryCreate):
    id: str = Field(alias="_id")


class SalesDailyCreate(MongoModel):
    date: date
    store_id: str
    product_id: str
    units_sold: int = Field(ge=0)
    sell_price: Decimal = Field(ge=0)
    promotion_id: Optional[str] = None
    weather_id: Optional[str] = None


class SalesDaily(SalesDailyCreate):
    id: str = Field(alias="_id")


class SupplierCreate(MongoModel):
    name: str = Field(min_length=1)
    approved: bool = True
    default_lead_days: int = Field(ge=0)
    min_order_qty: int = Field(ge=1)


class Supplier(SupplierCreate):
    id: str = Field(alias="_id")


class SupplierProductCreate(MongoModel):
    supplier_id: str
    product_id: str
    unit_cost: Decimal = Field(ge=0)
    available_qty: int = Field(ge=0)
    lead_days: int = Field(ge=0)


class SupplierProduct(SupplierProductCreate):
    id: str = Field(alias="_id")


class SupplierDeliveryCreate(MongoModel):
    supplier_id: str
    product_id: str
    expected_date: date
    actual_date: Optional[date] = None
    ordered_qty: int = Field(ge=1)
    received_qty: int = Field(ge=0)


class SupplierDelivery(SupplierDeliveryCreate):
    id: str = Field(alias="_id")


class PurchaseOrderCreate(MongoModel):
    supplier_id: str
    store_id: str
    product_id: str
    qty: int = Field(ge=1)
    expected_date: date
    status: str = Field(min_length=1)


class PurchaseOrder(PurchaseOrderCreate):
    id: str = Field(alias="_id")


class StockTransferCreate(MongoModel):
    product_id: str
    from_store_id: str
    to_store_id: str
    qty: int = Field(ge=1)
    expected_date: date
    status: str = Field(min_length=1)


class StockTransfer(StockTransferCreate):
    id: str = Field(alias="_id")


class PromotionCreate(MongoModel):
    product_id: str
    store_ids: List[str] = Field(default_factory=list)
    start_date: date
    end_date: date
    uplift_pct: float


class Promotion(PromotionCreate):
    id: str = Field(alias="_id")


class WeatherDailyCreate(MongoModel):
    date: date
    region: str = Field(min_length=1)
    max_temp: float
    rainfall_mm: float = Field(ge=0)
    severe_weather: bool = False


class WeatherDaily(WeatherDailyCreate):
    id: str = Field(alias="_id")


class CollectionInfo(BaseModel):
    name: str
    count: int
    indexes: List[str]


class HealthResponse(BaseModel):
    status: str
    app: str
    env: str
    mongo: str
    database: str
    collections: List[str]
