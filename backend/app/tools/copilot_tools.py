"""Read-only tools the Stoqvia copilot can call against live store data."""

from typing import Any, Callable, Dict, List, Optional

from app.services import forecast_service, request_options_service


def find_high_risk_products(store_id: str) -> Dict[str, Any]:
    """Find products with HIGH 7-day risk at the store."""
    response = forecast_service.get_store_forecasts(store_id)
    products: List[Dict[str, Any]] = [
        {
            "product_id": row.product_id,
            "sku": row.sku,
            "product_name": row.product_name,
            "risk": row.risk,
            "usable_stock": row.current_usable_stock,
            "predicted_7d_demand": row.predicted_7d_demand,
            "predicted_shortage_qty": row.predicted_shortage_qty,
        }
        for row in response.forecasts
        if row.risk == "HIGH"
    ]
    return {
        "store_id": store_id,
        "count": len(products),
        "products": products[:20],
    }


def recommend_donor_stores(store_id: str, product_id: str) -> Dict[str, Any]:
    """Find nearby stores with safe surplus for a HIGH-risk product."""
    options = request_options_service.get_request_options(store_id, product_id)
    donors: List[Dict[str, Any]] = []
    for group in options.nearby_groups:
        for donor in group.stores:
            donors.append(
                {
                    "store_id": donor.store_id,
                    "store_name": donor.store_name,
                    "distance_km": donor.distance_km,
                    "lead_days": donor.lead_days,
                    "safe_surplus": donor.safe_surplus,
                    "recommended_qty": donor.recommended_qty,
                    "band": group.label,
                }
            )
    donors.sort(key=lambda row: (row["distance_km"], -row["safe_surplus"]))
    return {
        "store_id": store_id,
        "product_id": product_id,
        "sku": options.sku,
        "product_name": options.product_name,
        "requested_qty": options.requested_qty,
        "donors": donors[:5],
        "supplier": options.supplier.model_dump() if options.supplier else None,
    }


def _named(fn: Callable[..., Dict[str, Any]], name: str) -> Callable[..., Dict[str, Any]]:
    fn.name = name  # type: ignore[attr-defined]
    return fn


COPILOT_TOOLS = [
    _named(find_high_risk_products, "find_high_risk_products"),
    _named(recommend_donor_stores, "recommend_donor_stores"),
]

COPILOT_TOOLS_BY_NAME: Dict[str, Callable[..., Dict[str, Any]]] = {
    tool.name: tool for tool in COPILOT_TOOLS  # type: ignore[attr-defined]
}
