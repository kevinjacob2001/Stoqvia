"""Pydantic models used by the Stoqvia Copilot."""

from enum import Enum
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


class CopilotIntent(str, Enum):
    """Inventory capabilities supported by the Copilot."""

    FIND_HIGH_RISK_PRODUCTS = "FIND_HIGH_RISK_PRODUCTS"
    RECOMMEND_DONORS = "RECOMMEND_DONORS"
    OUT_OF_SCOPE = "OUT_OF_SCOPE"


class CopilotContext(BaseModel):
    """
    Trusted product context supplied by the Stoqvia interface.

    The store ID is not included because it must come from
    the authenticated backend session.
    """

    product_id: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    @field_validator("product_id")
    @classmethod
    def clean_product_id(
        cls,
        value: Optional[str],
    ) -> Optional[str]:
        if value is None:
            return None

        cleaned = value.strip()
        return cleaned or None


class CopilotRequest(BaseModel):
    """Request received from the Stoqvia frontend."""

    message: str = Field(
        min_length=1,
        max_length=500,
    )

    context: CopilotContext = Field(
        default_factory=CopilotContext,
    )

    @field_validator("message")
    @classmethod
    def clean_message(cls, value: str) -> str:
        cleaned = value.strip()

        if not cleaned:
            raise ValueError("Message cannot be empty.")

        return cleaned


class ToolSelection(BaseModel):
    """
    Validated internal representation of the tool requested
    by the LLM.
    """

    status: Literal[
        "TOOL_SELECTED",
        "CLARIFICATION_REQUIRED",
        "OUT_OF_SCOPE",
    ]

    tool_name: Optional[
        Literal[
            "find_high_risk_products",
            "recommend_donor_stores",
        ]
    ] = None

    tool_args: Dict[str, Any] = Field(
        default_factory=dict,
    )

    message: Optional[str] = None


class SuggestedAction(BaseModel):
    """
    Safe action returned to the frontend.

    The Copilot may navigate the manager to a page, but it
    cannot create or modify a stock transfer.
    """

    type: Literal["NAVIGATE"]
    label: str
    path: str


class CopilotResponse(BaseModel):
    """Structured response returned by the Copilot API."""

    status: Literal[
        "SUCCESS",
        "CLARIFICATION_REQUIRED",
        "OUT_OF_SCOPE",
        "ERROR",
    ]

    intent: CopilotIntent
    message: str

    data: Optional[Dict[str, Any]] = None

    suggested_actions: List[SuggestedAction] = Field(
        default_factory=list,
    )