from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Context Hub API"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    project_root: Path = Path(__file__).resolve().parents[3]
    data_dir: Path = project_root / "backend" / "data"
    indexed_docs_dir: Path = data_dir / "indexed-docs"
    source_copies_dir: Path = data_dir / "source-copies"
    jobs_dir: Path = data_dir / "jobs"
    docs_mcp_store_dir: Path = data_dir / "docs-mcp-store"
    docs_mcp_config_path: Path = data_dir / "docs-mcp-config.json"
    docs_mcp_dir: Path = project_root / "docs-mcp-server"
    crawl4ai_dir: Path = project_root / "crawl4ai"
    command_timeout_seconds: int = 600

    model_config = SettingsConfigDict(env_file=".env", env_prefix="CONTEXT_HUB_")


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.indexed_docs_dir.mkdir(parents=True, exist_ok=True)
    settings.source_copies_dir.mkdir(parents=True, exist_ok=True)
    settings.jobs_dir.mkdir(parents=True, exist_ok=True)
    settings.docs_mcp_store_dir.mkdir(parents=True, exist_ok=True)
    return settings
