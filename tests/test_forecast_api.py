from typing import Iterator

import pytest
from fastapi.testclient import TestClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

from app.db import close_client, get_db, ping
from app.main import app


def _mongo_available() -> bool:
    try:
        ping()
        return True
    except (ConnectionFailure, ServerSelectionTimeoutError):
        return False
    finally:
        close_client()


@pytest.fixture()
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client
    close_client()


pytestmark = pytest.mark.skipif(
    not _mongo_available(),
    reason="MongoDB is not running",
)


def _drill_ids():
    db = get_db()
    product = db.products.find_one({"sku": "HW-PT-001"})
    cbd = db.stores.find_one({"name": "Adelaide CBD"})
    marion = db.stores.find_one({"name": "Marion"})
    assert product is not None and cbd is not None and marion is not None
    return str(product["_id"]), str(cbd["_id"]), str(marion["_id"])


def test_adelaide_drill_uses_lightgbm_when_trained(client: TestClient) -> None:
    from ml.lightgbm_model import model_available

    if not model_available():
        pytest.skip("LightGBM artifacts not trained")
    product_id, cbd_id, _ = _drill_ids()
    response = client.get(f"/api/v1/forecast/{cbd_id}/{product_id}")
    assert response.status_code == 200
    assert response.json()["method"] == "lightgbm_recursive_7d"


def test_adelaide_drill_forecast_is_high_risk(client: TestClient) -> None:
    product_id, cbd_id, _ = _drill_ids()
    response = client.get(f"/api/v1/forecast/{cbd_id}/{product_id}")
    assert response.status_code == 200
    payload = response.json()
    assert payload["sku"] == "HW-PT-001"
    assert payload["current_usable_stock"] == 70
    assert payload["safety_stock"] == 20
    assert payload["method"] in {"lightgbm_recursive_7d", "dow_28d_baseline"}
    assert payload["predicted_7d_demand"] > payload["current_usable_stock"]
    assert payload["predicted_shortage_qty"] > 0
    assert payload["risk"] == "HIGH"


def test_marion_drill_forecast_not_high_risk(client: TestClient) -> None:
    product_id, _, marion_id = _drill_ids()
    response = client.get(f"/api/v1/forecast/{marion_id}/{product_id}")
    assert response.status_code == 200
    payload = response.json()
    assert payload["current_usable_stock"] == 252
    assert payload["predicted_shortage_qty"] == 0
    assert payload["risk"] in {"LOW", "MEDIUM"}


def test_store_forecasts_covers_all_skus(client: TestClient) -> None:
    _, cbd_id, _ = _drill_ids()
    response = client.get(f"/api/v1/stores/{cbd_id}/forecasts")
    assert response.status_code == 200
    payload = response.json()
    assert len(payload["forecasts"]) == 20
    drill = next(row for row in payload["forecasts"] if row["sku"] == "HW-PT-001")
    assert drill["risk"] == "HIGH"
