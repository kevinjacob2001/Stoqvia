"""Schemas for the Stoqvia store-admin copilot."""

from enum import Enum
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class CopilotIntent(str, Enum):
    FIND_HIGH_RISK_PRODUCTS = "FIND_HIGH_RISK_PRODUCTS"
    RECOMMEND_DONORS = "RECOMMEND_DONORS"
    OUT_OF_SCOPE = "OUT_OF_SCOPE"


class CopilotContext(BaseModel):
    product_id: Optional[str] = None


class CopilotRequest(BaseModel):
    message: str = Field(min_length=2, max_length=300)
    context: CopilotContext = Field(default_factory=CopilotContext)


class SuggestedAction(BaseModel):
    type: Literal["NAVIGATE"] = "NAVIGATE"
    label: str
    path: str


class CopilotResponse(BaseModel):
    intent: CopilotIntent
    answer: str
    data: Dict[str, Any] = Field(default_factory=dict)
    suggested_actions: List[SuggestedAction] = Field(default_factory=list)
