import json
import os
import subprocess
from pathlib import Path
from shutil import which
from urllib.error import URLError
from urllib.request import urlopen

from app.core.config import get_settings
from app.models.settings import (
    AppSettingsRecord,
    DocsMcpDefaultsInstallResult,
    EmbeddingMode,
    EmbeddingSettings,
    OllamaStatus,
)


class AppSettingsStore:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.settings_path = self.settings.data_dir / "settings.json"

    def get(self) -> AppSettingsRecord:
        if not self.settings_path.exists():
            return AppSettingsRecord()

        raw = json.loads(self.settings_path.read_text(encoding="utf-8"))
        return AppSettingsRecord.model_validate(raw)

    def update_embeddings(self, embeddings: EmbeddingSettings) -> AppSettingsRecord:
        current = self.get()
        current.embeddings = embeddings
        self.settings_path.write_text(current.model_dump_json(indent=2), encoding="utf-8")
        return current

    def docs_mcp_env(self) -> dict[str, str]:
        env = os.environ.copy()
        self._strip_embedding_credentials(env)

        embeddings = self.get().embeddings
        if embeddings.mode == EmbeddingMode.OLLAMA:
            env["OPENAI_API_KEY"] = "ollama"
            env["OPENAI_API_BASE"] = f"{embeddings.ollama_base_url.rstrip('/')}/v1"
            env["DOCS_MCP_EMBEDDING_MODEL"] = f"openai:{embeddings.ollama_model}"

        return env

    def docs_mcp_config_app_section(self) -> dict[str, str]:
        embeddings = self.get().embeddings
        if embeddings.mode == EmbeddingMode.OLLAMA:
            return {"embeddingModel": f"openai:{embeddings.ollama_model}"}
        return {"embeddingModel": "text-embedding-3-small"}

    def install_docs_mcp_defaults(self) -> DocsMcpDefaultsInstallResult:
        embeddings = self.get().embeddings
        if embeddings.mode != EmbeddingMode.OLLAMA:
            raise ValueError("Enable Ollama embeddings before configuring docs-mcp defaults")

        embedding_model = f"openai:{embeddings.ollama_model}"
        openai_base = f"{embeddings.ollama_base_url.rstrip('/')}/v1"
        env_vars = {
            "DOCS_MCP_STORE_PATH": str(self.settings.docs_mcp_store_dir),
            "DOCS_MCP_EMBEDDING_MODEL": embedding_model,
            "OPENAI_API_BASE": openai_base,
            "OPENAI_API_KEY": "ollama",
        }

        commands = [
            self._run_docs_mcp_config_set("app.storePath", str(self.settings.docs_mcp_store_dir)),
            self._run_docs_mcp_config_set("app.embeddingModel", embedding_model),
        ]

        for key, value in env_vars.items():
            self._persist_user_env(key, value)
            os.environ[key] = value

        return DocsMcpDefaultsInstallResult(
            config_path=str(self._default_docs_mcp_config_path()),
            store_path=str(self.settings.docs_mcp_store_dir),
            embedding_model=embedding_model,
            env_vars=env_vars,
            commands=commands,
        )

    def get_ollama_status(self) -> OllamaStatus:
        executable = which("ollama")
        installed = executable is not None
        version = None
        error = None

        if installed:
            try:
                completed = subprocess.run(
                    [executable, "--version"],
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=5,
                    check=False,
                )
                version = (completed.stdout or completed.stderr).strip() or None
            except Exception as exc:
                error = str(exc)

        running = False
        models: list[str] = []
        try:
            with urlopen("http://localhost:11434/api/tags", timeout=3) as response:
                payload = json.loads(response.read().decode("utf-8"))
                running = True
                models = sorted(model.get("name", "") for model in payload.get("models", []) if model.get("name"))
        except (OSError, URLError, json.JSONDecodeError) as exc:
            error = error or str(exc)

        return OllamaStatus(installed=installed, running=running, version=version, models=models, error=error)

    def _strip_embedding_credentials(self, env: dict[str, str]) -> None:
        for key in (
            "DOCS_MCP_EMBEDDING_MODEL",
            "DOCS_MCP_EMBEDDINGS_VECTOR_DIMENSION",
            "OPENAI_API_KEY",
            "OPENAI_API_BASE",
            "OPENAI_ORG_ID",
            "GOOGLE_API_KEY",
            "GOOGLE_APPLICATION_CREDENTIALS",
            "AWS_ACCESS_KEY_ID",
            "AWS_SECRET_ACCESS_KEY",
            "AWS_PROFILE",
            "AWS_REGION",
            "BEDROCK_AWS_REGION",
            "AZURE_OPENAI_API_KEY",
            "AZURE_OPENAI_API_INSTANCE_NAME",
            "AZURE_OPENAI_API_DEPLOYMENT_NAME",
            "AZURE_OPENAI_API_VERSION",
        ):
            env.pop(key, None)

    def _run_docs_mcp_config_set(self, path: str, value: str) -> list[str]:
        npm_command = which("npm.cmd") or which("npm") or "npm"
        command = [
            npm_command,
            "--silent",
            "run",
            "cli",
            "--",
            "config",
            "set",
            path,
            value,
            "--quiet",
        ]
        completed = subprocess.run(
            command,
            cwd=self.settings.docs_mcp_dir,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=30,
            check=False,
        )
        if completed.returncode != 0:
            detail = (completed.stderr or completed.stdout or "").strip()
            raise RuntimeError(f"docs-mcp config update failed for {path}: {detail}")
        return command

    def _persist_user_env(self, key: str, value: str) -> None:
        if os.name == "nt":
            completed = subprocess.run(
                ["setx", key, value],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=15,
                check=False,
            )
            if completed.returncode != 0:
                detail = (completed.stderr or completed.stdout or "").strip()
                raise RuntimeError(f"Unable to persist {key}: {detail}")
            return

        raise RuntimeError("Persistent user environment setup is only implemented on Windows")

    def _default_docs_mcp_config_path(self) -> Path:
        if os.name == "nt":
            appdata = os.environ.get("APPDATA")
            if appdata:
                return Path(appdata) / "docs-mcp-server" / "Config" / "config.yaml"

        return Path.home() / ".config" / "docs-mcp-server" / "config.yaml"
