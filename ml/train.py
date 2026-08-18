"""Train a LightGBM next-day demand model from MongoDB sales_daily.

Usage (from repo root):
    PYTHONPATH=.:backend backend/.venv/bin/python -m ml.train
"""

from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np
from bson import ObjectId

_REPO_ROOT = Path(__file__).resolve().parents[1]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))
_BACKEND = _REPO_ROOT / "backend"
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

import lightgbm as lgb

from app.db import close_client, get_db, ping
from ml.features import FEATURE_COLUMNS
from ml.lightgbm_model import reset_cache, save_model


def _as_date(value: Any):
    if isinstance(value, datetime):
        return value.date()
    return value


def _build_training_rows(db) -> Tuple[List[List[float]], List[float], Dict[str, int], Dict[str, int]]:
    store_idx = {str(store["_id"]): i for i, store in enumerate(db.stores.find().sort("name", 1))}
    product_idx = {str(product["_id"]): i for i, product in enumerate(db.products.find().sort("sku", 1))}

    rows: List[List[float]] = []
    labels: List[float] = []

    for store_id, s_idx in store_idx.items():
        for product_id, p_idx in product_idx.items():
            sales = list(
                db.sales_daily.find(
                    {
                        "store_id": ObjectId(store_id),
                        "product_id": ObjectId(product_id),
                    }
                ).sort("date", 1)
            )
            history: List[float] = []
            for doc in sales:
                day = _as_date(doc["date"])
                units = float(doc["units_sold"])
                if len(history) >= 7:
                    rows.append(
                        [
                            float(day.weekday()),
                            1.0 if day.weekday() >= 5 else 0.0,
                            float(day.month),
                            history[-1],
                            history[-7],
                            sum(history[-7:]) / 7.0,
                            float(s_idx),
                            float(p_idx),
                        ]
                    )
                    labels.append(units)
                history.append(units)

    return rows, labels, store_idx, product_idx


def train() -> Dict[str, Any]:
    ping()
    db = get_db()
    rows, labels, store_idx, product_idx = _build_training_rows(db)
    if len(rows) < 100:
        raise RuntimeError(f"Not enough training rows: {len(rows)}")

    features = np.asarray(rows, dtype=np.float32)
    targets = np.asarray(labels, dtype=np.float32)
    dataset = lgb.Dataset(
        features,
        label=targets,
        feature_name=FEATURE_COLUMNS,
        free_raw_data=False,
    )
    params = {
        "objective": "regression",
        "metric": "rmse",
        "learning_rate": 0.05,
        "num_leaves": 31,
        "min_data_in_leaf": 20,
        "verbosity": -1,
        "seed": 42,
        "force_row_wise": True,
    }
    booster = lgb.train(params, dataset, num_boost_round=120)
    meta = {
        "feature_columns": FEATURE_COLUMNS,
        "store_idx": store_idx,
        "product_idx": product_idx,
        "n_rows": len(rows),
        "method": "lightgbm_recursive_7d",
    }
    save_model(booster, meta)
    reset_cache()
    print(f"trained LightGBM on {len(rows)} rows")
    print(f"stores={len(store_idx)} products={len(product_idx)}")
    return meta


def main() -> None:
    try:
        train()
    finally:
        close_client()


if __name__ == "__main__":
    main()
