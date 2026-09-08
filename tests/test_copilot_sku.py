"""Tests for Copilot SKU resolution."""

from app.services.copilot_services import (
    _resolve_donor_product_id,
    enforce_trusted_arguments,
)
from app.services import product_service
from app.models.copilot import ToolSelection


def test_extract_sku_from_message() -> None:
    assert (
        product_service.extract_sku_from_message(
            "Find nearby stores with at least 40 units of SKU HW-BM-017."
        )
        == "HW-BM-017"
    )


def test_resolve_donor_product_from_message_sku() -> None:
    product_id, sku, error = _resolve_donor_product_id(
        None,
        {},
        "Find nearby stores with at least 40 units of SKU HW-BM-017.",
    )
    assert error is None
    assert sku == "HW-BM-017"
    assert product_id is not None


def test_resolve_donor_product_unknown_sku_message() -> None:
    product_id, sku, error = _resolve_donor_product_id(
        None,
        {},
        "Find donors for SKU HW-XX-999.",
    )
    assert product_id is None
    assert sku == "HW-XX-999"
    assert error is not None
    assert error.status == "CLARIFICATION_REQUIRED"
    assert "HW-XX-999" in (error.message or "")


def test_enforce_donor_args_passes_min_safe_surplus() -> None:
    selection = ToolSelection(
        status="TOOL_SELECTED",
        tool_name="recommend_donor_stores",
        tool_args={
            "sku": "HW-BM-017",
            "min_safe_surplus": 40,
        },
    )
    resolved = enforce_trusted_arguments(
        selection,
        authenticated_store_id="store-1",
        selected_product_id=None,
        user_message="Find nearby stores with at least 40 units of SKU HW-BM-017.",
    )
    assert resolved.status == "TOOL_SELECTED"
    assert resolved.tool_args["min_safe_surplus"] == 40
    assert resolved.tool_args["store_id"] == "store-1"
    assert resolved.tool_args["product_id"]
