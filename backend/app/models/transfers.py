from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

RespondAction = Literal["ACCEPT", "DECLINE", "CHECK_STOCK", "CLEAR_CHECK"]

# Request-level statuses
STATUS_OPEN = "OPEN"
STATUS_FULFILLED = "FULFILLED"
STATUS_IN_TRANSIT = "IN_TRANSIT"
STATUS_COMPLETED = "COMPLETED"
STATUS_DECLINED = "DECLINED"

# Invite-level statuses
INVITE_PENDING = "PENDING"
INVITE_ACCEPTED = "ACCEPTED"
INVITE_DECLINED = "DECLINED"
INVITE_CHECKING = "CHECKING"
INVITE_PASSED = "PASSED"


class CreateTransferRequest(BaseModel):
    product_id: str = Field(min_length=1)
    donor_store_ids: List[str] = Field(min_length=1)


class RespondToTransferRequest(BaseModel):
    action: RespondAction


class InviteStatus(BaseModel):
    store_id: str
    store_name: str
    status: str


class TransferEvent(BaseModel):
    at: datetime
    actor: str
    action: str


class OutgoingTransfer(BaseModel):
    transfer_id: str
    sku: str
    product_name: str
    qty: int = Field(ge=1)
    status: str
    invited: List[InviteStatus]
    # Progress timestamps
    created_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    dispatched_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    accepted_store_name: Optional[str] = None
    lead_days: Optional[int] = None
    events: List[TransferEvent] = Field(default_factory=list)


class IncomingTransfer(BaseModel):
    transfer_id: str
    sku: str
    product_name: str
    qty: int = Field(ge=1)
    requester_store_name: str
    my_status: str
    all_invited: List[InviteStatus]
    # Progress timestamps (visible once accepted)
    status: str = STATUS_OPEN
    created_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    dispatched_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    lead_days: Optional[int] = None
    events: List[TransferEvent] = Field(default_factory=list)


class MyTransfersResponse(BaseModel):
    outgoing: List[OutgoingTransfer]
    incoming: List[IncomingTransfer]


class TransferPurchaseOrder(BaseModel):
    po_id: str
    supplier_name: str
    qty: int = Field(ge=1)
    status: str
    expected_date: Optional[datetime] = None


class TransferDetail(BaseModel):
    transfer_id: str
    sku: str
    product_name: str
    qty: int = Field(ge=1)
    status: str
    requester_store_name: str
    accepted_store_name: Optional[str] = None
    my_status: Optional[str] = None
    invited: List[InviteStatus]
    created_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    dispatched_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    lead_days: Optional[int] = None
    events: List[TransferEvent] = Field(default_factory=list)
    purchase_order: Optional[TransferPurchaseOrder] = None
