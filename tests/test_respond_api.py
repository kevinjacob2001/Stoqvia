"""Phase 6: Accept / Decline / Check stock tests."""

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
    r = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200
    return r.json()


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _drill_ids():
    db = get_db()
    product = db.products.find_one({"sku": "HW-PT-001"})
    marion = db.stores.find_one({"name": "Marion"})
    mile = db.stores.find_one({"name": "Mile End"})
    assert product and marion and mile
    return str(product["_id"]), str(marion["_id"]), str(mile["_id"])


def _broadcast(client, cbd_token, product_id, donor_ids):
    r = client.post(
        "/api/v1/transfers",
        headers=_auth(cbd_token),
        json={"product_id": product_id, "donor_store_ids": donor_ids},
    )
    assert r.status_code == 200
    return r.json()["transfer_id"]


def _respond(client, token, transfer_id, action):
    return client.post(
        f"/api/v1/transfers/{transfer_id}/respond",
        headers=_auth(token),
        json={"action": action},
    )


# --- Accept ---

def test_accept_closes_request_and_passes_others(client: TestClient) -> None:
    product_id, marion_id, mile_id = _drill_ids()
    cbd = _login(client, "admin.cbd", "cbd123")
    tid = _broadcast(client, cbd["token"], product_id, [marion_id, mile_id])

    marion = _login(client, "admin.marion", "marion123")
    r = _respond(client, marion["token"], tid, "ACCEPT")
    assert r.status_code == 200
    payload = r.json()
    assert payload["my_status"] == "ACCEPTED"

    # Request should now be FULFILLED
    db = get_db()
    from bson import ObjectId
    doc = db.stock_transfers.find_one({"_id": ObjectId(tid)})
    assert doc is not None
    assert doc["status"] == "FULFILLED"

    # Mile End should be PASSED
    mile_invite = next(inv for inv in doc["invited"] if str(inv["store_id"]) == mile_id)
    assert mile_invite["status"] == "PASSED"


def test_second_accept_rejected_after_first(client: TestClient) -> None:
    product_id, marion_id, mile_id = _drill_ids()
    cbd = _login(client, "admin.cbd", "cbd123")
    tid = _broadcast(client, cbd["token"], product_id, [marion_id, mile_id])

    marion = _login(client, "admin.marion", "marion123")
    _respond(client, marion["token"], tid, "ACCEPT")

    mile = _login(client, "admin.mileend", "mileend123")
    r = _respond(client, mile["token"], tid, "ACCEPT")
    assert r.status_code == 409


def test_decline_local_others_unaffected(client: TestClient) -> None:
    product_id, marion_id, mile_id = _drill_ids()
    cbd = _login(client, "admin.cbd", "cbd123")
    tid = _broadcast(client, cbd["token"], product_id, [marion_id, mile_id])

    marion = _login(client, "admin.marion", "marion123")
    r = _respond(client, marion["token"], tid, "DECLINE")
    assert r.status_code == 200
    assert r.json()["my_status"] == "DECLINED"

    # Request still OPEN; Mile End still PENDING
    db = get_db()
    from bson import ObjectId
    doc = db.stock_transfers.find_one({"_id": ObjectId(tid)})
    assert doc is not None
    assert doc["status"] == "OPEN"
    mile_invite = next(inv for inv in doc["invited"] if str(inv["store_id"]) == mile_id)
    assert mile_invite["status"] == "PENDING"


def test_check_stock_blocks_second_check(client: TestClient) -> None:
    product_id, marion_id, mile_id = _drill_ids()
    cbd = _login(client, "admin.cbd", "cbd123")
    tid = _broadcast(client, cbd["token"], product_id, [marion_id, mile_id])

    marion = _login(client, "admin.marion", "marion123")
    r = _respond(client, marion["token"], tid, "CHECK_STOCK")
    assert r.status_code == 200
    assert r.json()["my_status"] == "CHECKING"

    mile = _login(client, "admin.mileend", "mileend123")
    r2 = _respond(client, mile["token"], tid, "CHECK_STOCK")
    assert r2.status_code == 409


def test_check_stock_blocks_accept_from_other(client: TestClient) -> None:
    product_id, marion_id, mile_id = _drill_ids()
    cbd = _login(client, "admin.cbd", "cbd123")
    tid = _broadcast(client, cbd["token"], product_id, [marion_id, mile_id])

    marion = _login(client, "admin.marion", "marion123")
    _respond(client, marion["token"], tid, "CHECK_STOCK")

    mile = _login(client, "admin.mileend", "mileend123")
    r = _respond(client, mile["token"], tid, "ACCEPT")
    assert r.status_code == 409


def test_clear_check_allows_accept(client: TestClient) -> None:
    product_id, marion_id, mile_id = _drill_ids()
    cbd = _login(client, "admin.cbd", "cbd123")
    tid = _broadcast(client, cbd["token"], product_id, [marion_id, mile_id])

    marion = _login(client, "admin.marion", "marion123")
    _respond(client, marion["token"], tid, "CHECK_STOCK")
    _respond(client, marion["token"], tid, "CLEAR_CHECK")

    mile = _login(client, "admin.mileend", "mileend123")
    r = _respond(client, mile["token"], tid, "ACCEPT")
    assert r.status_code == 200


def test_uninvited_store_cannot_respond(client: TestClient) -> None:
    product_id, marion_id, _ = _drill_ids()
    cbd = _login(client, "admin.cbd", "cbd123")
    tid = _broadcast(client, cbd["token"], product_id, [marion_id])

    modbury = _login(client, "admin.modbury", "modbury123")
    r = _respond(client, modbury["token"], tid, "ACCEPT")
    assert r.status_code == 403


def test_all_invited_visible_on_incoming(client: TestClient) -> None:
    product_id, marion_id, mile_id = _drill_ids()
    cbd = _login(client, "admin.cbd", "cbd123")
    _broadcast(client, cbd["token"], product_id, [marion_id, mile_id])

    marion = _login(client, "admin.marion", "marion123")
    transfers = client.get("/api/v1/transfers", headers=_auth(marion["token"])).json()
    row = transfers["incoming"][0]
    invited_names = {inv["store_name"] for inv in row["all_invited"]}
    assert "Marion" in invited_names
    assert "Mile End" in invited_names


def test_all_declines_mark_request_declined(client: TestClient) -> None:
    product_id, marion_id, mile_id = _drill_ids()
    cbd = _login(client, "admin.cbd", "cbd123")
    tid = _broadcast(client, cbd["token"], product_id, [marion_id, mile_id])

    marion = _login(client, "admin.marion", "marion123")
    mile = _login(client, "admin.mileend", "mileend123")
    assert _respond(client, marion["token"], tid, "DECLINE").status_code == 200
    assert _respond(client, mile["token"], tid, "DECLINE").status_code == 200

    transfers = client.get("/api/v1/transfers", headers=_auth(cbd["token"]))
    assert transfers.status_code == 200
    declined = transfers.json()["outgoing"][0]
    assert declined["status"] == "DECLINED"
    assert any(event["action"] == "ALL_DECLINED" for event in declined["events"])
