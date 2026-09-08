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
    db.purchase_orders.delete_many({})
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
    response = client.get("/api/v1/transfers", headers=_auth(token))
    assert response.status_code == 200
    payload = response.json()
    assert payload["outgoing"] == []
    assert payload["incoming"] == []


def test_broadcast_appears_in_outgoing_and_incoming(client: TestClient) -> None:
    product_id, marion_id, mile_id, _modbury_id = _drill_and_stores()
    cbd = _login(client, "admin.cbd", "cbd123")
    created = client.post(
        "/api/v1/transfers",
        headers=_auth(cbd["token"]),
        json={"product_id": product_id, "donor_store_ids": [marion_id, mile_id]},
    )
    assert created.status_code == 200
    assert created.json()["status"] == "OPEN"
    assert {row["store_id"] for row in created.json()["invited"]} == {marion_id, mile_id}

    outgoing = client.get("/api/v1/transfers", headers=_auth(cbd["token"])).json()
    assert len(outgoing["outgoing"]) == 1
    assert outgoing["incoming"] == []
    assert "Marion" in [row["store_name"] for row in outgoing["outgoing"][0]["invited"]]

    marion = _login(client, "admin.marion", "marion123")
    marion_box = client.get("/api/v1/transfers", headers=_auth(marion["token"])).json()
    assert len(marion_box["incoming"]) == 1
    assert marion_box["outgoing"] == []
    assert marion_box["incoming"][0]["requester_store_name"] == "Adelaide CBD"
    assert marion_box["incoming"][0]["my_status"] == "PENDING"
    assert marion_box["incoming"][0]["requester_distance_km"] is not None

    modbury = _login(client, "admin.modbury", "modbury123")
    modbury_box = client.get("/api/v1/transfers", headers=_auth(modbury["token"])).json()
    assert modbury_box["incoming"] == []


def test_cannot_broadcast_twice_while_open(client: TestClient) -> None:
    product_id, marion_id, _, _ = _drill_and_stores()
    token = _login(client, "admin.cbd", "cbd123")["token"]
    first = client.post(
        "/api/v1/transfers",
        headers=_auth(token),
        json={"product_id": product_id, "donor_store_ids": [marion_id]},
    )
    assert first.status_code == 200
    assert first.json()["product_id"] == product_id
    second = client.post(
        "/api/v1/transfers",
        headers=_auth(token),
        json={"product_id": product_id, "donor_store_ids": [marion_id]},
    )
    assert second.status_code == 409
    assert "already requested or in transit" in second.json()["detail"]


def test_cannot_request_again_while_in_transit(client: TestClient) -> None:
    product_id, marion_id, _, _ = _drill_and_stores()
    cbd = _login(client, "admin.cbd", "cbd123")
    created = client.post(
        "/api/v1/transfers",
        headers=_auth(cbd["token"]),
        json={"product_id": product_id, "donor_store_ids": [marion_id]},
    )
    assert created.status_code == 200
    transfer_id = created.json()["transfer_id"]

    marion = _login(client, "admin.marion", "marion123")
    accept = client.post(
        f"/api/v1/transfers/{transfer_id}/respond",
        headers=_auth(marion["token"]),
        json={"action": "ACCEPT"},
    )
    assert accept.status_code == 200
    dispatch = client.post(
        f"/api/v1/transfers/{transfer_id}/dispatch",
        headers=_auth(marion["token"]),
    )
    assert dispatch.status_code == 200
    assert dispatch.json()["status"] in ("IN_TRANSIT", "FULFILLED", "OPEN")

    again = client.post(
        "/api/v1/transfers",
        headers=_auth(cbd["token"]),
        json={"product_id": product_id, "donor_store_ids": [marion_id]},
    )
    assert again.status_code == 409


def test_create_transfer_requires_auth(client: TestClient) -> None:
    product_id, marion_id, _, _ = _drill_and_stores()
    response = client.post(
        "/api/v1/transfers",
        json={"product_id": product_id, "donor_store_ids": [marion_id]},
    )
    assert response.status_code == 401


def test_create_transfer_allows_qty_above_shortage(client: TestClient) -> None:
    product_id, marion_id, mile_id, _ = _drill_and_stores()
    cbd = _login(client, "admin.cbd", "cbd123")
    options = client.get(
        f"/api/v1/me/products/{product_id}/request-options",
        headers=_auth(cbd["token"]),
    )
    assert options.status_code == 200
    shortage = options.json()["requested_qty"]
    assert shortage >= 1

    created = client.post(
        "/api/v1/transfers",
        headers=_auth(cbd["token"]),
        json={
            "product_id": product_id,
            "donor_store_ids": [marion_id, mile_id],
            "qty": shortage + 25,
        },
    )
    assert created.status_code == 200
    assert created.json()["qty"] == shortage + 25


def test_transfer_detail_visible_to_requester(client: TestClient) -> None:
    product_id, marion_id, mile_id, _ = _drill_and_stores()
    cbd = _login(client, "admin.cbd", "cbd123")
    created = client.post(
        "/api/v1/transfers",
        headers=_auth(cbd["token"]),
        json={"product_id": product_id, "donor_store_ids": [marion_id, mile_id]},
    )
    assert created.status_code == 200
    transfer_id = created.json()["transfer_id"]

    detail = client.get(f"/api/v1/transfers/{transfer_id}", headers=_auth(cbd["token"]))
    assert detail.status_code == 200
    payload = detail.json()
    assert payload["transfer_id"] == transfer_id
    assert payload["requester_store_name"] == "Adelaide CBD"
    assert payload["product_name"]
    assert len(payload["invited"]) == 2
    assert payload["events"][0]["action"] == "REQUESTED"


def test_empty_donors_rejected_when_network_stores_exist(client: TestClient) -> None:
    product_id, _marion_id, _mile_id, _ = _drill_and_stores()
    cbd = _login(client, "admin.cbd", "cbd123")
    created = client.post(
        "/api/v1/transfers",
        headers=_auth(cbd["token"]),
        json={"product_id": product_id, "donor_store_ids": []},
    )
    assert created.status_code == 400


def test_supplier_only_when_no_safe_donors(client: TestClient) -> None:
    logins = [
        ("admin.cbd", "cbd123"),
        ("admin.marion", "marion123"),
        ("admin.mileend", "mileend123"),
        ("admin.modbury", "modbury123"),
    ]
    db = get_db()
    products = list(db.products.find())
    for username, password in logins:
        session = _login(client, username, password)
        for product in products:
            options = client.get(
                f"/api/v1/me/products/{product['_id']}/request-options",
                headers=_auth(session["token"]),
            )
            if options.status_code != 200:
                continue
            payload = options.json()
            donors = [store for group in payload["nearby_groups"] for store in group["stores"]]
            if donors or payload.get("supplier") is None:
                continue
            created = client.post(
                "/api/v1/transfers",
                headers=_auth(session["token"]),
                json={"product_id": str(product["_id"]), "donor_store_ids": []},
            )
            assert created.status_code == 200
            body = created.json()
            assert body["invited"] == []
            assert body.get("note") in (None, "")
            assert any(alloc["source"] == "supplier" for alloc in body["allocations"])
            return
    pytest.skip("Seed has no HIGH product without donor stores")
