"""Great-circle distance in kilometres."""

from __future__ import annotations

from math import atan2, cos, radians, sin, sqrt

EARTH_RADIUS_KM = 6371.0
BAND_UNDER_15 = "under_15km"
BAND_15_30 = "km_15_30"
BAND_OVER_30 = "over_30km"
BAND_ORDER = (BAND_UNDER_15, BAND_15_30, BAND_OVER_30)
BAND_LABELS = {
    BAND_UNDER_15: "Under 15 km",
    BAND_15_30: "15–30 km",
    BAND_OVER_30: "Over 30 km",
}


def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1, phi2 = radians(lat1), radians(lat2)
    d_phi = radians(lat2 - lat1)
    d_lambda = radians(lon2 - lon1)
    a = sin(d_phi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(d_lambda / 2) ** 2
    return EARTH_RADIUS_KM * 2 * atan2(sqrt(a), sqrt(1 - a))


def radius_band(distance: float) -> str:
    if distance < 15:
        return BAND_UNDER_15
    if distance <= 30:
        return BAND_15_30
    return BAND_OVER_30
