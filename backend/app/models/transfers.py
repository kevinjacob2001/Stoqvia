from datetime import datetime
from typing import List

from pydantic import BaseModel, Field


class CreateTransferRequest(BaseModel):
    product_id: str = Field(min_length=1)
    donor_store_ids: List[str] = Field(min_length=1)


class InviteStatus(BaseModel):
    store_id: str
    store_name: str
    status: str


class OutgoingTransfer(BaseModel):
    transfer_id: str
    sku: str
    product_name: str
    qty: int = Field(ge=1)
    status: str
    invited: List[InviteStatus]


class IncomingTransfer(BaseModel):
    transfer_id: str
    sku: str
    product_name: str
    qty: int = Field(ge=1)
    requester_store_name: str
    status: str


class MyTransfersResponse(BaseModel):
    outgoing: List[OutgoingTransfer]
    incoming: List[IncomingTransfer]
