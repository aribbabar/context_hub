from enum import StrEnum

from pydantic import BaseModel, Field


class EmbeddingMode(StrEnum):
    DISABLED = "disabled"
    OLLAMA = "ollama"


class EmbeddingSettings(BaseModel):
    mode: EmbeddingMode = EmbeddingMode.DISABLED
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "nomic-embed-text"


class AppSettingsRecord(BaseModel):
    embeddings: EmbeddingSettings = Field(default_factory=EmbeddingSettings)


class OllamaStatus(BaseModel):
    installed: bool
    running: bool
    version: str | None = None
    models: list[str] = Field(default_factory=list)
    error: str | None = None
