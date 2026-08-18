from datetime import date
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

RiskLevel = Literal["LOW", "MEDIUM", "HIGH"]


class ForecastResponse(BaseModel):
    store_id: str
    store_name: str
    product_id: str
    sku: str
    product_name: str
    current_usable_stock: int = Field(ge=0)
    predicted_7d_demand: int = Field(ge=0)
    safety_stock: int = Field(ge=0)
    projected_available_stock: int
    predicted_shortage_qty: int = Field(ge=0)
    risk: RiskLevel
    method: str
    lookback_days: int
    horizon_start: date
    horizon_end: date
    shortage_includes_safety_stock: bool = True


class StoreForecastsResponse(BaseModel):
    store_id: str
    store_name: str
    forecasts: List[ForecastResponse]


def classify_risk(predicted_shortage_qty: int, projected_available_stock: int, safety_stock: int) -> RiskLevel:
    if predicted_shortage_qty > 0:
        return "HIGH"
    if projected_available_stock < safety_stock * 2:
        return "MEDIUM"
    return "LOW"


def calculate_shortage(usable_stock: int, predicted_7d_demand: int, safety_stock: int) -> int:
    """Units short after covering 7-day demand AND remaining at safety stock."""
    return max(0, predicted_7d_demand + safety_stock - usable_stock)


def calculate_safe_surplus(usable_stock: int, predicted_7d_demand: int, safety_stock: int) -> int:
    """Units a donor can spare after covering its own 7-day demand and safety stock."""
    return usable_stock - predicted_7d_demand - safety_stock
