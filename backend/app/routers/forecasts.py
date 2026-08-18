from __future__ import annotations

from fastapi import APIRouter

from app.models.forecast import ForecastResponse, StoreForecastsResponse
from app.services import forecast_service

router = APIRouter(tags=["forecast"])


@router.get("/forecast/{store_id}/{product_id}", response_model=ForecastResponse)
def get_forecast(store_id: str, product_id: str) -> ForecastResponse:
    return forecast_service.get_forecast(store_id, product_id)


@router.get("/stores/{store_id}/forecasts", response_model=StoreForecastsResponse)
def get_store_forecasts(store_id: str) -> StoreForecastsResponse:
    return forecast_service.get_store_forecasts(store_id)
