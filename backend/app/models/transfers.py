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

# Allocation sources / statuses
ALLOC_SOURCE_STORE = "store"
ALLOC_SOURCE_SUPPLIER = "supplier"
ALLOC_FULFILLED = "FULFILLED"
ALLOC_IN_TRANSIT = "IN_TRANSIT"
ALLOC_COMPLETED = "COMPLETED"


class CreateTransferRequest(BaseModel):
    product_id: str = Field(min_length=1)
    donor_store_ids: List[str] = Field(default_factory=list)
    # Optional; defaults to predicted shortage. Any qty >= 1 is allowed.
    qty: Optional[int] = Field(default=None, ge=1)
    note: Optional[str] = Field(default=None, max_length=500)


class RespondToTransferRequest(BaseModel):
    action: RespondAction
    # Required for ACCEPT when fulfilling a partial amount; omit to accept all remaining.
    qty: Optional[int] = Field(default=None, ge=1)
    # Required when action is DECLINE; ignored otherwise.
    message: Optional[str] = Field(default=None, max_length=500)


class InviteStatus(BaseModel):
    store_id: str
    store_name: str
    status: str
    accepted_qty: Optional[int] = None
    decline_reason: Optional[str] = None


class TransferAllocation(BaseModel):
    allocation_id: str
    source: str
    store_id: Optional[str] = None
    store_name: Optional[str] = None
    qty: int = Field(ge=1)
    status: str
    accepted_at: Optional[datetime] = None
    dispatched_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    lead_days: Optional[int] = None
    po_id: Optional[str] = None


class TransferEvent(BaseModel):
    at: datetime
    actor: str
    action: str


class OutgoingTransfer(BaseModel):
    transfer_id: str
    product_id: str
    sku: str
    product_name: str
    qty: int = Field(ge=1)
    remaining_qty: int = Field(ge=0)
    status: str
    invited: List[InviteStatus]
    allocations: List[TransferAllocation] = Field(default_factory=list)
    # Progress timestamps
    created_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    dispatched_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    accepted_store_name: Optional[str] = None
    lead_days: Optional[int] = None
    note: Optional[str] = None
    events: List[TransferEvent] = Field(default_factory=list)


class IncomingTransfer(BaseModel):
    transfer_id: str
    sku: str
    product_name: str
    qty: int = Field(ge=1)
    remaining_qty: int = Field(ge=0)
    requester_store_name: str
    requester_distance_km: Optional[float] = None
    my_status: str
    my_accepted_qty: Optional[int] = None
    my_allocation: Optional[TransferAllocation] = None
    delivery_lead_days: Optional[int] = None
    # Cap for Accept: min(remaining need, donor safe surplus). Null when not actionable.
    max_accept_qty: Optional[int] = None
    safe_surplus: Optional[int] = None
    fulfilled_other_store_count: int = Field(ge=0)
    # True when another invited store holds the exclusive CHECKING lock.
    stock_under_review_by_other: bool = False
    allocations: List[TransferAllocation] = Field(default_factory=list)
    status: str = STATUS_OPEN
    created_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    dispatched_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    lead_days: Optional[int] = None
    note: Optional[str] = None
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
    remaining_qty: int = Field(ge=0)
    status: str
    requester_store_name: str
    accepted_store_name: Optional[str] = None
    my_status: Optional[str] = None
    is_requester: bool
    fulfilled_other_store_count: Optional[int] = Field(default=None, ge=0)
    invited: List[InviteStatus]
    allocations: List[TransferAllocation] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    dispatched_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    lead_days: Optional[int] = None
    note: Optional[str] = None
    events: List[TransferEvent] = Field(default_factory=list)
    purchase_order: Optional[TransferPurchaseOrder] = None
