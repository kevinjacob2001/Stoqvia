"""Transfer lifecycle: broadcast → Accept → Dispatch → Auto-complete."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Set

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo.database import Database

from app.db import get_db
from app.models.transfers import (
    IncomingTransfer,
    InviteStatus,
    MyTransfersResponse,
    OutgoingTransfer,
    RespondToTransferRequest,
    STATUS_COMPLETED,
    STATUS_DECLINED,
    STATUS_FULFILLED,
    STATUS_IN_TRANSIT,
    STATUS_OPEN,
    INVITE_ACCEPTED,
    INVITE_CHECKING,
    INVITE_DECLINED,
    INVITE_PASSED,
    INVITE_PENDING,
    TransferDetail,
    TransferEvent,
    TransferPurchaseOrder,
)
from app.services.inventory_service import parse_object_id
from app.services.request_options_service import get_request_options

DEFAULT_LEAD_DAYS = 2  # fallback when no supplier link found


def _now() -> datetime:
    # Keep timezone information so the frontend can render correct "now-based" timings.
    # Mongo stores datetimes as BSON dates; Pydantic will serialize consistently.
    return datetime.now(timezone.utc)


def _store_names(db: Database) -> Dict[Any, str]:
    return {store["_id"]: store["name"] for store in db.stores.find()}


def _product_label(db: Database, product_id: Any) -> tuple:
    product = db.products.find_one({"_id": product_id})
    if product is None:
        return ("", "")
    return (product["sku"], product["name"])


def _eligible_donor_ids(options) -> Set[str]:
    ids: Set[str] = set()
    for group in options.nearby_groups:
        for store in group.stores:
            ids.add(store.store_id)
    return ids


def _build_invite_status(invite: dict, names: Dict[Any, str]) -> InviteStatus:
    return InviteStatus(
        store_id=str(invite["store_id"]),
        store_name=names.get(invite["store_id"], ""),
        status=invite["status"],
    )


def _get_lead_days(db: Database, store_oid: Any, product_oid: Any) -> int:
    """Best lead_days from supplier_products for this store's supplier. Fallback to DEFAULT."""
    link = db.supplier_products.find_one({"product_id": product_oid})
    if link and "lead_days" in link:
        return max(1, int(link["lead_days"]))
    return DEFAULT_LEAD_DAYS


def _best_supplier_for_product(db: Database, product_oid: Any) -> Optional[Dict[str, Any]]:
    """Pick the best (lowest lead_days) approved supplier for a product."""
    best: Optional[Dict[str, Any]] = None
    links = list(db.supplier_products.find({"product_id": product_oid}))
    for link in links:
        supplier_id = link.get("supplier_id")
        if not supplier_id:
            continue
        supplier = db.suppliers.find_one({"_id": supplier_id, "approved": True})
        if supplier is None:
            continue
        lead = link.get("lead_days")
        if lead is None:
            continue
        lead_i = max(1, int(lead))
        candidate = {
            "supplier_id": supplier_id,
            "supplier_name": supplier["name"],
            "lead_days": lead_i,
            "min_order_qty": max(1, int(supplier.get("min_order_qty", 1))),
        }
        if best is None or lead_i < best["lead_days"]:
            best = candidate
    return best


def _load_purchase_order(db: Database, po_id: Any) -> Optional[TransferPurchaseOrder]:
    if po_id is None:
        return None
    po = db.purchase_orders.find_one({"_id": po_id})
    if po is None:
        return None
    supplier = db.suppliers.find_one({"_id": po["supplier_id"]})
    return TransferPurchaseOrder(
        po_id=str(po["_id"]),
        supplier_name=supplier["name"] if supplier else "Supplier",
        qty=int(po["qty"]),
        status=po["status"],
        expected_date=po.get("expected_date"),
    )


def _append_event(db: Database, transfer_oid: ObjectId, actor: str, action: str) -> None:
    db.stock_transfers.update_one(
        {"_id": transfer_oid},
        {"$push": {"events": {"at": _now(), "actor": actor, "action": action}}},
    )


