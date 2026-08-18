from typing import Iterator

import pytest
from fastapi.testclient import TestClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

from app.db import close_client, get_db, ping
from app.main import app
from app.services.passwords import verify_password


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


def test_health_lists_store_users(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert "store_users" in response.json()["collections"]


def test_seeded_store_admins_are_hashed() -> None:
    db = get_db()
    try:
        users = list(db.store_users.find())
        assert len(users) == 4
        by_username = {row["username"]: row for row in users}
        assert set(by_username) == {
            "admin.cbd",
            "admin.marion",
            "admin.mileend",
            "admin.modbury",
        }
        for row in users:
            assert "password" not in row
            assert row["password_hash"]
        assert verify_password("cbd123", by_username["admin.cbd"]["password_hash"])
        assert not verify_password("wrong", by_username["admin.cbd"]["password_hash"])
    finally:
        close_client()
