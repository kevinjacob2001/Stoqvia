from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.models.auth import LoginRequest, LoginResponse, MeResponse
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])
_bearer = HTTPBearer(auto_error=False)


def _require_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> str:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return credentials.credentials


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest) -> LoginResponse:
    return auth_service.login(body.username, body.password)


@router.get("/me", response_model=MeResponse)
def me(token: str = Depends(_require_token)) -> MeResponse:
    return auth_service.get_me(token)
