"""Post-seed referential and business-rule validation."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from bson.decimal128 import Decimal128

EXPECTED_STORE_NAMES = ("Adelaide CBD", "Marion", "Mile End", "Modbury")
EXPECTED_USERNAMES = ("admin.cbd", "admin.marion", "admin.mileend", "admin.modbury")
DEMO_DRILL_SKU = "HW-PT-001"


def _dec(value: Any) -> Decimal:
    if isinstance(value, Decimal128):
        return value.to_decimal()
    return Decimal(str(value))


class ValidationReport:
    def __init__(self) -> None:
        self.checks: list[tuple[str, bool, str]] = []

    def add(self, name: str, passed: bool, detail: str = "") -> None:
        self.checks.append((name, passed, detail))

    @property
    def ok(self) -> bool:
        return all(passed for _, passed, _ in self.checks)

    def print_report(self) -> None:
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
    pos = list(db.purchase_orders.find())
    transfers = list(db.stock_transfers.find())
    users = list(db.store_users.find())

    product_ids = {p["_id"] for p in products}
    store_ids = {s["_id"] for s in stores}
    supplier_ids = {s["_id"] for s in suppliers}
    sp_pairs = {(sp["supplier_id"], sp["product_id"]) for sp in supplier_products}

    report.add("stores_count_4", len(stores) == 4, f"count={len(stores)}")
    report.add("products_count_20", len(products) == 20, f"count={len(products)}")
    report.add("suppliers_count_3", len(suppliers) == 3, f"count={len(suppliers)}")

    names = {s["name"] for s in stores}
    report.add(
        "expected_adelaide_stores",
        set(EXPECTED_STORE_NAMES) == names,
        f"names={sorted(names)}",
    )

    report.add(
        "inventory_covers_all_store_products",
        len(inventory) == len(stores) * len(products),
        f"count={len(inventory)}",
    )

    inv_pairs = {(i["store_id"], i["product_id"]) for i in inventory}
    expected_pairs = {(s["_id"], p["_id"]) for s in stores for p in products}
    report.add("inventory_pair_completeness", inv_pairs == expected_pairs)

    report.add("no_orphan_inventory_store_ids", all(i["store_id"] in store_ids for i in inventory))
    report.add("no_orphan_inventory_product_ids", all(i["product_id"] in product_ids for i in inventory))
    report.add("reserved_le_on_hand", all(i["reserved"] <= i["on_hand"] for i in inventory))
    report.add(
        "inventory_non_negative",
        all(i["on_hand"] >= 0 and i["reserved"] >= 0 and i["safety_stock"] >= 0 for i in inventory),
    )
    report.add(
        "retail_price_gt_cost",
        all(_dec(p["sell_price"]) > _dec(p["unit_cost"]) for p in products),
    )

    report.add(
        "supplier_products_valid_suppliers",
        all(sp["supplier_id"] in supplier_ids for sp in supplier_products),
    )
    report.add(
        "supplier_products_valid_products",
        all(sp["product_id"] in product_ids for sp in supplier_products),
    )
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

    report.add("store_users_count_4", len(users) == 4, f"count={len(users)}")
    report.add(
        "store_users_expected_usernames",
        {u["username"] for u in users} == set(EXPECTED_USERNAMES),
        f"usernames={sorted(u['username'] for u in users)}",
    )
    report.add("store_users_one_per_store", {u["store_id"] for u in users} == store_ids)
    report.add("store_users_valid_store_ids", all(u["store_id"] in store_ids for u in users))
    report.add(
        "store_users_hashed_not_plaintext",
        all("password_hash" in u and "password" not in u for u in users),
    )

    report.add("sales_non_negative", all(s["units_sold"] >= 0 for s in sales))
    report.add(
        "sales_no_orphan_ids",
        all(s["store_id"] in store_ids and s["product_id"] in product_ids for s in sales),
    )
    report.add("all_products_have_sales", {s["product_id"] for s in sales} >= product_ids)
    report.add("all_stores_have_sales", {s["store_id"] for s in sales} >= store_ids)

    drill = next((p for p in products if p["sku"] == DEMO_DRILL_SKU), None)
    cbd = next((s for s in stores if s["name"] == "Adelaide CBD"), None)
    marion = next((s for s in stores if s["name"] == "Marion"), None)
    if drill and cbd and marion:
        cbd_inv = next(
            i for i in inventory if i["store_id"] == cbd["_id"] and i["product_id"] == drill["_id"]
        )
        mar_inv = next(
            i for i in inventory if i["store_id"] == marion["_id"] and i["product_id"] == drill["_id"]
        )
        report.add(
            "demo_adelaide_drill_low",
            cbd_inv["on_hand"] == 80 and cbd_inv["reserved"] == 10 and cbd_inv["safety_stock"] == 20,
            f"on_hand={cbd_inv['on_hand']}",
        )
        report.add(
            "demo_marion_drill_high",
            mar_inv["on_hand"] == 260 and mar_inv["safety_stock"] == 25,
            f"on_hand={mar_inv['on_hand']}",
        )
        report.add("demo_adelaide_usable_70", cbd_inv["on_hand"] - cbd_inv["reserved"] == 70)

        mile = next((s for s in stores if s["name"] == "Mile End"), None)
        modbury = next((s for s in stores if s["name"] == "Modbury"), None)
        if mile and modbury:
            mile_inv = next(
                i for i in inventory if i["store_id"] == mile["_id"] and i["product_id"] == drill["_id"]
            )
            mod_inv = next(
                i
                for i in inventory
                if i["store_id"] == modbury["_id"] and i["product_id"] == drill["_id"]
            )
            report.add(
                "demo_mile_end_drill_surplus",
                mile_inv["on_hand"] == 240 and mile_inv["reserved"] == 2,
                f"on_hand={mile_inv['on_hand']}",
            )
            report.add(
                "demo_modbury_drill_surplus",
                mod_inv["on_hand"] == 210 and mod_inv["reserved"] == 2,
                f"on_hand={mod_inv['on_hand']}",
            )

    return report
