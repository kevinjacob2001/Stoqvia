"""Transfer lifecycle: broadcast → partial Accept → Dispatch → Auto-complete."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Set

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo.database import Database

from app.db import get_db
from app.config import get_settings
from app.models.transfers import (
    ALLOC_COMPLETED,
    ALLOC_FULFILLED,
    ALLOC_IN_TRANSIT,
    ALLOC_SOURCE_STORE,
    ALLOC_SOURCE_SUPPLIER,
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
    TransferAllocation,
    TransferDetail,
    TransferEvent,
    TransferPurchaseOrder,
)
from app.models.forecast import calculate_safe_surplus
from app.services.inventory_service import parse_object_id
from app.services.geo import distance_km, transit_lead_days
from app.services.request_options_service import get_request_options
from app.services import forecast_service

DEFAULT_LEAD_DAYS = 2
ACTIVE_FULFILLMENT_STATUSES = (STATUS_OPEN, STATUS_FULFILLED, STATUS_IN_TRANSIT)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _supplier_lead_amount(db_lead_days: int) -> int:
    """Supplier transit length. Testing override uses minutes; otherwise seed days."""
    override = int(get_settings().supplier_lead_minutes)
    if override > 0:
        return override
    return max(1, int(db_lead_days))


def _supplier_uses_minutes() -> bool:
    return int(get_settings().supplier_lead_minutes) > 0


def _allocation_due_at(dispatched: datetime, alloc: dict) -> datetime:
    lead = int(alloc["lead_days"])
    if alloc.get("source") == ALLOC_SOURCE_SUPPLIER and _supplier_uses_minutes():
        due = dispatched + timedelta(minutes=lead)
    else:
        due = dispatched + timedelta(days=lead)
    if due.tzinfo is not None:
        return due.replace(tzinfo=None)
    return due


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


def _remaining(doc: dict) -> int:
    if "remaining_qty" in doc:
        return max(0, int(doc["remaining_qty"]))
    return max(0, int(doc["qty"]))


def _build_invite_status(invite: dict, names: Dict[Any, str]) -> InviteStatus:
    return InviteStatus(
        store_id=str(invite["store_id"]),
        store_name=names.get(invite["store_id"], ""),
        status=invite["status"],
        accepted_qty=int(invite["accepted_qty"]) if invite.get("accepted_qty") is not None else None,
    )


def _build_allocation(alloc: dict, names: Dict[Any, str]) -> TransferAllocation:
    store_id = alloc.get("store_id")
    return TransferAllocation(
        allocation_id=str(alloc["allocation_id"]),
        source=alloc["source"],
        store_id=str(store_id) if store_id is not None else None,
        store_name=names.get(store_id) if store_id is not None else (
            "Supplier" if alloc["source"] == ALLOC_SOURCE_SUPPLIER else None
        ),
        qty=int(alloc["qty"]),
        status=alloc["status"],
        accepted_at=alloc.get("accepted_at"),
        dispatched_at=alloc.get("dispatched_at"),
        completed_at=alloc.get("completed_at"),
        lead_days=alloc.get("lead_days"),
        po_id=str(alloc["po_id"]) if alloc.get("po_id") is not None else None,
    )


def _find_store_allocation(doc: dict, store_oid: Any) -> Optional[dict]:
    for alloc in doc.get("allocations", []):
        if alloc.get("source") == ALLOC_SOURCE_STORE and alloc.get("store_id") == store_oid:
            return alloc
    return None


def _derive_status(doc: dict) -> str:
    remaining = _remaining(doc)
    allocs = doc.get("allocations", [])
    invites = doc.get("invited", [])
    has_open_invite = any(inv["status"] in (INVITE_PENDING, INVITE_CHECKING) for inv in invites)

    if remaining > 0 and has_open_invite:
        return STATUS_OPEN
    if remaining > 0 and not has_open_invite and not allocs:
        return STATUS_DECLINED
    if remaining > 0 and not has_open_invite:
        # Escalation pending or failed mid-flight — treat as open until escalate writes.
        if any(a.get("source") == ALLOC_SOURCE_SUPPLIER for a in allocs):
            pass
        else:
            return STATUS_DECLINED

    if allocs and all(a["status"] == ALLOC_COMPLETED for a in allocs) and remaining == 0:
        return STATUS_COMPLETED
    # Any store leg still awaiting dispatch keeps the parent FULFILLED, even if a
    # supplier PO is already IN_TRANSIT — otherwise ops thinks everything shipped.
    if any(a["status"] == ALLOC_FULFILLED for a in allocs):
        return STATUS_FULFILLED
    if any(a["status"] == ALLOC_IN_TRANSIT for a in allocs):
        return STATUS_IN_TRANSIT
    if remaining == 0:
        return STATUS_FULFILLED
    return STATUS_OPEN


def _set_derived_status(db: Database, transfer_oid: ObjectId, doc: dict) -> None:
    status_value = _derive_status(doc)
    extra: Dict[str, Any] = {"status": status_value}
    if status_value == STATUS_COMPLETED and doc.get("completed_at") is None:
        extra["completed_at"] = _now()
    db.stock_transfers.update_one({"_id": transfer_oid}, {"$set": extra})


def _store_transit_lead_days(db: Database, from_store_oid: Any, to_store_oid: Any) -> int:
    """Lead days for inter-store delivery based on distance (not supplier lead time)."""
    origin = db.stores.find_one({"_id": from_store_oid})
    dest = db.stores.find_one({"_id": to_store_oid})
    if origin is None or dest is None:
        return DEFAULT_LEAD_DAYS
    kilometres = distance_km(
        float(origin["latitude"]),
        float(origin["longitude"]),
        float(dest["latitude"]),
        float(dest["longitude"]),
    )
    return transit_lead_days(kilometres)


def _donor_safe_surplus(db: Database, store_id: str, product_id: str) -> int:
    """Units this store can spare while remaining LOW risk after the transfer."""
    forecast = forecast_service.get_forecast(store_id, product_id, db=db)
    if forecast.risk != "LOW":
        return 0
    return max(
        0,
        calculate_safe_surplus(
            forecast.current_usable_stock,
            forecast.predicted_7d_demand,
            forecast.safety_stock,
        ),
    )


def _adjust_inventory(
    db: Database,
    store_oid: Any,
    product_oid: Any,
    *,
    on_hand_delta: int = 0,
    reserved_delta: int = 0,
) -> None:
    inv = db.inventory.find_one({"store_id": store_oid, "product_id": product_oid})
    if inv is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory row not found for store/product",
        )
    new_on_hand = int(inv["on_hand"]) + on_hand_delta
    new_reserved = int(inv["reserved"]) + reserved_delta
    if new_on_hand < 0 or new_reserved < 0 or new_reserved > new_on_hand:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Inventory update would create an invalid stock state",
        )
    db.inventory.update_one(
        {"_id": inv["_id"]},
        {"$set": {"on_hand": new_on_hand, "reserved": new_reserved, "updated_at": _now()}},
    )


def _best_supplier_for_product(db: Database, product_oid: Any) -> Optional[Dict[str, Any]]:
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
        db_lead = max(1, int(lead))
        lead_i = _supplier_lead_amount(db_lead)
        candidate = {
            "supplier_id": supplier_id,
            "supplier_name": supplier["name"],
            "lead_days": lead_i,
            "min_order_qty": max(1, int(supplier.get("min_order_qty", 1))),
            "_rank_days": db_lead,
        }
        if best is None or db_lead < best["_rank_days"]:
            best = candidate
    if best is not None:
        best.pop("_rank_days", None)
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


def _primary_po_id(doc: dict) -> Any:
    if doc.get("po_id") is not None:
        return doc["po_id"]
    for alloc in reversed(doc.get("allocations", [])):
        if alloc.get("po_id") is not None:
            return alloc["po_id"]
    return None


def _auto_escalate_remaining(db: Database, transfer_oid: ObjectId, doc: dict) -> None:
    """When no invitees remain open: escalate leftover qty to supplier (or DECLINED)."""
    remaining = _remaining(doc)
    if remaining <= 0:
        refreshed = db.stock_transfers.find_one({"_id": transfer_oid})
        if refreshed is not None:
            _set_derived_status(db, transfer_oid, refreshed)
        return

    _append_event(db, transfer_oid, "System", "ALL_DECLINED")

    supplier = _best_supplier_for_product(db, doc["product_id"])
    if supplier is None:
        db.stock_transfers.update_one(
            {"_id": transfer_oid},
            {"$set": {"status": STATUS_DECLINED}},
        )
        return

    now = _now()
    lead_days = int(supplier["lead_days"])
    po_qty = max(remaining, int(supplier["min_order_qty"]))
    if _supplier_uses_minutes():
        expected_date = (now + timedelta(minutes=lead_days)).replace(tzinfo=None)
    else:
        expected_date = (now + timedelta(days=lead_days)).replace(tzinfo=None)
    allocation_id = ObjectId()

    po_result = db.purchase_orders.insert_one(
        {
            "supplier_id": supplier["supplier_id"],
            "store_id": doc["requester_store_id"],
            "product_id": doc["product_id"],
            "qty": po_qty,
            "expected_date": expected_date,
            "status": "OPEN",
        }
    )

    allocation = {
        "allocation_id": allocation_id,
        "source": ALLOC_SOURCE_SUPPLIER,
        "qty": po_qty,
        "status": ALLOC_IN_TRANSIT,
        "accepted_at": now,
        "dispatched_at": now,
        "lead_days": lead_days,
        "po_id": po_result.inserted_id,
    }
    # Do not stamp parent dispatched_at while a store still owes a dispatch.
    pending_store_dispatch = any(
        a.get("source") == ALLOC_SOURCE_STORE and a.get("status") == ALLOC_FULFILLED
        for a in doc.get("allocations", [])
    )
    set_fields: Dict[str, Any] = {
        "remaining_qty": 0,
        "lead_days": lead_days,
        "po_id": po_result.inserted_id,
        "accepted_at": doc.get("accepted_at") or now,
    }
    if not pending_store_dispatch:
        set_fields["dispatched_at"] = now
    db.stock_transfers.update_one(
        {"_id": transfer_oid},
        {
            "$set": set_fields,
            "$push": {"allocations": allocation},
        },
    )
    _append_event(db, transfer_oid, "System", "SUPPLIER_ESCALATED")
    _append_event(db, transfer_oid, "System", "PO_CREATED")
    refreshed = db.stock_transfers.find_one({"_id": transfer_oid})
    if refreshed is not None:
        _set_derived_status(db, transfer_oid, refreshed)


def _append_event(db: Database, transfer_oid: ObjectId, actor: str, action: str) -> None:
    db.stock_transfers.update_one(
        {"_id": transfer_oid},
        {"$push": {"events": {"at": _now(), "actor": actor, "action": action}}},
    )


def _accepted_store_label(
    doc: dict, names: Dict[Any, str], supplier_name: Optional[str] = None
) -> Optional[str]:
    store_names: List[str] = []
    for alloc in doc.get("allocations", []):
        if alloc.get("source") == ALLOC_SOURCE_STORE and alloc.get("store_id") is not None:
            store_names.append(names.get(alloc["store_id"], "Store"))
        elif alloc.get("source") == ALLOC_SOURCE_SUPPLIER:
            store_names.append(supplier_name or "Supplier")
    if store_names:
        return ", ".join(store_names)
    if doc.get("accepted_store_id"):
        return names.get(doc["accepted_store_id"])
    return None


def _build_outgoing(doc: dict, names: Dict[Any, str], sku: str, product_name: str) -> OutgoingTransfer:
    return OutgoingTransfer(
        transfer_id=str(doc["_id"]),
        product_id=str(doc["product_id"]),
        sku=sku,
        product_name=product_name,
        qty=int(doc["qty"]),
        remaining_qty=_remaining(doc),
        status=doc["status"],
        invited=[_build_invite_status(inv, names) for inv in doc["invited"]],
        allocations=[_build_allocation(a, names) for a in doc.get("allocations", [])],
        created_at=doc.get("created_at"),
        accepted_at=doc.get("accepted_at"),
        dispatched_at=doc.get("dispatched_at"),
        completed_at=doc.get("completed_at"),
        accepted_store_name=_accepted_store_label(doc, names),
        lead_days=doc.get("lead_days"),
        events=[TransferEvent(**e) for e in doc.get("events", [])],
    )


def _build_incoming(
    doc: dict, store_oid: Any, names: Dict[Any, str], sku: str, product_name: str, db: Optional[Database] = None
) -> IncomingTransfer:
    my_invite = next(inv for inv in doc["invited"] if inv["store_id"] == store_oid)
    my_alloc_doc = _find_store_allocation(doc, store_oid)
    delivery_lead_days = None
    safe_surplus = None
    max_accept_qty = None
    remaining = _remaining(doc)
    if db is not None:
        delivery_lead_days = _store_transit_lead_days(db, store_oid, doc["requester_store_id"])
        if my_invite["status"] in (INVITE_PENDING, INVITE_CHECKING) and doc["status"] == STATUS_OPEN:
            safe_surplus = _donor_safe_surplus(db, str(store_oid), str(doc["product_id"]))
            max_accept_qty = min(remaining, safe_surplus) if safe_surplus > 0 and remaining > 0 else 0
    return IncomingTransfer(
        transfer_id=str(doc["_id"]),
        sku=sku,
        product_name=product_name,
        qty=int(doc["qty"]),
        remaining_qty=remaining,
        requester_store_name=names.get(doc["requester_store_id"], ""),
        my_status=my_invite["status"],
        my_accepted_qty=int(my_invite["accepted_qty"]) if my_invite.get("accepted_qty") is not None else None,
        my_allocation=_build_allocation(my_alloc_doc, names) if my_alloc_doc else None,
        delivery_lead_days=delivery_lead_days,
        max_accept_qty=max_accept_qty,
        safe_surplus=safe_surplus,
        all_invited=[_build_invite_status(inv, names) for inv in doc["invited"]],
        allocations=[_build_allocation(a, names) for a in doc.get("allocations", [])],
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
    if db is not None:
        purchase_order = _load_purchase_order(db, _primary_po_id(doc))

    my_invite = next(
        (inv for inv in doc["invited"] if inv["store_id"] == viewer_store_oid),
        None,
    )
    supplier_name = purchase_order.supplier_name if purchase_order else None
    return TransferDetail(
        transfer_id=str(doc["_id"]),
        sku=sku,
        product_name=product_name,
        qty=int(doc["qty"]),
        remaining_qty=_remaining(doc),
        status=doc["status"],
        requester_store_name=names.get(doc["requester_store_id"], ""),
        accepted_store_name=_accepted_store_label(doc, names, supplier_name=supplier_name),
        my_status=my_invite["status"] if my_invite else None,
        invited=[_build_invite_status(inv, names) for inv in doc["invited"]],
        allocations=[_build_allocation(a, names) for a in doc.get("allocations", [])],
        created_at=doc.get("created_at"),
        accepted_at=doc.get("accepted_at"),
        dispatched_at=doc.get("dispatched_at"),
        completed_at=doc.get("completed_at"),
        lead_days=doc.get("lead_days"),
        events=[TransferEvent(**e) for e in doc.get("events", [])],
        purchase_order=purchase_order,
    )


def complete_due_transfers(db: Optional[Database] = None) -> int:
    """Complete due IN_TRANSIT allocations (and parent transfer when all done)."""
    database = db if db is not None else get_db()
    now = _now()
    now_naive = now.replace(tzinfo=None)
    candidates = list(
        database.stock_transfers.find(
            {
                "allocations": {
                    "$elemMatch": {
                        "status": ALLOC_IN_TRANSIT,
                        "dispatched_at": {"$exists": True},
                        "lead_days": {"$exists": True},
                    }
                }
            }
        )
    )
    # Legacy docs: top-level IN_TRANSIT without allocations array entries.
    legacy = list(
        database.stock_transfers.find(
            {
                "status": STATUS_IN_TRANSIT,
                "dispatched_at": {"$exists": True},
                "lead_days": {"$exists": True},
                "$or": [{"allocations": {"$exists": False}}, {"allocations": []}],
            }
        )
    )

    completed_transfers = 0
    for doc in candidates:
        changed = False
        allocs = list(doc.get("allocations", []))
        for i, alloc in enumerate(allocs):
            if alloc.get("status") != ALLOC_IN_TRANSIT:
                continue
            dispatched = alloc.get("dispatched_at")
            if dispatched is None or alloc.get("lead_days") is None:
                continue
            if dispatched.tzinfo is not None:
                dispatched = dispatched.replace(tzinfo=None)
            if now_naive < _allocation_due_at(dispatched, alloc):
                continue
            allocs[i] = {**alloc, "status": ALLOC_COMPLETED, "completed_at": now}
            changed = True
            # Stock arrives at the requesting store.
            _adjust_inventory(
                database,
                doc["requester_store_id"],
                doc["product_id"],
                on_hand_delta=int(alloc["qty"]),
            )
            if alloc.get("po_id") is not None:
                database.purchase_orders.update_one(
                    {"_id": alloc["po_id"]},
                    {"$set": {"status": "RECEIVED"}},
                )
                _append_event(database, doc["_id"], "System", "PO_RECEIVED")
            _append_event(database, doc["_id"], "System", "RECEIVED")
            completed_transfers += 1
        if changed:
            database.stock_transfers.update_one(
                {"_id": doc["_id"]},
                {"$set": {"allocations": allocs}},
            )
            refreshed = database.stock_transfers.find_one({"_id": doc["_id"]})
            if refreshed is not None:
                _set_derived_status(database, doc["_id"], refreshed)

    for doc in legacy:
        dispatched = doc["dispatched_at"]
        if dispatched.tzinfo is not None:
            dispatched = dispatched.replace(tzinfo=None)
        if now_naive < dispatched + timedelta(days=int(doc["lead_days"])):
            continue
        database.stock_transfers.update_one(
            {"_id": doc["_id"]},
            {"$set": {"status": STATUS_COMPLETED, "completed_at": now, "remaining_qty": 0}},
        )
        _append_event(database, doc["_id"], "System", "RECEIVED")
        if doc.get("po_id") is not None:
            database.purchase_orders.update_one(
                {"_id": doc["po_id"]},
                {"$set": {"status": "RECEIVED"}},
            )
            _append_event(database, doc["_id"], "System", "PO_RECEIVED")
        completed_transfers += 1

    return completed_transfers


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

    requester_oid = parse_object_id(requester_store_id, "store_id")
    product_oid = parse_object_id(product_id, "product_id")
    existing = database.stock_transfers.find_one(
        {
            "requester_store_id": requester_oid,
            "product_id": product_oid,
            "status": {"$in": list(ACTIVE_FULFILLMENT_STATUSES)},
        }
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Stock is already requested or in transit for this product",
        )

    eligible = _eligible_donor_ids(options)
    unknown = [sid for sid in unique_ids if sid not in eligible]
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more stores cannot safely fulfil this request",
        )

    now = _now()
    qty = int(options.requested_qty)
    invited = [
        {"store_id": parse_object_id(sid, "store_id"), "status": INVITE_PENDING}
        for sid in unique_ids
    ]
    result = database.stock_transfers.insert_one(
        {
            "product_id": product_oid,
            "requester_store_id": requester_oid,
            "qty": qty,
            "remaining_qty": qty,
            "status": STATUS_OPEN,
            "created_at": now,
            "invited": invited,
            "allocations": [],
            "events": [{"at": now, "actor": "System", "action": "REQUESTED"}],
        }
    )
    names = _store_names(database)
    doc = database.stock_transfers.find_one({"_id": result.inserted_id})
    return _build_outgoing(doc, names, options.sku, options.product_name)


def respond_to_transfer(
    transfer_id: str,
    responder_store_id: str,
    body: RespondToTransferRequest,
    db: Optional[Database] = None,
) -> IncomingTransfer:
    database = db if db is not None else get_db()

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
            detail="This transfer request is no longer open for responses",
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
        if doc is not None:
            open_left = any(
                inv["status"] in (INVITE_PENDING, INVITE_CHECKING) for inv in doc["invited"]
            )
            if not open_left:
                _auto_escalate_remaining(database, transfer_oid, doc)

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

        remaining = _remaining(doc)
        if remaining <= 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Nothing remaining to fulfil on this request",
            )

        safe_surplus = _donor_safe_surplus(
            database, str(responder_oid), str(doc["product_id"])
        )
        max_qty = min(remaining, safe_surplus)
        if max_qty < 1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Your store has no safe surplus available to transfer for this product",
            )

        accept_qty = int(body.qty) if body.qty is not None else max_qty
        if accept_qty < 1 or accept_qty > max_qty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Accept qty must be between 1 and {max_qty} "
                    f"(receiver still needs {remaining}; your safe surplus is {safe_surplus})"
                ),
            )

        # Reserve stock now so usable/risk update immediately for the donor.
        _adjust_inventory(
            database,
            responder_oid,
            doc["product_id"],
            reserved_delta=accept_qty,
        )
        # Confirm donor still LOW after reservation.
        post = forecast_service.get_forecast(str(responder_oid), str(doc["product_id"]), db=database)
        if post.risk != "LOW":
            _adjust_inventory(
                database,
                responder_oid,
                doc["product_id"],
                reserved_delta=-accept_qty,
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Accepting that qty would raise your store risk above LOW",
            )

        now = _now()
        lead_days = _store_transit_lead_days(
            database, responder_oid, doc["requester_store_id"]
        )
        new_remaining = remaining - accept_qty
        allocation = {
            "allocation_id": ObjectId(),
            "source": ALLOC_SOURCE_STORE,
            "store_id": responder_oid,
            "qty": accept_qty,
            "status": ALLOC_FULFILLED,
            "accepted_at": now,
            "lead_days": lead_days,
        }
        updates: Dict[str, Any] = {
            f"invited.{my_idx}.status": INVITE_ACCEPTED,
            f"invited.{my_idx}.accepted_qty": accept_qty,
            "remaining_qty": new_remaining,
            "accepted_at": doc.get("accepted_at") or now,
            "accepted_store_id": responder_oid,
            "lead_days": lead_days,
        }
        if new_remaining == 0:
            for i, inv in enumerate(doc["invited"]):
                if i != my_idx and inv["status"] in (INVITE_PENDING, INVITE_CHECKING):
                    updates[f"invited.{i}.status"] = INVITE_PASSED

        database.stock_transfers.update_one(
            {"_id": transfer_oid},
            {"$set": updates, "$push": {"allocations": allocation}},
        )
        event_action = "PARTIAL_ACCEPTED" if new_remaining > 0 else "ACCEPTED"
        _append_event(database, transfer_oid, actor_name, event_action)
        if new_remaining > 0:
            _append_event(database, transfer_oid, "System", "REMAINING_UPDATED")

        doc = database.stock_transfers.find_one({"_id": transfer_oid})
        if doc is not None:
            open_left = any(
                inv["status"] in (INVITE_PENDING, INVITE_CHECKING) for inv in doc["invited"]
            )
            if new_remaining > 0 and not open_left:
                _auto_escalate_remaining(database, transfer_oid, doc)
            else:
                _set_derived_status(database, transfer_oid, doc)

    doc = database.stock_transfers.find_one({"_id": transfer_oid})
    sku, product_name = _product_label(database, doc["product_id"])
    return _build_incoming(doc, responder_oid, names, sku, product_name, db=database)


def dispatch_transfer(
    transfer_id: str,
    dispatcher_store_id: str,
    db: Optional[Database] = None,
) -> OutgoingTransfer:
    database = db if db is not None else get_db()

    try:
        transfer_oid = ObjectId(transfer_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid transfer_id")

    dispatcher_oid = parse_object_id(dispatcher_store_id, "store_id")
    doc = database.stock_transfers.find_one({"_id": transfer_oid})
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transfer not found")

    alloc = _find_store_allocation(doc, dispatcher_oid)
    if alloc is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only a store with an accepted allocation can dispatch",
        )
    if alloc["status"] != ALLOC_FULFILLED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Allocation must be FULFILLED to dispatch, currently {alloc['status']}",
        )

    now = _now()
    qty = int(alloc["qty"])
    _adjust_inventory(
        database,
        dispatcher_oid,
        doc["product_id"],
        on_hand_delta=-qty,
        reserved_delta=-qty,
    )

    allocs = []
    for item in doc.get("allocations", []):
        if item.get("allocation_id") == alloc["allocation_id"]:
            allocs.append(
                {
                    **item,
                    "status": ALLOC_IN_TRANSIT,
                    "dispatched_at": now,
                }
            )
        else:
            allocs.append(item)

    database.stock_transfers.update_one(
        {"_id": transfer_oid},
        {"$set": {"allocations": allocs, "dispatched_at": doc.get("dispatched_at") or now}},
    )
    names = _store_names(database)
    actor_name = names.get(dispatcher_oid, dispatcher_store_id)
    _append_event(database, transfer_oid, actor_name, "DISPATCHED")

    doc = database.stock_transfers.find_one({"_id": transfer_oid})
    _set_derived_status(database, transfer_oid, doc)
    doc = database.stock_transfers.find_one({"_id": transfer_oid})
    sku, product_name = _product_label(database, doc["product_id"])
    return _build_outgoing(doc, names, sku, product_name)


def list_my_transfers(
    store_id: str,
    db: Optional[Database] = None,
) -> MyTransfersResponse:
    database = db if db is not None else get_db()

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
        incoming.append(_build_incoming(doc, store_oid, names, sku, product_name, db=database))

    return MyTransfersResponse(outgoing=outgoing, incoming=incoming)


def get_transfer_detail(
    transfer_id: str,
    viewer_store_id: str,
    db: Optional[Database] = None,
) -> TransferDetail:
    database = db if db is not None else get_db()

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
