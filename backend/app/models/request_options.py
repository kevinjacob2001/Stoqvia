from typing import List, Optional

from pydantic import BaseModel, Field


class DonorOption(BaseModel):
    store_id: str
    store_name: str
    distance_km: float
    lead_days: int = Field(ge=1)
    safe_surplus: int
    recommended_qty: int = Field(ge=1)


class RadiusGroup(BaseModel):
    band: str
    label: str
    stores: List[DonorOption]


class SupplierOption(BaseModel):
    name: str
    lead_days: int = Field(ge=0)
    recommended_qty: int = Field(ge=1)


class RequestOptionsResponse(BaseModel):
    product_id: str
    sku: str
    product_name: str
    image_url: Optional[str] = None
    product_url: Optional[str] = None
    requested_qty: int = Field(ge=1)
    nearby_groups: List[RadiusGroup]
    supplier: Optional[SupplierOption] = None
