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

def test_accept_closes_request_when_surplus_covers_need(client: TestClient) -> None:
    """Donors only cover what keeps them LOW; leftover can go to another store or supplier."""
    product_id, marion_id, mile_id = _drill_ids()
    cbd = _login(client, "admin.cbd", "cbd123")
    tid = _broadcast(client, cbd["token"], product_id, [marion_id, mile_id])

    marion = _login(client, "admin.marion", "marion123")
    inbox = client.get("/api/v1/transfers", headers=_auth(marion["token"])).json()["incoming"][0]
    remaining = inbox["remaining_qty"]
    max_qty = inbox["max_accept_qty"]
    assert max_qty is not None and max_qty >= 1

    take = min(max_qty, remaining)
    r = _respond(client, marion["token"], tid, "ACCEPT", qty=take)
    assert r.status_code == 200
    assert r.json()["my_accepted_qty"] == take

    if take >= remaining:
        assert r.json()["remaining_qty"] == 0
        assert r.json()["status"] == "FULFILLED"
        return

    assert r.json()["status"] == "OPEN"
    mile = _login(client, "admin.mileend", "mileend123")
    mile_inbox = client.get("/api/v1/transfers", headers=_auth(mile["token"])).json()["incoming"][0]
    assert mile_inbox["my_status"] == "PENDING"
    leftover = mile_inbox["remaining_qty"]
    mile_max = mile_inbox["max_accept_qty"]
    assert mile_max is not None
    mile_take = min(mile_max, leftover)
    r2 = _respond(client, mile["token"], tid, "ACCEPT", qty=mile_take)
    assert r2.status_code == 200
    # Either fully covered by stores, or leftover escalated to supplier.
    assert r2.json()["remaining_qty"] == 0
    assert r2.json()["status"] in ("FULFILLED", "IN_TRANSIT")


def test_second_accept_rejected_after_need_fully_covered(client: TestClient) -> None:
    product_id, marion_id, mile_id = _drill_ids()
    cbd = _login(client, "admin.cbd", "cbd123")
    tid = _broadcast(client, cbd["token"], product_id, [marion_id, mile_id])

    marion = _login(client, "admin.marion", "marion123")
    mile = _login(client, "admin.mileend", "mileend123")
    m_inbox = client.get("/api/v1/transfers", headers=_auth(marion["token"])).json()["incoming"][0]
    assert _respond(client, marion["token"], tid, "ACCEPT", qty=m_inbox["max_accept_qty"]).status_code == 200

    e_inbox = client.get("/api/v1/transfers", headers=_auth(mile["token"])).json()["incoming"][0]
    if e_inbox["my_status"] == "PENDING" and e_inbox["remaining_qty"] > 0 and (e_inbox["max_accept_qty"] or 0) > 0:
        take = min(e_inbox["remaining_qty"], e_inbox["max_accept_qty"])
        assert _respond(client, mile["token"], tid, "ACCEPT", qty=take).status_code == 200
    elif e_inbox["my_status"] == "PENDING":
        assert _respond(client, mile["token"], tid, "DECLINE").status_code == 200

    r = _respond(client, mile["token"], tid, "ACCEPT", qty=1)
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
    cover = min(inbox["remaining_qty"], inbox["max_accept_qty"])
    assert cover >= 1

    r2 = _respond(client, mile["token"], tid, "ACCEPT", qty=cover)
    assert r2.status_code == 200
    assert r2.json()["my_accepted_qty"] == cover
    # No invitees left: leftover need (if any) escalates to supplier → remaining 0.
    # Parent stays FULFILLED while any store allocation still awaits dispatch.
    assert r2.json()["remaining_qty"] == 0
    assert r2.json()["status"] == "FULFILLED"
    if cover < total - 1:
        assert any(a["source"] == "supplier" for a in r2.json()["allocations"])


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
    # Supplier may already be shipping, but Marion still owes dispatch → FULFILLED.
    assert detail["status"] == "FULFILLED"
    assert detail["dispatched_at"] is None
    assert detail["purchase_order"] is not None
    assert detail["purchase_order"]["qty"] >= total - 1
    sources = {a["source"] for a in detail["allocations"]}
    assert sources == {"store", "supplier"}
    store_alloc = next(a for a in detail["allocations"] if a["source"] == "store")
    assert store_alloc["qty"] == 1
    assert store_alloc["status"] == "FULFILLED"
    supplier_alloc = next(a for a in detail["allocations"] if a["source"] == "supplier")
    assert supplier_alloc["status"] == "IN_TRANSIT"

    # After the store dispatches, parent can move to IN_TRANSIT.
    dispatched = client.post(
        f"/api/v1/transfers/{tid}/dispatch",
        headers=_auth(marion["token"]),
    )
    assert dispatched.status_code == 200
    assert dispatched.json()["status"] == "IN_TRANSIT"
    assert dispatched.json()["dispatched_at"] is not None


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


