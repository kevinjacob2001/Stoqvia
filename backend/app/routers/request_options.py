from __future__ import annotations

from fastapi import APIRouter, Depends

from app.deps import require_token
from app.models.request_options import RequestOptionsResponse
from app.services import auth_service, request_options_service

router = APIRouter(tags=["request-options"])


@router.get(
    "/me/products/{product_id}/request-options",
    response_model=RequestOptionsResponse,
)
def get_request_options(
    product_id: str,
    token: str = Depends(require_token),
) -> RequestOptionsResponse:
    me = auth_service.get_me(token)
    return request_options_service.get_request_options(me.store_id, product_id)
