from __future__ import annotations

from fastapi import APIRouter, Depends

from app.deps import require_token
from app.models.transfers import (
    CreateTransferRequest,
    IncomingTransfer,
    MyTransfersResponse,
    OutgoingTransfer,
    RespondToTransferRequest,
    TransferDetail,
)
from app.services import auth_service, transfer_service

router = APIRouter(tags=["transfers"])


@router.get("/transfers", response_model=MyTransfersResponse)
def list_my_transfers(token: str = Depends(require_token)) -> MyTransfersResponse:
    me = auth_service.get_me(token)
    return transfer_service.list_my_transfers(me.store_id)


@router.post("/transfers", response_model=OutgoingTransfer)
def create_transfer(
    body: CreateTransferRequest,
    token: str = Depends(require_token),
) -> OutgoingTransfer:
    me = auth_service.get_me(token)
    return transfer_service.create_transfer(me.store_id, body.product_id, body.donor_store_ids)


@router.post("/transfers/jobs/complete-due")
def run_complete_due(token: str = Depends(require_token)) -> dict:
    """Manually run the due-transfer completion sweep (also runs on a timer)."""
    auth_service.get_me(token)
    completed = transfer_service.complete_due_transfers()
    return {"completed": completed}


@router.post("/transfers/{transfer_id}/respond", response_model=IncomingTransfer)
def respond_to_transfer(
    transfer_id: str,
    body: RespondToTransferRequest,
    token: str = Depends(require_token),
) -> IncomingTransfer:
    me = auth_service.get_me(token)
    return transfer_service.respond_to_transfer(transfer_id, me.store_id, body)


@router.post("/transfers/{transfer_id}/dispatch", response_model=OutgoingTransfer)
def dispatch_transfer(
    transfer_id: str,
    token: str = Depends(require_token),
) -> OutgoingTransfer:
    me = auth_service.get_me(token)
    return transfer_service.dispatch_transfer(transfer_id, me.store_id)


@router.get("/transfers/{transfer_id}", response_model=TransferDetail)
def get_transfer_detail(
    transfer_id: str,
    token: str = Depends(require_token),
) -> TransferDetail:
    me = auth_service.get_me(token)
    return transfer_service.get_transfer_detail(transfer_id, me.store_id)