def _build_outgoing(doc: dict, names: Dict[Any, str], sku: str, product_name: str) -> OutgoingTransfer:
    accepted_store_name: Optional[str] = None
    if doc.get("accepted_store_id"):
        accepted_store_name = names.get(doc["accepted_store_id"])
    return OutgoingTransfer(
        transfer_id=str(doc["_id"]),
        sku=sku,
        product_name=product_name,
        qty=int(doc["qty"]),
        status=doc["status"],
        invited=[_build_invite_status(inv, names) for inv in doc["invited"]],
        created_at=doc.get("created_at"),
        accepted_at=doc.get("accepted_at"),
        dispatched_at=doc.get("dispatched_at"),
        completed_at=doc.get("completed_at"),
        accepted_store_name=accepted_store_name,
        lead_days=doc.get("lead_days"),
        events=[TransferEvent(**e) for e in doc.get("events", [])],
    )


def _build_incoming(
    doc: dict, store_oid: Any, names: Dict[Any, str], sku: str, product_name: str
) -> IncomingTransfer:
    my_invite = next(inv for inv in doc["invited"] if inv["store_id"] == store_oid)
    return IncomingTransfer(
        transfer_id=str(doc["_id"]),
        sku=sku,
        product_name=product_name,
        qty=int(doc["qty"]),
        requester_store_name=names.get(doc["requester_store_id"], ""),
        my_status=my_invite["status"],
        all_invited=[_build_invite_status(inv, names) for inv in doc["invited"]],
        status=doc["status"],
        created_at=doc.get("created_at"),
        accepted_at=doc.get("accepted_at"),
        dispatched_at=doc.get("dispatched_at"),
        completed_at=doc.get("completed_at"),
        lead_days=doc.get("lead_days"),
        events=[TransferEvent(**e) for e in doc.get("events", [])],
    )


def _build_detail(
    doc: dict,
    viewer_store_oid: Any,
    names: Dict[Any, str],
    sku: str,
    product_name: str,
    db: Optional[Database] = None,
) -> TransferDetail:
    purchase_order = None
    if db is not None and doc.get("po_id") is not None:
        purchase_order = _load_purchase_order(db, doc["po_id"])

    accepted_store_name: Optional[str] = None
    if doc.get("accepted_store_id"):
        accepted_store_name = names.get(doc["accepted_store_id"])
    elif purchase_order is not None:
        accepted_store_name = purchase_order.supplier_name
    elif doc.get("status") in (STATUS_IN_TRANSIT, STATUS_COMPLETED):
        # Supplier fulfilment has no accepted_store_id.
        accepted_store_name = "Supplier"
    my_invite = next(
        (inv for inv in doc["invited"] if inv["store_id"] == viewer_store_oid),
        None,
    )
    return TransferDetail(
        transfer_id=str(doc["_id"]),
        sku=sku,
        product_name=product_name,
        qty=int(doc["qty"]),
        status=doc["status"],
        requester_store_name=names.get(doc["requester_store_id"], ""),
        accepted_store_name=accepted_store_name,
        my_status=my_invite["status"] if my_invite else None,
        invited=[_build_invite_status(inv, names) for inv in doc["invited"]],
        created_at=doc.get("created_at"),
        accepted_at=doc.get("accepted_at"),
        dispatched_at=doc.get("dispatched_at"),
        completed_at=doc.get("completed_at"),
        lead_days=doc.get("lead_days"),
        events=[TransferEvent(**e) for e in doc.get("events", [])],
        purchase_order=purchase_order,
    )


# ---------------------------------------------------------------------------
# Auto-complete: called on every relevant API request to tick over due transfers
# ---------------------------------------------------------------------------

