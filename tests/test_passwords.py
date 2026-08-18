from app.services.passwords import hash_password, verify_password


def test_hash_and_verify_roundtrip() -> None:
    stored = hash_password("cbd123")
    assert stored.startswith("pbkdf2_sha256$")
    assert "cbd123" not in stored
    assert verify_password("cbd123", stored) is True
    assert verify_password("wrong", stored) is False
