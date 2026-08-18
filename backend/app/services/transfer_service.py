"""Broadcast transfer requests. No inventory writes and no Accept yet."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

from fastapi import HTTPException, status
from pymongo.database import Database

from app.db import get_db
from app.models.transfers import (
    IncomingTransfer,
    InviteStatus,
    MyTransfersResponse,
    OutgoingTransfer,
)
from app.services.inventory_service import parse_object_id
from app.services.request_options_service import get_request_options

REQUEST_OPEN = "OPEN"
INVITE_PENDING = "PENDING"


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
    unknown = [store_id for store_id in unique_ids if store_id not in eligible]
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more stores cannot safely fulfil this request",
        )

    requester_oid = parse_object_id(requester_store_id, "store_id")
    product_oid = parse_object_id(product_id, "product_id")
    existing = database.stock_transfers.find_one(
        {
            "requester_store_id": requester_oid,
            "product_id": product_oid,
            "status": REQUEST_OPEN,
        }
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An open transfer request already exists for this product",
        )

    invited = [
        {
            "store_id": parse_object_id(store_id, "store_id"),
            "status": INVITE_PENDING,
        }
        for store_id in unique_ids
    ]
    created_at = datetime.now(timezone.utc).replace(tzinfo=None)
    result = database.stock_transfers.insert_one(
        {
            "product_id": product_oid,
            "requester_store_id": requester_oid,
            "qty": options.requested_qty,
            "status": REQUEST_OPEN,
            "created_at": created_at,
            "invited": invited,
        }
    )
    names = _store_names(database)
    return OutgoingTransfer(
        transfer_id=str(result.inserted_id),
        sku=options.sku,
        product_name=options.product_name,
        qty=options.requested_qty,
        status=REQUEST_OPEN,
        created_at=created_at,
        invited=[
            InviteStatus(
                store_id=store_id,
                store_name=names.get(parse_object_id(store_id, "store_id"), ""),
                status=INVITE_PENDING,
            )
            for store_id in unique_ids
        ],
    )


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
        outgoing.append(
            OutgoingTransfer(
                transfer_id=str(doc["_id"]),
                sku=sku,
                product_name=product_name,
                qty=int(doc["qty"]),
                status=doc["status"],
                created_at=doc["created_at"],
                invited=[
                    InviteStatus(
                        store_id=str(invite["store_id"]),
                        store_name=names.get(invite["store_id"], ""),
                        status=invite["status"],
                    )
                    for invite in doc["invited"]
                ],
            )
        )

    incoming: List[IncomingTransfer] = []
    for doc in incoming_docs:
        invite = next(
            row for row in doc["invited"] if row["store_id"] == store_oid
        )
        sku, product_name = _product_label(database, doc["product_id"])
        incoming.append(
            IncomingTransfer(
                transfer_id=str(doc["_id"]),
                sku=sku,
                product_name=product_name,
                qty=int(doc["qty"]),
                requester_store_id=str(doc["requester_store_id"]),
                requester_store_name=names.get(doc["requester_store_id"], ""),
                status=invite["status"],
                created_at=doc["created_at"],
            )
        )

    return MyTransfersResponse(
        outgoing=outgoing,
        incoming=incoming,
        outgoing_count=len(outgoing),
        incoming_count=len(incoming),
    )
