from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import folders, health, settings as settings_routes, sources
from app.core.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router, prefix="/api")
    app.include_router(folders.router, prefix="/api")
    app.include_router(settings_routes.router, prefix="/api")
    app.include_router(sources.router, prefix="/api")
    return app


app = create_app()
