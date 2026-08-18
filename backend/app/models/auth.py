"""Auth request and response models. No extra profile fields."""

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class LoginResponse(BaseModel):
    token: str
    store_id: str
    store_name: str
    username: str


class MeResponse(BaseModel):
    store_id: str
    store_name: str
    region: str
    username: str
