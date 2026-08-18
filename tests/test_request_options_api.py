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


def _login(client: TestClient, username: str, password: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200
    return response.json()["token"]


def _drill_id() -> str:
    db = get_db()
    product = db.products.find_one({"sku": "HW-PT-001"})
    assert product is not None
    return str(product["_id"])


def test_request_options_requires_auth(client: TestClient) -> None:
    response = client.get(f"/api/v1/me/products/{_drill_id()}/request-options")
    assert response.status_code == 401


def test_cbd_drill_options_include_marion_and_supplier(client: TestClient) -> None:
    token = _login(client, "admin.cbd", "cbd123")
    response = client.get(
        f"/api/v1/me/products/{_drill_id()}/request-options",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["sku"] == "HW-PT-001"
    assert payload["requested_qty"] > 0
    donors = [store for group in payload["nearby_groups"] for store in group["stores"]]
    names = {row["store_name"] for row in donors}
    assert "Adelaide CBD" not in names
    assert {"Marion", "Mile End", "Modbury"} <= names
    assert len(donors) >= 2
    marion = next(row for row in donors if row["store_name"] == "Marion")
    assert marion["safe_surplus"] >= 1
    assert marion["recommended_qty"] == min(payload["requested_qty"], marion["safe_surplus"])
    assert payload["supplier"] is not None
    assert payload["supplier"]["name"] == "Southern Precision Supply"


def test_options_rejected_when_not_high(client: TestClient) -> None:
    token = _login(client, "admin.cbd", "cbd123")
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/api/v1/auth/me", headers=headers).json()
    forecasts = client.get(
        f"/api/v1/stores/{me['store_id']}/forecasts",
        headers=headers,
    ).json()["forecasts"]
    safe = next((row for row in forecasts if row["risk"] != "HIGH"), None)
    if safe is None:
        pytest.skip("no non-HIGH product at Adelaide CBD")
    response = client.get(
        f"/api/v1/me/products/{safe['product_id']}/request-options",
        headers=headers,
    )
    assert response.status_code == 400
