"""Read-only transfer and supplier options for a HIGH-risk product."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from bson.decimal128 import Decimal128
from fastapi import HTTPException, status
from pymongo.database import Database

from app.db import get_db
from app.models.forecast import calculate_safe_surplus
from app.models.request_options import (
    DonorOption,
    RadiusGroup,
    RequestOptionsResponse,
    SupplierOption,
)
from app.services import forecast_service
from app.services.geo import BAND_LABELS, BAND_ORDER, distance_km, radius_band
from app.services.inventory_service import parse_object_id, _require


def _money(value: Any) -> float:
    if isinstance(value, Decimal128):
        return float(value.to_decimal())
    return float(value)


def _best_supplier(db: Database, product_oid: Any, requested_qty: int) -> Optional[SupplierOption]:
    links = list(db.supplier_products.find({"product_id": product_oid}))
    options: List[SupplierOption] = []
    for link in links:
        supplier = db.suppliers.find_one({"_id": link["supplier_id"], "approved": True})
        if supplier is None:
            continue
        recommended = max(requested_qty, int(supplier["min_order_qty"]))
        options.append(
            SupplierOption(
                supplier_id=str(supplier["_id"]),
                name=supplier["name"],
                lead_days=int(link["lead_days"]),
                min_order_qty=int(supplier["min_order_qty"]),
                available_qty=int(link["available_qty"]),
                unit_cost=_money(link["unit_cost"]),
                recommended_qty=recommended,
            )
        )
    if not options:
        return None
    options.sort(key=lambda item: (item.lead_days, item.unit_cost, item.name))
    return options[0]


def get_request_options(
    store_id: str,
    product_id: str,
    db: Optional[Database] = None,
) -> RequestOptionsResponse:
    database = db if db is not None else get_db()
    receiver = forecast_service.get_forecast(store_id, product_id, db=database)
    if receiver.risk != "HIGH":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request options are only available when risk is HIGH",
        )

    requested_qty = receiver.predicted_shortage_qty
    store_oid = parse_object_id(store_id, "store_id")
    product_oid = parse_object_id(product_id, "product_id")
    origin = _require(database.stores.find_one({"_id": store_oid}), f"Store not found: {store_id}")

    grouped: Dict[str, List[DonorOption]] = {band: [] for band in BAND_ORDER}
    for store in database.stores.find({"_id": {"$ne": store_oid}}):
        try:
            donor_forecast = forecast_service.get_forecast(
                str(store["_id"]),
                product_id,
                db=database,
            )
        except HTTPException:
            continue
        surplus = calculate_safe_surplus(
            donor_forecast.current_usable_stock,
            donor_forecast.predicted_7d_demand,
            donor_forecast.safety_stock,
        )
        if donor_forecast.risk != "LOW" or surplus < 1:
            continue
        kilometres = round(
            distance_km(
                float(origin["latitude"]),
                float(origin["longitude"]),
                float(store["latitude"]),
                float(store["longitude"]),
            ),
            1,
        )
        band = radius_band(kilometres)
        grouped[band].append(
            DonorOption(
                store_id=donor_forecast.store_id,
                store_name=donor_forecast.store_name,
                region=store["region"],
                distance_km=kilometres,
                radius_band=band,
                usable_stock=donor_forecast.current_usable_stock,
                predicted_7d_demand=donor_forecast.predicted_7d_demand,
                safety_stock=donor_forecast.safety_stock,
                safe_surplus=surplus,
                risk=donor_forecast.risk,
                recommended_qty=min(requested_qty, surplus),
            )
        )

    nearby_groups: List[RadiusGroup] = []
    for band in BAND_ORDER:
        stores = grouped[band]
        if not stores:
            continue
        stores.sort(key=lambda item: (item.distance_km, item.store_name))
        nearby_groups.append(
            RadiusGroup(band=band, label=BAND_LABELS[band], stores=stores)
        )

    return RequestOptionsResponse(
        store_id=receiver.store_id,
        store_name=receiver.store_name,
        product_id=receiver.product_id,
        sku=receiver.sku,
        product_name=receiver.product_name,
        risk=receiver.risk,
        shortage_qty=requested_qty,
        requested_qty=requested_qty,
        nearby_groups=nearby_groups,
        supplier=_best_supplier(database, product_oid, requested_qty),
    )