def _maybe_auto_complete(db: Database) -> None:
    """Auto-complete IN_TRANSIT transfers whose lead_days have elapsed."""
    now = _now()
    # Mongo/PyMongo may return stored BSON dates as timezone-naive UTC.
    # Normalize both sides to naive UTC to avoid aware/naive comparison errors.
    now_naive = now.replace(tzinfo=None)
    due = list(
        db.stock_transfers.find(
            {
                "status": STATUS_IN_TRANSIT,
                "dispatched_at": {"$exists": True},
                "lead_days": {"$exists": True},
            }
        )
    )
    for doc in due:
        dispatched = doc["dispatched_at"]
        if dispatched.tzinfo is not None:
            dispatched = dispatched.replace(tzinfo=None)
        lead = int(doc["lead_days"])
        if now_naive >= dispatched + timedelta(days=lead):
            db.stock_transfers.update_one(
                {"_id": doc["_id"]},
                {"$set": {"status": STATUS_COMPLETED, "completed_at": now}},
            )
            _append_event(db, doc["_id"], "system", "COMPLETED")
            if doc.get("po_id") is not None:
                db.purchase_orders.update_one(
                    {"_id": doc["po_id"]},
                    {"$set": {"status": "RECEIVED"}},
                )
                _append_event(db, doc["_id"], "system", "PO_RECEIVED")


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

def create_transfer(
    requester_store_id: str,
    product_id: str,
    donor_store_ids: List[str],
    db: Optional[Database] = None,
) -> OutgoingTransfer:
    database = db if db is not None else get_db()
    unique_ids = list(dict.fromkeys(donor_store_ids))
    if not unique_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Select at least one store",
        )
    if requester_store_id in unique_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot request stock from your own store",
        )

    options = get_request_options(requester_store_id, product_id, db=database)
    eligible = _eligible_donor_ids(options)
    unknown = [sid for sid in unique_ids if sid not in eligible]
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more stores cannot safely fulfil this request",
        )

    requester_oid = parse_object_id(requester_store_id, "store_id")
    product_oid = parse_object_id(product_id, "product_id")
    if database.stock_transfers.find_one(
        {"requester_store_id": requester_oid, "product_id": product_oid, "status": STATUS_OPEN}
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An open transfer request already exists for this product",
        )

    now = _now()
    invited = [
        {"store_id": parse_object_id(sid, "store_id"), "status": INVITE_PENDING}
        for sid in unique_ids
    ]
    result = database.stock_transfers.insert_one(
        {
            "product_id": product_oid,
            "requester_store_id": requester_oid,
            "qty": options.requested_qty,
            "status": STATUS_OPEN,
            "created_at": now,
            "invited": invited,
            "events": [{"at": now, "actor": "system", "action": "REQUESTED"}],
        }
    )
    names = _store_names(database)
    doc = database.stock_transfers.find_one({"_id": result.inserted_id})
    return _build_outgoing(doc, names, options.sku, options.product_name)


# ---------------------------------------------------------------------------
# Respond (Accept / Decline / Check stock / Clear check)
# ---------------------------------------------------------------------------

