import json
from pathlib import Path
from shutil import which

from app.core.config import get_settings
from app.models.sources import SourceRecord
from app.services.app_settings import AppSettingsStore
from app.services.path_utils import path_to_file_url


class DocsMcpAdapter:
    """Adapter for building docs-mcp-server CLI commands."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.app_settings = AppSettingsStore()
        self.npm_command = which("npm.cmd") or which("npm") or "npm"
        self.ensure_config()

    def build_local_scrape_command(self, source: SourceRecord) -> list[str]:
        docs_url = source.docs_mcp_url or path_to_file_url(Path(source.working_path or source.location))
        return self.build_scrape_command(source, docs_url)

    def build_generated_docs_scrape_command(self, source: SourceRecord, docs_path: Path) -> list[str]:
        return self.build_scrape_command(source, path_to_file_url(docs_path))

    def build_scrape_command(self, source: SourceRecord, docs_url: str) -> list[str]:
        command = [
            self.npm_command,
            "--silent",
            "run",
            "cli",
            "--",
            "scrape",
            source.name,
            docs_url,
            "--store-path",
            str(self.settings.docs_mcp_store_dir),
            "--config",
            str(self.settings.docs_mcp_config_path),
            "--max-pages",
            str(source.metadata.get("max_pages", 100)),
            "--max-depth",
            str(source.metadata.get("max_depth", 10)),
            "--max-concurrency",
            str(source.metadata.get("max_concurrency", 4)),
            "--scope",
            str(source.metadata.get("scope", "subpages")),
            "--scrape-mode",
            str(source.metadata.get("scrape_mode", "auto")),
        ]

        if source.version and source.version != "latest":
            command.extend(["--version", source.version])

        for pattern in source.metadata.get("include_patterns", []) or []:
            command.extend(["--include-pattern", str(pattern)])
        for pattern in source.metadata.get("exclude_patterns", []) or []:
            command.extend(["--exclude-pattern", str(pattern)])

        if source.metadata.get("preserve_hashes", False):
            command.append("--preserve-hashes")
        if not source.metadata.get("follow_redirects", True):
            command.append("--no-follow-redirects")
        if not source.metadata.get("ignore_errors", True):
            command.extend(["--ignore-errors", "false"])
        if not source.metadata.get("clean", True):
            command.extend(["--clean", "false"])

        return command

    def build_search_command(
        self,
        source: SourceRecord,
        query: str,
        limit: int,
        exact_match: bool,
    ) -> list[str]:
        command = [
            self.npm_command,
            "--silent",
            "run",
            "cli",
            "--",
            "search",
            source.name,
            query,
            "--limit",
            str(limit),
            "--store-path",
            str(self.settings.docs_mcp_store_dir),
            "--config",
            str(self.settings.docs_mcp_config_path),
            "--output",
            "json",
        ]

        if source.version and source.version != "latest":
            command.extend(["--version", source.version])

        if exact_match:
            command.append("--exact-match")

        return command

    def ensure_config(self) -> None:
        config = {
            "app": self.app_settings.docs_mcp_config_app_section(),
            "scraper": {
                "security": {
                    "network": {
                        "mode": "open",
                        "allowPrivateNetworks": False,
                        "allowedHosts": [],
                        "allowedCidrs": [],
                        "allowInvalidTls": False,
                    },
                    "fileAccess": {
                        "mode": "allowedRoots",
                        "allowedRoots": [
                            str(self.settings.source_copies_dir),
                            str(self.settings.indexed_docs_dir),
                        ],
                        "followSymlinks": False,
                        "includeHidden": False,
                    },
                }
            }
        }
        self.settings.docs_mcp_config_path.write_text(json.dumps(config, indent=2), encoding="utf-8")
