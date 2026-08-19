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
    db = get_db()
    db.stock_transfers.delete_many({})
    with TestClient(app) as test_client:
        yield test_client
    close_client()


pytestmark = pytest.mark.skipif(
    not _mongo_available(),
    reason="MongoDB is not running",
)


def _login(client: TestClient, username: str, password: str) -> dict:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200
    return response.json()


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _drill_and_stores():
    db = get_db()
    product = db.products.find_one({"sku": "HW-PT-001"})
    marion = db.stores.find_one({"name": "Marion"})
    mile = db.stores.find_one({"name": "Mile End"})
    modbury = db.stores.find_one({"name": "Modbury"})
    assert product is not None and marion is not None and mile is not None and modbury is not None
    return str(product["_id"]), str(marion["_id"]), str(mile["_id"]), str(modbury["_id"])


def test_empty_tables_before_any_request(client: TestClient) -> None:
    token = _login(client, "admin.modbury", "modbury123")["token"]
    response = client.get("/api/v1/me/transfers", headers=_auth(token))
    assert response.status_code == 200
    payload = response.json()
    assert payload["outgoing"] == []
    assert payload["incoming"] == []


def test_broadcast_appears_in_outgoing_and_incoming(client: TestClient) -> None:
    product_id, marion_id, mile_id, _modbury_id = _drill_and_stores()
    cbd = _login(client, "admin.cbd", "cbd123")
    created = client.post(
        "/api/v1/me/transfers",
        headers=_auth(cbd["token"]),
        json={"product_id": product_id, "donor_store_ids": [marion_id, mile_id]},
    )
    assert created.status_code == 200
    assert created.json()["status"] == "OPEN"
    assert {row["store_id"] for row in created.json()["invited"]} == {marion_id, mile_id}

    outgoing = client.get("/api/v1/me/transfers", headers=_auth(cbd["token"])).json()
    assert len(outgoing["outgoing"]) == 1
    assert outgoing["incoming"] == []
    assert "Marion" in [row["store_name"] for row in outgoing["outgoing"][0]["invited"]]

    marion = _login(client, "admin.marion", "marion123")
    marion_box = client.get("/api/v1/me/transfers", headers=_auth(marion["token"])).json()
    assert len(marion_box["incoming"]) == 1
    assert marion_box["outgoing"] == []
    assert marion_box["incoming"][0]["requester_store_name"] == "Adelaide CBD"
    assert marion_box["incoming"][0]["my_status"] == "PENDING"

    modbury = _login(client, "admin.modbury", "modbury123")
    modbury_box = client.get("/api/v1/me/transfers", headers=_auth(modbury["token"])).json()
    assert modbury_box["incoming"] == []


def test_cannot_broadcast_twice_while_open(client: TestClient) -> None:
    product_id, marion_id, _, _ = _drill_and_stores()
    token = _login(client, "admin.cbd", "cbd123")["token"]
    first = client.post(
        "/api/v1/me/transfers",
        headers=_auth(token),
        json={"product_id": product_id, "donor_store_ids": [marion_id]},
    )
    assert first.status_code == 200
    second = client.post(
        "/api/v1/me/transfers",
        headers=_auth(token),
        json={"product_id": product_id, "donor_store_ids": [marion_id]},
    )
    assert second.status_code == 409


def test_create_transfer_requires_auth(client: TestClient) -> None:
    product_id, marion_id, _, _ = _drill_and_stores()
    response = client.post(
        "/api/v1/me/transfers",
        json={"product_id": product_id, "donor_store_ids": [marion_id]},
    )
    assert response.status_code == 401


def test_transfer_detail_visible_to_requester(client: TestClient) -> None:
    product_id, marion_id, mile_id, _ = _drill_and_stores()
    cbd = _login(client, "admin.cbd", "cbd123")
    created = client.post(
        "/api/v1/me/transfers",
        headers=_auth(cbd["token"]),
        json={"product_id": product_id, "donor_store_ids": [marion_id, mile_id]},
    )
    assert created.status_code == 200
    transfer_id = created.json()["transfer_id"]

    detail = client.get(f"/api/v1/me/transfers/{transfer_id}", headers=_auth(cbd["token"]))
    assert detail.status_code == 200
    payload = detail.json()
    assert payload["transfer_id"] == transfer_id
    assert payload["requester_store_name"] == "Adelaide CBD"
    assert payload["product_name"]
    assert len(payload["invited"]) == 2
    assert payload["events"][0]["action"] == "REQUESTED"