def respond_to_transfer(
    transfer_id: str,
    responder_store_id: str,
    body: RespondToTransferRequest,
    db: Optional[Database] = None,
) -> IncomingTransfer:
    database = db if db is not None else get_db()
    _maybe_auto_complete(database)

    try:
        transfer_oid = ObjectId(transfer_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid transfer_id")

    responder_oid = parse_object_id(responder_store_id, "store_id")
    doc = database.stock_transfers.find_one({"_id": transfer_oid})
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transfer not found")
    if doc["status"] != STATUS_OPEN:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This transfer request is no longer open",
        )

    my_idx = next(
        (i for i, inv in enumerate(doc["invited"]) if inv["store_id"] == responder_oid), None
    )
    if my_idx is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You were not invited to this transfer",
        )

    my_invite = doc["invited"][my_idx]
    current_status = my_invite["status"]
    action = body.action
    names = _store_names(database)
    actor_name = names.get(responder_oid, responder_store_id)

    if action == "DECLINE":
        if current_status not in (INVITE_PENDING, INVITE_CHECKING):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot decline from status {current_status}",
            )
        database.stock_transfers.update_one(
            {"_id": transfer_oid},
            {"$set": {f"invited.{my_idx}.status": INVITE_DECLINED}},
        )
        _append_event(database, transfer_oid, actor_name, "DECLINED")
        doc = database.stock_transfers.find_one({"_id": transfer_oid})
        if doc is not None and all(inv["status"] == INVITE_DECLINED for inv in doc["invited"]):
            database.stock_transfers.update_one(
                {"_id": transfer_oid},
                {"$set": {"status": STATUS_DECLINED}},
            )
            _append_event(database, transfer_oid, "system", "ALL_DECLINED")

    elif action == "CHECK_STOCK":
        if current_status != INVITE_PENDING:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot check stock from status {current_status}",
            )
        if any(
            inv["status"] == INVITE_CHECKING
            for i, inv in enumerate(doc["invited"])
            if i != my_idx
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Another store is already checking stock — please wait",
            )
        database.stock_transfers.update_one(
            {"_id": transfer_oid},
            {"$set": {f"invited.{my_idx}.status": INVITE_CHECKING}},
        )
        _append_event(database, transfer_oid, actor_name, "CHECK_STOCK")

    elif action == "CLEAR_CHECK":
        if current_status != INVITE_CHECKING:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You are not currently checking stock",
            )
        database.stock_transfers.update_one(
            {"_id": transfer_oid},
            {"$set": {f"invited.{my_idx}.status": INVITE_PENDING}},
        )
        _append_event(database, transfer_oid, actor_name, "CLEAR_CHECK")

    elif action == "ACCEPT":
        if current_status not in (INVITE_PENDING, INVITE_CHECKING):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot accept from status {current_status}",
            )
        if any(
            inv["status"] == INVITE_CHECKING
            for i, inv in enumerate(doc["invited"])
            if i != my_idx
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Another store is checking stock — please wait before accepting",
            )
        now = _now()
        lead_days = _get_lead_days(database, responder_oid, doc["product_id"])
        updates: Dict[str, Any] = {
            f"invited.{my_idx}.status": INVITE_ACCEPTED,
            "status": STATUS_FULFILLED,
            "accepted_store_id": responder_oid,
            "accepted_at": now,
            "lead_days": lead_days,
        }
        for i, inv in enumerate(doc["invited"]):
            if i != my_idx and inv["status"] == INVITE_PENDING:
                updates[f"invited.{i}.status"] = INVITE_PASSED
        database.stock_transfers.update_one({"_id": transfer_oid}, {"$set": updates})
        _append_event(database, transfer_oid, actor_name, "ACCEPTED")

    doc = database.stock_transfers.find_one({"_id": transfer_oid})
    sku, product_name = _product_label(database, doc["product_id"])
    return _build_incoming(doc, responder_oid, names, sku, product_name)


# ---------------------------------------------------------------------------
# Dispatch (donor marks stock sent)
# ---------------------------------------------------------------------------

def dispatch_transfer(
    transfer_id: str,
    dispatcher_store_id: str,
    db: Optional[Database] = None,
) -> OutgoingTransfer:
    database = db if db is not None else get_db()
    _maybe_auto_complete(database)

    try:
        transfer_oid = ObjectId(transfer_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid transfer_id")

    dispatcher_oid = parse_object_id(dispatcher_store_id, "store_id")
    doc = database.stock_transfers.find_one({"_id": transfer_oid})
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transfer not found")
    if doc["status"] != STATUS_FULFILLED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Transfer must be FULFILLED to dispatch, currently {doc['status']}",
        )
    if doc.get("accepted_store_id") != dispatcher_oid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the accepting store can mark as dispatched",
        )

    now = _now()
    database.stock_transfers.update_one(
        {"_id": transfer_oid},
        {"$set": {"status": STATUS_IN_TRANSIT, "dispatched_at": now}},
    )
    names = _store_names(database)
    actor_name = names.get(dispatcher_oid, dispatcher_store_id)
    _append_event(database, transfer_oid, actor_name, "DISPATCHED")

    doc = database.stock_transfers.find_one({"_id": transfer_oid})
    sku, product_name = _product_label(database, doc["product_id"])
    return _build_outgoing(doc, names, sku, product_name)


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------

