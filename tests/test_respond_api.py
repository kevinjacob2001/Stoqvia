"""Phase 6: Accept / Decline / Check stock tests."""

from datetime import datetime, timedelta, timezone
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


def _respond(client, token, transfer_id, action, qty=None):
    body = {"action": action}
    if qty is not None:
        body["qty"] = qty
    return client.post(
        f"/api/v1/transfers/{transfer_id}/respond",
        headers=_auth(token),
        json=body,
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


def test_second_accept_rejected_after_full_accept(client: TestClient) -> None:
    product_id, marion_id, mile_id = _drill_ids()
    cbd = _login(client, "admin.cbd", "cbd123")
    tid = _broadcast(client, cbd["token"], product_id, [marion_id, mile_id])

    marion = _login(client, "admin.marion", "marion123")
    _respond(client, marion["token"], tid, "ACCEPT")  # accepts all remaining

    mile = _login(client, "admin.mileend", "mileend123")
    r = _respond(client, mile["token"], tid, "ACCEPT")
    assert r.status_code == 409


def test_partial_accept_keeps_request_open_for_others(client: TestClient) -> None:
    product_id, marion_id, mile_id = _drill_ids()
    cbd = _login(client, "admin.cbd", "cbd123")
    tid = _broadcast(client, cbd["token"], product_id, [marion_id, mile_id])

    detail0 = client.get(f"/api/v1/transfers/{tid}", headers=_auth(cbd["token"])).json()
    total = detail0["qty"]
    assert total >= 2

    marion = _login(client, "admin.marion", "marion123")
    r = _respond(client, marion["token"], tid, "ACCEPT", qty=1)
    assert r.status_code == 200
    payload = r.json()
    assert payload["my_status"] == "ACCEPTED"
    assert payload["my_accepted_qty"] == 1
    assert payload["remaining_qty"] == total - 1
    assert payload["status"] == "OPEN"
    assert any(ev["action"] == "PARTIAL_ACCEPTED" for ev in payload["events"])

    mile = _login(client, "admin.mileend", "mileend123")
    inbox = client.get("/api/v1/transfers", headers=_auth(mile["token"])).json()["incoming"][0]
    assert inbox["my_status"] == "PENDING"
    assert inbox["remaining_qty"] == total - 1

    # Mile End can cover the remainder
    r2 = _respond(client, mile["token"], tid, "ACCEPT", qty=total - 1)
    assert r2.status_code == 200
    assert r2.json()["remaining_qty"] == 0
    assert r2.json()["status"] == "FULFILLED"


def test_partial_accept_then_decline_escalates_remainder_to_supplier(client: TestClient) -> None:
    product_id, marion_id, mile_id = _drill_ids()
    cbd = _login(client, "admin.cbd", "cbd123")
    tid = _broadcast(client, cbd["token"], product_id, [marion_id, mile_id])
    total = client.get(f"/api/v1/transfers/{tid}", headers=_auth(cbd["token"])).json()["qty"]

    marion = _login(client, "admin.marion", "marion123")
    mile = _login(client, "admin.mileend", "mileend123")
    assert _respond(client, marion["token"], tid, "ACCEPT", qty=1).status_code == 200
    assert _respond(client, mile["token"], tid, "DECLINE").status_code == 200

    detail = client.get(f"/api/v1/transfers/{tid}", headers=_auth(cbd["token"])).json()
    assert detail["remaining_qty"] == 0
    assert detail["status"] == "IN_TRANSIT"
    assert detail["purchase_order"] is not None
    assert detail["purchase_order"]["qty"] >= total - 1
    sources = {a["source"] for a in detail["allocations"]}
    assert sources == {"store", "supplier"}
    store_alloc = next(a for a in detail["allocations"] if a["source"] == "store")
    assert store_alloc["qty"] == 1
    assert store_alloc["status"] == "FULFILLED"
    supplier_alloc = next(a for a in detail["allocations"] if a["source"] == "supplier")
    assert supplier_alloc["status"] == "IN_TRANSIT"


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


def test_all_declines_auto_create_po_and_move_in_transit(client: TestClient) -> None:
    product_id, marion_id, mile_id = _drill_ids()
    cbd = _login(client, "admin.cbd", "cbd123")
    tid = _broadcast(client, cbd["token"], product_id, [marion_id, mile_id])

    marion = _login(client, "admin.marion", "marion123")
    mile = _login(client, "admin.mileend", "mileend123")
    assert _respond(client, marion["token"], tid, "DECLINE").status_code == 200
    assert _respond(client, mile["token"], tid, "DECLINE").status_code == 200

    transfers = client.get("/api/v1/transfers", headers=_auth(cbd["token"]))
    assert transfers.status_code == 200
    row = transfers.json()["outgoing"][0]
    assert row["status"] == "IN_TRANSIT"
    assert any(event["action"] == "ALL_DECLINED" for event in row["events"])
    assert any(event["action"] == "SUPPLIER_ESCALATED" for event in row["events"])
    assert any(event["action"] == "PO_CREATED" for event in row["events"])

    detail = client.get(f"/api/v1/transfers/{tid}", headers=_auth(cbd["token"])).json()
    assert detail["status"] == "IN_TRANSIT"
    assert detail["purchase_order"] is not None
    assert detail["purchase_order"]["status"] == "OPEN"
    assert detail["accepted_store_name"] == detail["purchase_order"]["supplier_name"]


def test_all_declines_auto_po_then_completed(client: TestClient) -> None:
    product_id, marion_id, mile_id = _drill_ids()
    cbd = _login(client, "admin.cbd", "cbd123")
    tid = _broadcast(client, cbd["token"], product_id, [marion_id, mile_id])

    marion = _login(client, "admin.marion", "marion123")
    mile = _login(client, "admin.mileend", "mileend123")
    _respond(client, marion["token"], tid, "DECLINE")
    _respond(client, mile["token"], tid, "DECLINE")

    db = get_db()
    from bson import ObjectId

    doc = db.stock_transfers.find_one({"_id": ObjectId(tid)})
    assert doc is not None
    assert doc["status"] == "IN_TRANSIT"
    assert doc.get("po_id") is not None
    lead_days = int(doc["lead_days"])
    po_id = doc["po_id"]

    now = datetime.now(timezone.utc)
    allocs = list(doc.get("allocations", []))
    for alloc in allocs:
        if alloc.get("status") == "IN_TRANSIT":
            lead = int(alloc.get("lead_days", lead_days))
            alloc["dispatched_at"] = now - timedelta(days=lead)
    db.stock_transfers.update_one(
        {"_id": ObjectId(tid)},
        {
            "$set": {
                "dispatched_at": now - timedelta(days=lead_days),
                "allocations": allocs,
            }
        },
    )

    # Detail alone must NOT complete — that is the scheduler/job's job.
    still_open = client.get(f"/api/v1/transfers/{tid}", headers=_auth(cbd["token"])).json()
    assert still_open["status"] == "IN_TRANSIT"
    assert still_open["purchase_order"]["status"] == "OPEN"

    job = client.post("/api/v1/transfers/jobs/complete-due", headers=_auth(cbd["token"]))
    assert job.status_code == 200
    assert job.json()["completed"] == 1

    completed = client.get(f"/api/v1/transfers/{tid}", headers=_auth(cbd["token"])).json()
    assert completed["status"] == "COMPLETED"
    assert completed["purchase_order"]["status"] == "RECEIVED"
    assert any(ev["action"] == "RECEIVED" for ev in completed["events"])
    assert any(ev["action"] == "PO_RECEIVED" for ev in completed["events"])
    assert any(ev["actor"] == "System" for ev in completed["events"] if ev["action"] == "RECEIVED")

    po = db.purchase_orders.find_one({"_id": po_id})
    assert po is not None
    assert po["status"] == "RECEIVED"


def test_complete_due_skips_transfers_still_within_lead_days(client: TestClient) -> None:
    product_id, marion_id, mile_id = _drill_ids()
    cbd = _login(client, "admin.cbd", "cbd123")
    tid = _broadcast(client, cbd["token"], product_id, [marion_id, mile_id])

    marion = _login(client, "admin.marion", "marion123")
    mile = _login(client, "admin.mileend", "mileend123")
    _respond(client, marion["token"], tid, "DECLINE")
    _respond(client, mile["token"], tid, "DECLINE")

    job = client.post("/api/v1/transfers/jobs/complete-due", headers=_auth(cbd["token"]))
    assert job.status_code == 200
    assert job.json()["completed"] == 0

    detail = client.get(f"/api/v1/transfers/{tid}", headers=_auth(cbd["token"])).json()
    assert detail["status"] == "IN_TRANSIT"


def test_store_dispatch_then_job_marks_received(client: TestClient) -> None:
    product_id, marion_id, _mile_id = _drill_ids()
    cbd = _login(client, "admin.cbd", "cbd123")
    tid = _broadcast(client, cbd["token"], product_id, [marion_id])

    marion = _login(client, "admin.marion", "marion123")
    assert _respond(client, marion["token"], tid, "ACCEPT").status_code == 200
    dispatch = client.post(f"/api/v1/transfers/{tid}/dispatch", headers=_auth(marion["token"]))
    assert dispatch.status_code == 200
    assert dispatch.json()["status"] == "IN_TRANSIT"

    db = get_db()
    from bson import ObjectId

    doc = db.stock_transfers.find_one({"_id": ObjectId(tid)})
    assert doc is not None
    lead_days = int(doc["lead_days"])
    now = datetime.now(timezone.utc)
    allocs = list(doc.get("allocations", []))
    for alloc in allocs:
        if alloc.get("status") == "IN_TRANSIT":
            lead = int(alloc.get("lead_days", lead_days))
            alloc["dispatched_at"] = now - timedelta(days=lead)
    db.stock_transfers.update_one(
        {"_id": ObjectId(tid)},
        {"$set": {"dispatched_at": now - timedelta(days=lead_days), "allocations": allocs}},
    )

    job = client.post("/api/v1/transfers/jobs/complete-due", headers=_auth(cbd["token"]))
    assert job.status_code == 200
    assert job.json()["completed"] == 1

    detail = client.get(f"/api/v1/transfers/{tid}", headers=_auth(cbd["token"])).json()
    assert detail["status"] == "COMPLETED"
    assert any(ev["action"] == "RECEIVED" and ev["actor"] == "System" for ev in detail["events"])
