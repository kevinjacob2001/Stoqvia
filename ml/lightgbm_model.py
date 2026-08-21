"""LightGBM demand model load / save / predict."""

from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"
MODEL_PATH = ARTIFACT_DIR / "demand_lgbm.txt"
META_PATH = ARTIFACT_DIR / "meta.json"

_model = None
_meta: Optional[Dict[str, Any]] = None


def model_available() -> bool:
    return MODEL_PATH.exists() and META_PATH.exists()


def load_model():
    global _model, _meta
    if _model is not None and _meta is not None:
        return _model, _meta
    if not model_available():
        return None, None
    import lightgbm as lgb

    _model = lgb.Booster(model_file=str(MODEL_PATH))
    _meta = json.loads(META_PATH.read_text(encoding="utf-8"))
    return _model, _meta


def save_model(booster, meta: Dict[str, Any]) -> None:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    booster.save_model(str(MODEL_PATH))
    META_PATH.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    global _model, _meta
    _model = booster
    _meta = meta


def reset_cache() -> None:
    global _model, _meta
    _model = None
    _meta = None


def _row(
    day: date,
    history: Sequence[float],
    store_idx: int,
    product_idx: int,
) -> List[float]:
    lag_1 = history[-1] if history else 0.0
    lag_7 = history[-7] if len(history) >= 7 else lag_1
    window = history[-7:] if history else [0.0]
    rolling = sum(window) / len(window)
    return [
        float(day.weekday()),
        1.0 if day.weekday() >= 5 else 0.0,
        float(day.month),
        float(lag_1),
        float(lag_7),
        float(rolling),
        float(store_idx),
        float(product_idx),
    ]


def predict_7d(
    series: Sequence[Tuple[date, int]],
    horizon_start: date,
    store_id: str,
    product_id: str,
    horizon_days: int = 7,
) -> Optional[int]:
    model, meta = load_model()
    if model is None or meta is None:
        return None

    store_map: Dict[str, int] = meta["store_idx"]
    product_map: Dict[str, int] = meta["product_idx"]
    if store_id not in store_map or product_id not in product_map:
        return None

    history = [float(units) for _, units in sorted(series, key=lambda item: item[0])]
    if not history:
        return None

    import numpy as np

    store_idx = store_map[store_id]
    product_idx = product_map[product_id]
    total = 0.0
    for offset in range(horizon_days):
        day = horizon_start + timedelta(days=offset)
        features = np.asarray(
            [_row(day, history, store_idx, product_idx)],
            dtype=np.float32,
        )
        raw = np.asarray(model.predict(features)).reshape(-1)
        predicted = max(0.0, float(raw[0]))
        total += predicted
        history.append(predicted)
    return int(round(total))
