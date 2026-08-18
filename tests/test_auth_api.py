from typing import Iterator

import pytest
from fastapi.testclient import TestClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

from app.db import close_client, ping
from app.main import app


def _mongo_available() -> bool:
    try:
        ping()
        return True
    except (ConnectionFailure, ServerSelectionTimeoutError):
        return False
    finally:
        close_client()


@pytest.fixture()
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client
    close_client()


pytestmark = pytest.mark.skipif(
    not _mongo_available(),
    reason="MongoDB is not running",
)


def test_login_adelaide_cbd(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "admin.cbd", "password": "cbd123"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["username"] == "admin.cbd"
    assert payload["store_name"] == "Adelaide CBD"
    assert payload["token"]


def test_login_wrong_password(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "admin.cbd", "password": "wrong"},
    )
    assert response.status_code == 401


def test_login_unknown_user(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "admin.unknown", "password": "cbd123"},
    )
    assert response.status_code == 401


def test_me_with_valid_token(client: TestClient) -> None:
    login = client.post(
        "/api/v1/auth/login",
        json={"username": "admin.marion", "password": "marion123"},
    )
    token = login.json()["token"]
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["username"] == "admin.marion"
    assert payload["store_name"] == "Marion"
    assert payload["region"] == "Southern Metro"


def test_me_without_token(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_me_with_bad_token(client: TestClient) -> None:
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer not-a-token"},
    )
    assert response.status_code == 401
