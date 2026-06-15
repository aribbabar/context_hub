import json
import sqlite3
from contextlib import closing
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
        self.node_command = which("node.exe") or which("node") or "node"
        self.cli_entrypoint = self.settings.docs_mcp_dir / "dist" / "index.js"
        self.ensure_config()

    def build_local_scrape_command(self, source: SourceRecord) -> list[str]:
        docs_url = source.docs_mcp_url or path_to_file_url(Path(source.working_path or source.location))
        return self.build_scrape_command(source, docs_url)

    def build_generated_docs_scrape_command(self, source: SourceRecord, docs_path: Path) -> list[str]:
        return self.build_scrape_command(
            source,
            path_to_file_url(docs_path),
            generated_docs=True,
        )

    def build_scrape_command(
        self,
        source: SourceRecord,
        docs_url: str,
        generated_docs: bool = False,
    ) -> list[str]:
        max_depth = int(source.metadata.get("max_depth", 10))
        command = [
            self.node_command,
            "--enable-source-maps",
            str(self.cli_entrypoint),
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
            str(max(1, max_depth) if generated_docs else max_depth),
            "--max-concurrency",
            str(source.metadata.get("max_concurrency", 4)),
            "--scope",
            (
                "subpages"
                if generated_docs
                else str(source.metadata.get("scope", "subpages"))
            ),
            "--scrape-mode",
            str(source.metadata.get("scrape_mode", "auto")),
        ]

        if source.version and source.version != "latest":
            command.extend(["--version", source.version])

        if not generated_docs:
            for pattern in source.metadata.get("include_patterns", []) or []:
                command.extend(["--include-pattern", str(pattern)])
            for pattern in source.metadata.get("exclude_patterns", []) or []:
                command.extend(["--exclude-pattern", str(pattern)])
            headers = source.metadata.get("headers", {})
            if isinstance(headers, dict):
                for name, value in headers.items():
                    command.extend(["--header", f"{name}:{value}"])

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
            self.node_command,
            "--enable-source-maps",
            str(self.cli_entrypoint),
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

    def build_remove_command(self, source: SourceRecord) -> list[str]:
        command = [
            self.node_command,
            "--enable-source-maps",
            str(self.cli_entrypoint),
            "remove",
            source.name,
            "--store-path",
            str(self.settings.docs_mcp_store_dir),
            "--config",
            str(self.settings.docs_mcp_config_path),
        ]

        if source.version and source.version != "latest":
            command.extend(["--version", source.version])

        return command

    def prune_empty_index_metadata(self, source: SourceRecord) -> bool:
        """Remove empty docs-mcp library/version rows left by the CLI remove command."""
        db_path = self.settings.docs_mcp_store_dir / "documents.db"
        if not db_path.exists():
            return True

        library = source.name.strip().lower()
        version = (source.version or "").strip().lower()
        if version == "latest":
            version = ""

        with closing(sqlite3.connect(db_path)) as connection:
            connection.row_factory = sqlite3.Row
            required_tables = {"libraries", "versions", "pages", "documents"}
            tables = {
                row["name"]
                for row in connection.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table'"
                )
            }
            if not required_tables.issubset(tables):
                return False

            row = connection.execute(
                """
                SELECT
                    v.id AS version_id,
                    v.library_id AS library_id,
                    COUNT(DISTINCT p.id) AS page_count,
                    COUNT(d.id) AS document_count
                FROM versions v
                JOIN libraries l ON v.library_id = l.id
                LEFT JOIN pages p ON p.version_id = v.id
                LEFT JOIN documents d ON d.page_id = p.id
                WHERE l.name = ? AND COALESCE(v.name, '') = ?
                GROUP BY v.id, v.library_id
                """,
                (library, version),
            ).fetchone()

            if row is None:
                return True
            if row["page_count"] > 0 or row["document_count"] > 0:
                return False

            connection.execute("DELETE FROM versions WHERE id = ?", (row["version_id"],))
            remaining_versions = connection.execute(
                "SELECT COUNT(*) FROM versions WHERE library_id = ?",
                (row["library_id"],),
            ).fetchone()[0]
            if remaining_versions == 0:
                connection.execute("DELETE FROM libraries WHERE id = ?", (row["library_id"],))
            connection.commit()

        return True

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