def test_store_accept_uses_distance_transit_not_supplier_lead(client: TestClient) -> None:
    product_id, marion_id, _mile_id = _drill_ids()
    cbd = _login(client, "admin.cbd", "cbd123")
    tid = _broadcast(client, cbd["token"], product_id, [marion_id])

    marion = _login(client, "admin.marion", "marion123")
    r = _respond(client, marion["token"], tid, "ACCEPT")
    assert r.status_code == 200
    alloc = r.json()["my_allocation"]
    assert alloc is not None
    # Marion is under 15 km from CBD → 1 day store transit (not supplier 3–14 days).
    assert alloc["lead_days"] == 1


def test_accept_reserves_stock_and_keeps_donor_low_risk(client: TestClient) -> None:
    product_id, marion_id, _mile_id = _drill_ids()
    cbd = _login(client, "admin.cbd", "cbd123")
    tid = _broadcast(client, cbd["token"], product_id, [marion_id])

    db = get_db()
    from bson import ObjectId

    before = db.inventory.find_one(
        {"store_id": ObjectId(marion_id), "product_id": ObjectId(product_id)}
    )
    assert before is not None
    before_reserved = int(before["reserved"])

    marion = _login(client, "admin.marion", "marion123")
    inbox = client.get("/api/v1/transfers", headers=_auth(marion["token"])).json()["incoming"][0]
    qty = min(5, inbox["max_accept_qty"])
    assert qty >= 1
    assert _respond(client, marion["token"], tid, "ACCEPT", qty=qty).status_code == 200

    after = db.inventory.find_one(
        {"store_id": ObjectId(marion_id), "product_id": ObjectId(product_id)}
    )
    assert int(after["reserved"]) == before_reserved + qty

    forecast = client.get(
        f"/api/v1/stores/{marion_id}/forecasts",
        headers=_auth(marion["token"]),
    ).json()
    drill = next(f for f in forecast["forecasts"] if f["product_id"] == product_id)
    assert drill["risk"] == "LOW"


def test_dispatch_and_receive_moves_on_hand_and_updates_receiver_risk(client: TestClient) -> None:
    product_id, marion_id, _mile_id = _drill_ids()
    cbd = _login(client, "admin.cbd", "cbd123")
    cbd_store = cbd["store_id"]
    tid = _broadcast(client, cbd["token"], product_id, [marion_id])

    db = get_db()
    from bson import ObjectId

    marion = _login(client, "admin.marion", "marion123")
    inbox = client.get("/api/v1/transfers", headers=_auth(marion["token"])).json()["incoming"][0]
    qty = min(10, inbox["max_accept_qty"])
    assert _respond(client, marion["token"], tid, "ACCEPT", qty=qty).status_code == 200

    marion_before = db.inventory.find_one(
        {"store_id": ObjectId(marion_id), "product_id": ObjectId(product_id)}
    )
    cbd_before = db.inventory.find_one(
        {"store_id": ObjectId(cbd_store), "product_id": ObjectId(product_id)}
    )
    assert client.post(
        f"/api/v1/transfers/{tid}/dispatch", headers=_auth(marion["token"])
    ).status_code == 200

    marion_after_dispatch = db.inventory.find_one(
        {"store_id": ObjectId(marion_id), "product_id": ObjectId(product_id)}
    )
    assert int(marion_after_dispatch["on_hand"]) == int(marion_before["on_hand"]) - qty
    assert int(marion_after_dispatch["reserved"]) == int(marion_before["reserved"]) - qty

    doc = db.stock_transfers.find_one({"_id": ObjectId(tid)})
    now = datetime.now(timezone.utc)
    allocs = list(doc.get("allocations", []))
    for alloc in allocs:
        if alloc.get("source") == "store" and alloc.get("status") == "IN_TRANSIT":
            alloc["dispatched_at"] = now - timedelta(days=int(alloc.get("lead_days", 1)))
    db.stock_transfers.update_one({"_id": ObjectId(tid)}, {"$set": {"allocations": allocs}})

    job = client.post("/api/v1/transfers/jobs/complete-due", headers=_auth(cbd["token"]))
    assert job.json()["completed"] >= 1

    cbd_after = db.inventory.find_one(
        {"store_id": ObjectId(cbd_store), "product_id": ObjectId(product_id)}
    )
    assert int(cbd_after["on_hand"]) == int(cbd_before["on_hand"]) + qty

    cbd_forecast = client.get(
        f"/api/v1/stores/{cbd_store}/forecasts",
        headers=_auth(cbd["token"]),
    ).json()
    drill = next(f for f in cbd_forecast["forecasts"] if f["product_id"] == product_id)
    # Receiving stock should reduce shortage vs the original HIGH state.
    assert drill["predicted_shortage_qty"] < 108


