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


def _drill_and_stores():
    db = get_db()
    product = db.products.find_one({"sku": "HW-PT-001"})
    cbd = db.stores.find_one({"name": "Adelaide CBD"})
    marion = db.stores.find_one({"name": "Marion"})
    assert product is not None
    assert cbd is not None
    assert marion is not None
    return str(product["_id"]), str(cbd["_id"]), str(marion["_id"])


def test_list_stores(client: TestClient) -> None:
    response = client.get("/api/v1/stores")
    assert response.status_code == 200
    names = {row["name"] for row in response.json()}
    assert names == {"Adelaide CBD", "Marion", "Mile End", "Modbury"}


def test_store_inventory_adelaide_drill(client: TestClient) -> None:
    _, cbd_id, _ = _drill_and_stores()
    response = client.get(f"/api/v1/stores/{cbd_id}/inventory")
    assert response.status_code == 200
    payload = response.json()
    assert payload["store_name"] == "Adelaide CBD"
    assert payload["item_count"] == 20
    drill = next(item for item in payload["items"] if item["sku"] == "HW-PT-001")
    assert drill["on_hand"] == 80
    assert drill["reserved"] == 10
    assert drill["usable_stock"] == 70
    assert drill["safety_stock"] == 20


def test_product_inventory_at_store(client: TestClient) -> None:
    product_id, cbd_id, _ = _drill_and_stores()
    response = client.get(f"/api/v1/stores/{cbd_id}/products/{product_id}/inventory")
    assert response.status_code == 200
    payload = response.json()
    assert payload["usable_stock"] == payload["on_hand"] - payload["reserved"]
    assert payload["usable_stock"] == 70


def test_network_inventory_includes_marion_surplus(client: TestClient) -> None:
    product_id, _, _ = _drill_and_stores()
    response = client.get(f"/api/v1/products/{product_id}/network-inventory")
    assert response.status_code == 200
    payload = response.json()
    assert payload["sku"] == "HW-PT-001"
    assert payload["store_count"] == 4
    by_store = {row["store_name"]: row for row in payload["stores"]}
    assert by_store["Adelaide CBD"]["usable_stock"] == 70
    assert by_store["Marion"]["on_hand"] == 260
    assert by_store["Marion"]["usable_stock"] == 252
    assert payload["total_usable_stock"] == sum(row["usable_stock"] for row in payload["stores"])


def test_invalid_store_id_returns_400(client: TestClient) -> None:
    response = client.get("/api/v1/stores/not-an-id/inventory")
    assert response.status_code == 400


def test_missing_store_returns_404(client: TestClient) -> None:
    response = client.get("/api/v1/stores/000000000000000000000000/inventory")
    assert response.status_code == 404
