"""Main FastAPI application for Stoqvia."""

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.config import get_settings
from app.db import close_client
from app.jobs.auto_complete import (
    auto_complete_loop,
)
from app.routers import (
    router as system_router,
)
from app.routers.auth import (
    router as auth_router,
)
from app.routers.copilot import (
    router as copilot_router,
)
from app.routers.forecasts import (
    router as forecast_router,
)
from app.routers.inventory import (
    router as inventory_router,
)
from app.routers.request_options import (
    router as request_options_router,
)
from app.routers.transfers import (
    router as transfer_router,
)


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """
    Start and stop Stoqvia background resources.
    """

    get_settings.cache_clear()
    settings = get_settings()

    stop = asyncio.Event()
    task: Optional[asyncio.Task] = None

    interval = (
        settings
        .auto_complete_interval_seconds
    )

    if interval > 0:
        task = asyncio.create_task(
            auto_complete_loop(
                stop,
                interval,
            )
        )

        logger.info(
            "Auto-complete job started "
            "(every %ss)",
            interval,
        )

    yield

    stop.set()

    if task is not None:
        await task

    close_client()


def create_app() -> FastAPI:
    """
    Create and configure the Stoqvia FastAPI application.
    """

    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        lifespan=lifespan,
    )

    app.include_router(
        system_router,
        prefix=settings.api_prefix,
    )

    app.include_router(
        auth_router,
        prefix=settings.api_prefix,
    )

    app.include_router(
        inventory_router,
        prefix=settings.api_prefix,
    )

    app.include_router(
        forecast_router,
        prefix=settings.api_prefix,
    )

    app.include_router(
        request_options_router,
        prefix=settings.api_prefix,
    )

    app.include_router(
        transfer_router,
        prefix=settings.api_prefix,
    )

    app.include_router(
        copilot_router,
        prefix=settings.api_prefix,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=(
            settings.cors_origin_list()
        ),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    return app


app = create_app()
