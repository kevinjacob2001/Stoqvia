from datetime import date, timedelta

from ml.features import FEATURE_COLUMNS
from ml.lightgbm_model import _row, predict_7d, reset_cache


def test_feature_row_shape() -> None:
    history = [10.0, 11.0, 9.0, 12.0, 10.0, 20.0, 18.0]
    row = _row(date(2026, 8, 17), history, store_idx=0, product_idx=1)
    assert len(row) == len(FEATURE_COLUMNS)
    assert row[0] == 0.0  # Monday
    assert row[1] == 0.0
    assert row[3] == 18.0
    assert row[4] == 10.0


def test_predict_returns_none_for_unknown_ids_or_missing_model() -> None:
    reset_cache()
    series = [(date(2026, 8, 10) + timedelta(days=i), 10) for i in range(14)]
    result = predict_7d(series, date(2026, 8, 24), "missing-store", "missing-product")
    assert result is None
