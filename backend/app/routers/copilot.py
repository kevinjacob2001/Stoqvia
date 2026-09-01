"""Authenticated API routes for Stoqvia Copilot."""

from fastapi import APIRouter, Depends

from app.deps import require_token
from app.models.copilot import CopilotRequest, CopilotResponse
from app.services import auth_service
from app.services.copilot_services import run_copilot

router = APIRouter(
    prefix="/copilot",
    tags=["Copilot"],
)


@router.post(
    "/chat",
    response_model=CopilotResponse,
)
async def chat_with_copilot(
    request: CopilotRequest,
    token: str = Depends(require_token),
) -> CopilotResponse:
    """
    Interpret a manager's natural-language inventory
    question and execute one approved read-only tool.
    """
    me = auth_service.get_me(token)
    return await run_copilot(
        message=request.message,
        authenticated_store_id=me.store_id,
        selected_product_id=request.context.product_id,
    )