def list_my_transfers(
    store_id: str,
    db: Optional[Database] = None,
) -> MyTransfersResponse:
    database = db if db is not None else get_db()
    _maybe_auto_complete(database)

    store_oid = parse_object_id(store_id, "store_id")
    names = _store_names(database)
    outgoing_docs = list(
        database.stock_transfers.find({"requester_store_id": store_oid}).sort("created_at", -1)
    )
    incoming_docs = list(
        database.stock_transfers.find({"invited.store_id": store_oid}).sort("created_at", -1)
    )

    outgoing: List[OutgoingTransfer] = []
    for doc in outgoing_docs:
        sku, product_name = _product_label(database, doc["product_id"])
        outgoing.append(_build_outgoing(doc, names, sku, product_name))

    incoming: List[IncomingTransfer] = []
    for doc in incoming_docs:
        sku, product_name = _product_label(database, doc["product_id"])
        incoming.append(_build_incoming(doc, store_oid, names, sku, product_name))

    return MyTransfersResponse(outgoing=outgoing, incoming=incoming)


def get_transfer_detail(
    transfer_id: str,
    viewer_store_id: str,
    db: Optional[Database] = None,
) -> TransferDetail:
    database = db if db is not None else get_db()
    _maybe_auto_complete(database)

    try:
        transfer_oid = ObjectId(transfer_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid transfer_id")

    viewer_store_oid = parse_object_id(viewer_store_id, "store_id")
    doc = database.stock_transfers.find_one({"_id": transfer_oid})
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transfer not found")

    is_requester = doc["requester_store_id"] == viewer_store_oid
    is_invited = any(inv["store_id"] == viewer_store_oid for inv in doc["invited"])
    if not is_requester and not is_invited:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this transfer",
        )

    names = _store_names(database)
    sku, product_name = _product_label(database, doc["product_id"])
    return _build_detail(doc, viewer_store_oid, names, sku, product_name, db=database)


def contact_supplier_transfer(
    transfer_id: str,
    requester_store_id: str,
    db: Optional[Database] = None,
) -> TransferDetail:
    """Move a fully-declined request into supplier fulfilment.

    Supplier fulfilment is inventory-agnostic: we do not validate donor stock.
    Creates a purchase order linked to the transfer.
    """
    database = db if db is not None else get_db()
    _maybe_auto_complete(database)

    try:
        transfer_oid = ObjectId(transfer_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid transfer_id")

    requester_oid = parse_object_id(requester_store_id, "store_id")
    doc = database.stock_transfers.find_one({"_id": transfer_oid})
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transfer not found")

    if doc["requester_store_id"] != requester_oid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only requester can contact supplier")

    if doc.get("status") != STATUS_DECLINED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Transfer is not in a declinable state")

    supplier = _best_supplier_for_product(database, doc["product_id"])
    if supplier is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No approved supplier available for this product",
        )

    now = _now()
    lead_days = int(supplier["lead_days"])
    po_qty = max(int(doc["qty"]), int(supplier["min_order_qty"]))
    expected_date = (now + timedelta(days=lead_days)).replace(tzinfo=None)

    po_result = database.purchase_orders.insert_one(
        {
            "supplier_id": supplier["supplier_id"],
            "store_id": requester_oid,
            "product_id": doc["product_id"],
            "qty": po_qty,
            "expected_date": expected_date,
            "status": "OPEN",
        }
    )

    database.stock_transfers.update_one(
        {"_id": transfer_oid},
        {
            "$set": {
                "status": STATUS_IN_TRANSIT,
                "accepted_at": now,
                "dispatched_at": now,
                "lead_days": lead_days,
                "po_id": po_result.inserted_id,
            }
        },
    )

    names = _store_names(database)
    actor_name = names.get(requester_oid, requester_store_id)
    _append_event(database, transfer_oid, actor_name, "SUPPLIER_CONTACTED")
    _append_event(database, transfer_oid, "system", "PO_CREATED")

    # Re-fetch for response
    doc = database.stock_transfers.find_one({"_id": transfer_oid})
    sku, product_name = _product_label(database, doc["product_id"])
    return _build_detail(doc, requester_oid, names, sku, product_name, db=database)
