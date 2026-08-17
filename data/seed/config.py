"""Shared constants for synthetic seed data."""

from datetime import date

RANDOM_SEED = 42

# ~24 months of history ending just before "today" in project context
SALES_END_DATE = date(2026, 8, 7)
SALES_START_DATE = date(2024, 8, 8)

PRODUCT_COUNT = 50
STORE_COUNT = 10
SUPPLIER_COUNT = 8

CATEGORIES = (
    "Power Tools",
    "Hand Tools",
    "Timber",
    "Paint",
    "Plumbing",
    "Electrical",
    "Garden",
    "Building Materials",
)

# Categories influenced by warm/dry weather (Adelaide summer boost)
WARM_WEATHER_CATEGORIES = frozenset({"Garden", "Paint", "Building Materials"})
# Categories hit by wet/severe weather
WET_WEATHER_CATEGORIES = frozenset({"Garden", "Paint", "Timber"})

# Demo scenario keys (resolved after generation)
DEMO_DRILL_SKU = "HW-PT-001"
DEMO_CBD_NAME = "Adelaide CBD"
DEMO_MARION_NAME = "Marion"
