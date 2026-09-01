"""Pydantic models used by the Stoqvia Copilot."""

from enum import Enum
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


class CopilotIntent(str, Enum):
    """Capabilities supported by Stoqvia Copilot."""

    SEARCH_PRODUCTS = "SEARCH_PRODUCTS"
    RECOMMEND_DONORS = "RECOMMEND_DONORS"
    OUT_OF_SCOPE = "OUT_OF_SCOPE"


class CopilotContext(BaseModel):
    """Trusted product context supplied by the interface."""

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
    """Natural-language question sent by the manager."""

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
    """Validated internal representation of an LLM decision."""

    status: Literal[
        "TOOL_SELECTED",
        "CLARIFICATION_REQUIRED",
        "OUT_OF_SCOPE",
    ]

    tool_name: Optional[
        Literal[
            "search_products",
            "recommend_donor_stores",
        ]
    ] = None

    tool_args: Dict[str, Any] = Field(
        default_factory=dict,
    )

    message: Optional[str] = None


class SuggestedAction(BaseModel):
    """Safe navigation action returned to the interface."""

    type: Literal["NAVIGATE"]
    label: str
    path: str


class CopilotResponse(BaseModel):
    """Structured Copilot API response."""

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
