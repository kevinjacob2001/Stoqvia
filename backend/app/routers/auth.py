from fastapi import APIRouter, Depends

from app.deps import require_token
from app.models.auth import LoginRequest, LoginResponse, MeResponse
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest) -> LoginResponse:
    return auth_service.login(body.username, body.password)


@router.get("/me", response_model=MeResponse)
def me(token: str = Depends(require_token)) -> MeResponse:
    return auth_service.get_me(token)
