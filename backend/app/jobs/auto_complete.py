"""Background sweep that completes due in-transit transfers."""

from __future__ import annotations

import asyncio
import logging

from app.services.transfer_service import complete_due_transfers

logger = logging.getLogger(__name__)


async def auto_complete_loop(stop: asyncio.Event, interval_seconds: int) -> None:
    """Periodically complete transfers whose lead time has elapsed."""
    while not stop.is_set():
        try:
            completed = await asyncio.to_thread(complete_due_transfers)
            if completed:
                logger.info("Auto-completed %s due transfer(s)", completed)
        except Exception:
            logger.exception("Auto-complete sweep failed")
        try:
            await asyncio.wait_for(stop.wait(), timeout=interval_seconds)
        except asyncio.TimeoutError:
            continue
