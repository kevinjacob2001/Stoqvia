from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import __version__
from app.config import get_settings
from app.db import close_client
from app.routers import router as system_router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    close_client()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        lifespan=lifespan,
    )
    app.include_router(system_router, prefix=settings.api_prefix)
    return app


app = create_app()
