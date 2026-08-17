"""Post-seed referential and business-rule validation."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from bson.decimal128 import Decimal128


def _dec(value: Any) -> Decimal:
    if isinstance(value, Decimal128):
        return value.to_decimal()
    return Decimal(str(value))


def _as_date(value: Any):
    if isinstance(value, datetime):
        return value.date()
    return value


class ValidationReport:
    def __init__(self) -> None:
        self.checks: list[tuple[str, bool, str]] = []

    def add(self, name: str, passed: bool, detail: str = "") -> None:
        self.checks.append((name, passed, detail))

    @property
    def ok(self) -> bool:
        return all(passed for _, passed, _ in self.checks)

    def print(self) -> None:
        print("\n=== VALIDATION REPORT ===")
        for name, passed, detail in self.checks:
            status = "PASS" if passed else "FAIL"
            suffix = f" — {detail}" if detail else ""
            print(f"[{status}] {name}{suffix}")
        print("=== OVERALL:", "PASS" if self.ok else "FAIL", "===\n")


def validate_dataset(db) -> ValidationReport:
    report = ValidationReport()

    products = list(db.products.find())
    stores = list(db.stores.find())
    suppliers = list(db.suppliers.find())
    supplier_products = list(db.supplier_products.find())
    inventory = list(db.inventory.find())
    sales = list(db.sales_daily.find())
    deliveries = list(db.supplier_deliveries.find())
    pos = list(db.purchase_orders.find())
    transfers = list(db.stock_transfers.find())
    promotions = list(db.promotions.find())
    weather = list(db.weather_daily.find())

    product_ids = {p["_id"] for p in products}
    store_ids = {s["_id"] for s in stores}
    supplier_ids = {s["_id"] for s in suppliers}
    weather_ids = {w["_id"] for w in weather}
    promo_ids = {p["_id"] for p in promotions}
    sp_pairs = {(sp["supplier_id"], sp["product_id"]) for sp in supplier_products}

    report.add("stores_count_10", len(stores) == 10, f"count={len(stores)}")
    report.add("products_count_50", len(products) == 50, f"count={len(products)}")
    report.add("suppliers_count_8", len(suppliers) == 8, f"count={len(suppliers)}")

    report.add(
        "inventory_covers_all_store_products",
        len(inventory) == len(stores) * len(products),
        f"count={len(inventory)}",
    )

    inv_pairs = {(i["store_id"], i["product_id"]) for i in inventory}
    expected_pairs = {(s["_id"], p["_id"]) for s in stores for p in products}
    report.add("inventory_pair_completeness", inv_pairs == expected_pairs)

    orphan_inv_stores = [i for i in inventory if i["store_id"] not in store_ids]
    orphan_inv_products = [i for i in inventory if i["product_id"] not in product_ids]
    report.add("no_orphan_inventory_store_ids", not orphan_inv_stores)
    report.add("no_orphan_inventory_product_ids", not orphan_inv_products)

    report.add(
        "reserved_le_on_hand",
        all(i["reserved"] <= i["on_hand"] for i in inventory),
    )
    report.add(
        "inventory_non_negative",
        all(i["on_hand"] >= 0 and i["reserved"] >= 0 and i["safety_stock"] >= 0 for i in inventory),
    )

    report.add(
        "retail_price_gt_cost",
        all(_dec(p["sell_price"]) > _dec(p["unit_cost"]) for p in products),
    )

    orphan_sp_sup = [sp for sp in supplier_products if sp["supplier_id"] not in supplier_ids]
    orphan_sp_prod = [sp for sp in supplier_products if sp["product_id"] not in product_ids]
    report.add("supplier_products_valid_suppliers", not orphan_sp_sup)
    report.add("supplier_products_valid_products", not orphan_sp_prod)

    products_with_supplier = {sp["product_id"] for sp in supplier_products}
    report.add(
        "every_product_has_supplier",
        product_ids <= products_with_supplier,
        f"missing={len(product_ids - products_with_supplier)}",
    )

    bad_po = [
        po
        for po in pos
        if po["supplier_id"] not in supplier_ids
        or po["store_id"] not in store_ids
        or po["product_id"] not in product_ids
        or (po["supplier_id"], po["product_id"]) not in sp_pairs
        or po["qty"] < 1
    ]
    report.add("purchase_orders_valid_relationships", not bad_po, f"bad={len(bad_po)}")

    bad_xfer = [
        t
        for t in transfers
        if t["from_store_id"] not in store_ids
        or t["to_store_id"] not in store_ids
        or t["product_id"] not in product_ids
        or t["from_store_id"] == t["to_store_id"]
        or t["qty"] < 1
    ]
    report.add("stock_transfers_valid", not bad_xfer, f"bad={len(bad_xfer)}")

    bad_del = []
    for d in deliveries:
        if d["supplier_id"] not in supplier_ids or d["product_id"] not in product_ids:
            bad_del.append(d)
            continue
        if d["ordered_qty"] < 1 or d["received_qty"] < 0:
            bad_del.append(d)
            continue
        if d["actual_date"] is not None and d["received_qty"] > d["ordered_qty"]:
            bad_del.append(d)
        if d["actual_date"] is None and d["received_qty"] != 0:
            bad_del.append(d)
    report.add("supplier_deliveries_consistent", not bad_del, f"bad={len(bad_del)}")

    bad_promo = [
        p
        for p in promotions
        if p["product_id"] not in product_ids
        or any(sid not in store_ids for sid in p["store_ids"])
        or _as_date(p["end_date"]) < _as_date(p["start_date"])
    ]
    report.add("promotions_valid", not bad_promo, f"bad={len(bad_promo)}")

    report.add("sales_non_negative", all(s["units_sold"] >= 0 for s in sales))
    orphan_sales = [
        s
        for s in sales
        if s["store_id"] not in store_ids or s["product_id"] not in product_ids
    ]
    report.add("sales_no_orphan_ids", not orphan_sales)

    bad_refs = [
        s
        for s in sales
        if (s.get("promotion_id") is not None and s["promotion_id"] not in promo_ids)
        or (s.get("weather_id") is not None and s["weather_id"] not in weather_ids)
    ]
    report.add("sales_promo_weather_refs", not bad_refs, f"bad={len(bad_refs)}")

    sales_dates = {_as_date(s["date"]) for s in sales}
    weather_dates = {_as_date(w["date"]) for w in weather}
    report.add(
        "weather_and_sales_same_period",
        sales_dates == weather_dates,
        f"sales_days={len(sales_dates)} weather_days={len(weather_dates)}",
    )

    sales_product_ids = {s["product_id"] for s in sales}
    sales_store_ids = {s["store_id"] for s in sales}
    report.add("all_products_have_sales", product_ids <= sales_product_ids)
    report.add("all_stores_have_sales", store_ids <= sales_store_ids)

    report.add("all_ten_adelaide_stores_present", len(stores) == 10)

    return report