def test_accept_qty_cannot_exceed_safe_surplus(client: TestClient) -> None:
    product_id, marion_id, _mile_id = _drill_ids()
    cbd = _login(client, "admin.cbd", "cbd123")
    tid = _broadcast(client, cbd["token"], product_id, [marion_id])

    marion = _login(client, "admin.marion", "marion123")
    inbox = client.get("/api/v1/transfers", headers=_auth(marion["token"])).json()["incoming"][0]
    max_qty = inbox["max_accept_qty"]
    assert max_qty is not None and max_qty >= 1

    too_much = max_qty + 1
    r = _respond(client, marion["token"], tid, "ACCEPT", qty=too_much)
    assert r.status_code == 400
    assert "safe surplus" in r.json()["detail"].lower() or "between 1 and" in r.json()["detail"].lower()


def test_accept_qty_cannot_exceed_remaining_need(client: TestClient) -> None:
    product_id, marion_id, mile_id = _drill_ids()
    cbd = _login(client, "admin.cbd", "cbd123")
    tid = _broadcast(client, cbd["token"], product_id, [marion_id, mile_id])

    marion = _login(client, "admin.marion", "marion123")
    # Take 1 unit first so remaining drops.
    assert _respond(client, marion["token"], tid, "ACCEPT", qty=1).status_code == 200

    mile = _login(client, "admin.mileend", "mileend123")
    remaining = client.get("/api/v1/transfers", headers=_auth(mile["token"])).json()["incoming"][0][
        "remaining_qty"
    ]
    r = _respond(client, mile["token"], tid, "ACCEPT", qty=remaining + 50)
    assert r.status_code == 400


def test_store_dispatch_then_job_marks_received(client: TestClient) -> None:
    product_id, marion_id, _mile_id = _drill_ids()
    cbd = _login(client, "admin.cbd", "cbd123")
    tid = _broadcast(client, cbd["token"], product_id, [marion_id])

    marion = _login(client, "admin.marion", "marion123")
    inbox = client.get("/api/v1/transfers", headers=_auth(marion["token"])).json()["incoming"][0]
    assert _respond(client, marion["token"], tid, "ACCEPT", qty=inbox["max_accept_qty"]).status_code == 200

    dispatch = client.post(f"/api/v1/transfers/{tid}/dispatch", headers=_auth(marion["token"]))
    assert dispatch.status_code == 200

    db = get_db()
    from bson import ObjectId

    doc = db.stock_transfers.find_one({"_id": ObjectId(tid)})
    assert doc is not None
    now = datetime.now(timezone.utc)
    allocs = list(doc.get("allocations", []))
    for alloc in allocs:
        if alloc.get("status") == "IN_TRANSIT":
            lead = int(alloc.get("lead_days", 1))
            alloc["dispatched_at"] = now - timedelta(days=lead)
    db.stock_transfers.update_one({"_id": ObjectId(tid)}, {"$set": {"allocations": allocs}})

    job = client.post("/api/v1/transfers/jobs/complete-due", headers=_auth(cbd["token"]))
    assert job.status_code == 200
    assert job.json()["completed"] >= 1

    detail = client.get(f"/api/v1/transfers/{tid}", headers=_auth(cbd["token"])).json()
    store_done = next(a for a in detail["allocations"] if a["source"] == "store")
    assert store_done["status"] == "COMPLETED"
    assert any(ev["action"] == "RECEIVED" and ev["actor"] == "System" for ev in detail["events"])
