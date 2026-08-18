"""Shared feature columns for the demand model."""

FEATURE_COLUMNS = [
    "weekday",
    "is_weekend",
    "month",
    "lag_1",
    "lag_7",
    "rolling_mean_7",
    "store_idx",
    "product_idx",
]
