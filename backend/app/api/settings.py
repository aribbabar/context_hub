from fastapi import APIRouter

from app.models.settings import EmbeddingSettings
from app.services.app_settings import AppSettingsStore

router = APIRouter(prefix="/settings", tags=["settings"])
settings_store = AppSettingsStore()


@router.get("")
def get_settings():
    return {
        "settings": settings_store.get(),
        "ollama": settings_store.get_ollama_status(),
    }


@router.put("/embeddings")
def update_embeddings(settings: EmbeddingSettings):
    updated = settings_store.update_embeddings(settings)
    from app.services.docs_mcp import DocsMcpAdapter

    DocsMcpAdapter().ensure_config()
    return {
        "settings": updated,
        "ollama": settings_store.get_ollama_status(),
    }


@router.get("/ollama")
def get_ollama_status():
    return settings_store.get_ollama_status()
