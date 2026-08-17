"""Write sales_daily.jsonl from master JSON + sales_params.json."""

from __future__ import annotations

import json
import random
from datetime import date, datetime, timedelta
from pathlib import Path

from data.seed.loader import JSON_DIR

SALES_FILE = JSON_DIR / "sales_daily.jsonl"


def _daterange(start: date, end: date):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def _weekday_factor(day: date, category: str) -> float:
    wd = day.weekday()
    if wd <= 3:
        base = 0.90
    elif wd == 4:
        base = 1.05
    elif wd == 5:
        base = 1.25
    else:
        base = 1.10
    if category == "Power Tools" and wd >= 5:
        base *= 1.15
    return base


def build_sales_jsonl() -> Path:
    stores = json.loads((JSON_DIR / "stores.json").read_text(encoding="utf-8"))
    products = json.loads((JSON_DIR / "products.json").read_text(encoding="utf-8"))
    params = json.loads((JSON_DIR / "sales_params.json").read_text(encoding="utf-8"))

    rng = random.Random(params["random_seed"])
    start = date.fromisoformat(params["start_date"])
    end = date.fromisoformat(params["end_date"])
    store_mult = params["store_demand_mult"]
    baselines = params["product_baseline_daily"]
    product_by_id = {p["id"]: p for p in products}

    count = 0
    with SALES_FILE.open("w", encoding="utf-8") as handle:
        for day in _daterange(start, end):
            day_str = datetime(day.year, day.month, day.day).isoformat()
            for store in stores:
                for product in products:
                    sku = product["id"]
                    value = (
                        baselines[sku]
                        * store_mult[store["id"]]
                        * _weekday_factor(day, product_by_id[sku]["category"])
                        * max(0.0, rng.gauss(1.0, 0.10))
                    )
                    row = {
                        "date": day_str,
                        "store_id": store["id"],
                        "product_id": sku,
                        "units_sold": max(0, int(round(value))),
                        "sell_price": product["sell_price"],
                    }
                    handle.write(json.dumps(row) + "\n")
                    count += 1

    print(f"wrote {count} rows -> {SALES_FILE}")
    return SALES_FILE


if __name__ == "__main__":
    build_sales_jsonl()
