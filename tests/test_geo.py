from app.services.geo import distance_km, radius_band, transit_lead_days


def test_adelaide_to_marion_is_under_15km() -> None:
    kilometres = distance_km(-34.9285, 138.6007, -35.0152, 138.5495)
    assert 8 < kilometres < 15
    assert radius_band(kilometres) == "under_15km"
    assert transit_lead_days(kilometres) == 1


def test_radius_bands() -> None:
    assert radius_band(0) == "under_15km"
    assert radius_band(15) == "km_15_30"
    assert radius_band(30) == "km_15_30"
    assert radius_band(30.1) == "over_30km"


def test_transit_lead_days_by_band() -> None:
    assert transit_lead_days(5) == 1
    assert transit_lead_days(20) == 2
    assert transit_lead_days(40) == 3
