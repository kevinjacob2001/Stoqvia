from datetime import date, timedelta

from app.models.forecast import calculate_safe_surplus, calculate_shortage, classify_risk
from app.services.forecast_service import average_by_weekday, predict_horizon


def test_shortage_includes_safety_stock() -> None:
    # usable 70, demand 110, safety 20 → short 60
    assert calculate_shortage(70, 110, 20) == 60


def test_shortage_zero_when_cover_includes_safety() -> None:
    assert calculate_shortage(252, 100, 25) == 0


def test_safe_surplus_is_stock_minus_forecast_and_safety() -> None:
    assert calculate_safe_surplus(252, 100, 25) == 127


def test_risk_high_when_shortage() -> None:
    assert classify_risk(60, -40, 20) == "HIGH"


def test_risk_medium_when_buffer_thin() -> None:
    assert classify_risk(0, 30, 20) == "MEDIUM"


def test_risk_low_when_comfortable_buffer() -> None:
    assert classify_risk(0, 150, 25) == "LOW"


def test_weekday_average_and_horizon_sum() -> None:
    start = date(2026, 8, 3)  # Monday
    series = []
    for i in range(28):
        day = start + timedelta(days=i)
        # 10 on weekdays, 20 on weekends
        units = 20 if day.weekday() >= 5 else 10
        series.append((day, units))
    averages = average_by_weekday(series)
    assert averages[0] == 10
    assert averages[5] == 20
    horizon_start = date(2026, 8, 31)  # Monday
    predicted = predict_horizon(averages, 0.0, horizon_start, 7)
    # Mon-Fri 10*5 + Sat-Sun 20*2 = 90
    assert predicted == 90
