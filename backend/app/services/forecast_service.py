"""7-day demand forecast from sales_daily.

Primary model: LightGBM recursive next-day predictions.
Fallback: day-of-week averages over the last 28 days.
API response shape is the same either way.
"""

from __future__ import annotations

import logging
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

from pymongo.database import Database

from app.config import get_settings
from app.db import get_db
from app.models.forecast import (
    ForecastResponse,
    StoreForecastsResponse,
    calculate_shortage,
    classify_risk,
)
from app.services.inventory_service import (
    calculate_usable_stock,
    parse_object_id,
    _require,
)

logger = logging.getLogger(__name__)

_REPO_ROOT = Path(__file__).resolve().parents[3]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

LOOKBACK_DAYS = 28
HORIZON_DAYS = 7
BASELINE_METHOD = "dow_28d_baseline"
ML_METHOD = "lightgbm_recursive_7d"


def _as_date(value: Any) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    raise TypeError(f"Unsupported date value: {value!r}")


def average_by_weekday(units_by_date: Sequence[Tuple[date, int]]) -> Dict[int, float]:
    buckets: Dict[int, List[int]] = defaultdict(list)
    for day, units in units_by_date:
        buckets[day.weekday()].append(units)
    return {weekday: sum(values) / len(values) for weekday, values in buckets.items() if values}


def predict_horizon(
    weekday_averages: Dict[int, float],
    fallback: float,
    horizon_start: date,
    horizon_days: int = HORIZON_DAYS,
) -> int:
    total = 0.0
    for offset in range(horizon_days):
        day = horizon_start + timedelta(days=offset)
        total += weekday_averages.get(day.weekday(), fallback)
    return int(round(total))


def _baseline_demand(series: List[Tuple[date, int]], horizon_start: date) -> int:
    weekday_averages = average_by_weekday(series)
    all_units = [units for _, units in series]
    fallback = (sum(all_units) / len(all_units)) if all_units else 0.0
    return predict_horizon(weekday_averages, fallback, horizon_start)


def _ml_demand(
    series: List[Tuple[date, int]],
    horizon_start: date,
    store_id: str,
    product_id: str,
) -> Optional[int]:
    try:
        from ml.lightgbm_model import predict_7d

        return predict_7d(series, horizon_start, store_id, product_id, HORIZON_DAYS)
    except Exception:
        logger.exception("LightGBM forecast failed; using weekday baseline")
        return None


def _sales_window(
    db: Database,
    store_oid: Any,
    product_oid: Any,
) -> Tuple[List[Tuple[date, int]], date]:
    latest = db.sales_daily.find_one(
        {"store_id": store_oid, "product_id": product_oid},
        sort=[("date", -1)],
    )
    if latest is None:
        today = datetime.now(timezone.utc).date()
        return [], today

    last_day = _as_date(latest["date"])
    window_start = datetime.combine(
        last_day - timedelta(days=LOOKBACK_DAYS - 1), datetime.min.time()
    )
    rows = db.sales_daily.find(
        {
            "store_id": store_oid,
            "product_id": product_oid,
            "date": {"$gte": window_start},
        }
    )
    series = [(_as_date(row["date"]), int(row["units_sold"])) for row in rows]
    return series, last_day + timedelta(days=1)


def _forecast_for_docs(
    store: Dict[str, Any],
    product: Dict[str, Any],
    inventory: Dict[str, Any],
    series: List[Tuple[date, int]],
    horizon_start: date,
) -> ForecastResponse:
    store_id = str(store["_id"])
    product_id = str(product["_id"])
    use_ml = get_settings().forecast_model.lower() != "baseline"
    predicted = _ml_demand(series, horizon_start, store_id, product_id) if use_ml else None
    method = ML_METHOD
    if predicted is None:
        predicted = _baseline_demand(series, horizon_start)
        method = BASELINE_METHOD

    usable = calculate_usable_stock(int(inventory["on_hand"]), int(inventory["reserved"]))
    safety = int(inventory["safety_stock"])
    projected = usable - predicted
    shortage = calculate_shortage(usable, predicted, safety)
    horizon_end = horizon_start + timedelta(days=HORIZON_DAYS - 1)
    return ForecastResponse(
        store_id=store_id,
        store_name=store["name"],
        product_id=product_id,
        sku=product["sku"],
        product_name=product["name"],
        current_usable_stock=usable,
        predicted_7d_demand=predicted,
        safety_stock=safety,
        projected_available_stock=projected,
        predicted_shortage_qty=shortage,
        risk=classify_risk(shortage, projected, safety),
        method=method,
        lookback_days=LOOKBACK_DAYS,
        horizon_start=horizon_start,
        horizon_end=horizon_end,
        shortage_includes_safety_stock=True,
    )


def get_forecast(
    store_id: str,
    product_id: str,
    db: Optional[Database] = None,
) -> ForecastResponse:
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
    series, horizon_start = _sales_window(database, store_oid, product_oid)
    return _forecast_for_docs(store, product, inventory, series, horizon_start)


def get_store_forecasts(
    store_id: str,
    db: Optional[Database] = None,
) -> StoreForecastsResponse:
    database = db if db is not None else get_db()
    store_oid = parse_object_id(store_id, "store_id")
    store = _require(database.stores.find_one({"_id": store_oid}), f"Store not found: {store_id}")
    rows = list(database.inventory.find({"store_id": store_oid}))
    product_ids = [row["product_id"] for row in rows]
    products = {
        product["_id"]: product
        for product in database.products.find({"_id": {"$in": product_ids}})
    }
    forecasts: List[ForecastResponse] = []
    for row in rows:
        product = products.get(row["product_id"])
        if product is None:
            continue
        series, horizon_start = _sales_window(database, store_oid, row["product_id"])
        forecasts.append(_forecast_for_docs(store, product, row, series, horizon_start))
    forecasts.sort(key=lambda item: item.sku)
    return StoreForecastsResponse(
        store_id=str(store["_id"]),
        store_name=store["name"],
        forecasts=forecasts,
    )
