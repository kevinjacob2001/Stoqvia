from __future__ import annotations

from fastapi import APIRouter, Depends

from app.deps import require_token
from app.models.transfers import (
    CreateTransferRequest,
    IncomingTransfer,
    MyTransfersResponse,
    OutgoingTransfer,
    RespondToTransferRequest,
)
from app.services import auth_service, transfer_service

router = APIRouter(tags=["transfers"])


@router.get("/me/transfers", response_model=MyTransfersResponse)
def list_my_transfers(token: str = Depends(require_token)) -> MyTransfersResponse:
    me = auth_service.get_me(token)
    return transfer_service.list_my_transfers(me.store_id)


@router.post("/me/transfers", response_model=OutgoingTransfer)
def create_transfer(
    body: CreateTransferRequest,
    token: str = Depends(require_token),
) -> OutgoingTransfer:
    me = auth_service.get_me(token)
    return transfer_service.create_transfer(me.store_id, body.product_id, body.donor_store_ids)


@router.post("/me/transfers/{transfer_id}/respond", response_model=IncomingTransfer)
def respond_to_transfer(
    transfer_id: str,
    body: RespondToTransferRequest,
    token: str = Depends(require_token),
) -> IncomingTransfer:
    me = auth_service.get_me(token)
    return transfer_service.respond_to_transfer(transfer_id, me.store_id, body)


@router.post("/me/transfers/{transfer_id}/dispatch", response_model=OutgoingTransfer)
def dispatch_transfer(
    transfer_id: str,
    token: str = Depends(require_token),
) -> OutgoingTransfer:
    me = auth_service.get_me(token)
    return transfer_service.dispatch_transfer(transfer_id, me.store_id)
