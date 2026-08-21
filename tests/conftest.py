"""Disable the background auto-complete loop during pytest."""

import pytest


@pytest.fixture(autouse=True)
def _disable_auto_complete_job(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AUTO_COMPLETE_INTERVAL_SECONDS", "0")
    from app.config import get_settings

    get_settings.cache_clear()
