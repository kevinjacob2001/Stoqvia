import pytest

from app.services.inventory_service import calculate_usable_stock


def test_usable_stock_subtracts_reserved() -> None:
    assert calculate_usable_stock(80, 10) == 70


def test_usable_stock_zero_when_fully_reserved() -> None:
    assert calculate_usable_stock(12, 12) == 0


def test_usable_stock_never_negative() -> None:
    assert calculate_usable_stock(5, 9) == 0


def test_usable_stock_rejects_negative_inputs() -> None:
    with pytest.raises(ValueError):
        calculate_usable_stock(-1, 0)
    with pytest.raises(ValueError):
        calculate_usable_stock(1, -1)


def test_inventory_item_usable_matches_formula() -> None:
    from app.models.inventory import InventoryItem

    item = InventoryItem(
        store_id="s1",
        store_name="Adelaide CBD",
        product_id="p1",
        sku="HW-PT-001",
        product_name="Cordless Drill 18V",
        on_hand=80,
        reserved=10,
        usable_stock=70,
        safety_stock=20,
    )
    assert item.usable_stock == calculate_usable_stock(item.on_hand, item.reserved)
