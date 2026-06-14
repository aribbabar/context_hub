from fastapi import APIRouter, HTTPException, status

from app.models.settings import DocsMcpDefaultsInstallResult, EmbeddingSettings
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


@router.post("/docs-mcp-defaults", response_model=DocsMcpDefaultsInstallResult)
def install_docs_mcp_defaults() -> DocsMcpDefaultsInstallResult:
    try:
        return settings_store.install_docs_mcp_defaults()
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error)) from error
