from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.forecast import RiskLevel


class DonorOption(BaseModel):
    store_id: str
    store_name: str
    region: str
    distance_km: float
    radius_band: str
    usable_stock: int = Field(ge=0)
    predicted_7d_demand: int = Field(ge=0)
    safety_stock: int = Field(ge=0)
    safe_surplus: int
    risk: RiskLevel
    recommended_qty: int = Field(ge=1)


class RadiusGroup(BaseModel):
    band: str
    label: str
    stores: List[DonorOption]


class SupplierOption(BaseModel):
    supplier_id: str
    name: str
    lead_days: int = Field(ge=0)
    min_order_qty: int = Field(ge=1)
    available_qty: int = Field(ge=0)
    unit_cost: float = Field(ge=0)
    recommended_qty: int = Field(ge=1)


class RequestOptionsResponse(BaseModel):
    store_id: str
    store_name: str
    product_id: str
    sku: str
    product_name: str
    risk: RiskLevel
    shortage_qty: int = Field(ge=0)
    requested_qty: int = Field(ge=1)
    nearby_groups: List[RadiusGroup]
    supplier: Optional[SupplierOption] = None
