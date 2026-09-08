"""Read-only tools available to the Stoqvia Copilot."""

from typing import Any, Dict, List, Literal, Optional

from langchain_core.tools import tool

from app.db import get_db
from app.services import forecast_service, request_options_service
from app.services.inventory_service import parse_object_id

RiskLevel = Literal["HIGH", "MEDIUM", "LOW"]


@tool
def search_products(
    store_id: str,
    query: Optional[str] = None,
    category: Optional[str] = None,
    risk: Optional[RiskLevel] = None,
) -> Dict[str, Any]:
    """
    Search products at a store.

    Products may be filtered by product name, SKU, category
    or inventory risk. All filters are optional.
    """
    response = forecast_service.get_store_forecasts(store_id)

    database = get_db()
    product_oids = [
        parse_object_id(row.product_id, "product_id") for row in response.forecasts
    ]
    categories_by_id = {
        str(doc["_id"]): doc.get("category")
        for doc in database.products.find({"_id": {"$in": product_oids}}, {"category": 1})
    }

    products: List[Dict[str, Any]] = []

    search_text = query.casefold().strip() if query else None
    category_filter = category.casefold().strip() if category else None

    for row in response.forecasts:
        row_category = categories_by_id.get(row.product_id)

        if risk is not None and row.risk != risk:
            continue

        if category_filter is not None:
            if row_category is None:
                continue
            if str(row_category).casefold() != category_filter:
                continue

        if search_text is not None:
            searchable_values = [
                str(row.product_name).casefold(),
                str(row.sku).casefold(),
                str(row_category or "").casefold(),
            ]
            if not any(search_text in value for value in searchable_values):
                continue

        products.append(
            {
                "product_id": row.product_id,
                "sku": row.sku,
                "product_name": row.product_name,
                "category": row_category,
                "risk": row.risk,
                "usable_stock": row.current_usable_stock,
                "predicted_7d_demand": row.predicted_7d_demand,
                "predicted_shortage_qty": row.predicted_shortage_qty,
            }
        )

    maximum_results = 20
    return {
        "store_id": store_id,
        "filters": {
            "query": query,
            "category": category,
            "risk": risk,
        },
        "total_count": len(products),
        "returned_count": min(len(products), maximum_results),
        "truncated": len(products) > maximum_results,
        "products": products[:maximum_results],
    }


@tool
def recommend_donor_stores(
    store_id: str,
    product_id: str,
    min_safe_surplus: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Find nearby stores with backend-verified safe surplus
    for the selected product.

    Works for any product. Optionally filter donors to those
    with at least min_safe_surplus units available.
    """
    options = request_options_service.get_request_options(
        store_id,
        product_id,
        require_high_risk=False,
    )

    donors: List[Dict[str, Any]] = []
    for group in options.nearby_groups:
        for donor in group.stores:
            if min_safe_surplus is not None and donor.safe_surplus < min_safe_surplus:
                continue
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

    donors.sort(key=lambda donor: (donor["distance_km"], -donor["safe_surplus"]))

    maximum_results = 5
    return {
        "store_id": store_id,
        "product_id": product_id,
        "sku": options.sku,
        "product_name": options.product_name,
        "requested_qty": options.requested_qty,
        "min_safe_surplus": min_safe_surplus,
        "total_donor_count": len(donors),
        "returned_donor_count": min(len(donors), maximum_results),
        "truncated": len(donors) > maximum_results,
        "donors": donors[:maximum_results],
        "supplier": options.supplier.model_dump() if options.supplier else None,
    }


COPILOT_TOOLS = [
    search_products,
    recommend_donor_stores,
]

COPILOT_TOOLS_BY_NAME = {
    copilot_tool.name: copilot_tool for copilot_tool in COPILOT_TOOLS
}
