import json
import sys
from pathlib import Path
from urllib.parse import urlparse

from app.core.config import get_settings
from app.models.sources import SourceRecord


class Crawl4AiScraper:
    """Boundary for web crawling before content is handed to docs-mcp-server."""

    def __init__(self) -> None:
        self.settings = get_settings()

    def output_dir_for(self, source: SourceRecord) -> Path:
        return self.settings.indexed_docs_dir / source.id

    def output_pages_dir_for(self, source: SourceRecord) -> Path:
        return self.output_dir_for(source) / "pages"

    def build_crawl_command(self, source: SourceRecord) -> list[str]:
        crawler_config_path = self._write_crawler_config(source)
        browser_config_path = self._write_browser_config(source)
        command = [
            self._python_executable(),
            str(Path(__file__).with_name("crawl4ai_runner.py")),
            source.location,
            "--crawler-config",
            str(crawler_config_path),
            "--browser-config",
            str(browser_config_path),
            "--output-dir",
            str(self.output_pages_dir_for(source)),
        ]

        return command

    def _python_executable(self) -> str:
        venv_python = self.settings.project_root / "backend" / ".venv" / "Scripts" / "python.exe"
        return str(venv_python) if venv_python.exists() else sys.executable

    def _write_crawler_config(self, source: SourceRecord) -> Path:
        output_dir = self.output_dir_for(source)
        output_dir.mkdir(parents=True, exist_ok=True)
        config_path = output_dir / "crawler-config.json"

        config: dict[str, object] = {
            "semaphore_count": int(source.metadata.get("max_concurrency", 4)),
        }

        max_depth = int(source.metadata.get("max_depth", 0))
        if max_depth > 0:
            config["deep_crawl_strategy"] = {
                "type": "BFSDeepCrawlStrategy",
                "params": {
                    "max_depth": max_depth,
                    "max_pages": int(source.metadata.get("max_pages", 10)),
                    "filter_chain": {
                        "type": "FilterChain",
                        "params": {"filters": self._build_filters(source)},
                    },
                },
            }

        config_path.write_text(json.dumps(config, indent=2), encoding="utf-8")
        return config_path

    def _write_browser_config(self, source: SourceRecord) -> Path:
        output_dir = self.output_dir_for(source)
        output_dir.mkdir(parents=True, exist_ok=True)
        config_path = output_dir / "browser-config.json"

        config: dict[str, object] = {}
        headers = source.metadata.get("headers", {})
        if isinstance(headers, dict) and headers:
            config["headers"] = {
                str(name): str(value)
                for name, value in headers.items()
                if str(name).strip() and str(value).strip()
            }

        config_path.write_text(json.dumps(config, indent=2), encoding="utf-8")
        return config_path

    def _build_filters(self, source: SourceRecord) -> list[dict[str, object]]:
        filters: list[dict[str, object]] = []
        parsed_url = urlparse(source.location)
        host = parsed_url.hostname or ""
        scope = source.metadata.get("scope", "subpages")

        if scope == "hostname" and host:
            filters.append(self._domain_filter([host]))
        elif scope == "domain" and host:
            filters.append(self._domain_filter([self._root_domain(host)]))
        else:
            filters.append(self._pattern_filter([self._subpage_pattern(source.location)]))

        include_patterns = source.metadata.get("include_patterns", [])
        if isinstance(include_patterns, list) and include_patterns:
            filters.append(self._pattern_filter([str(pattern) for pattern in include_patterns]))

        exclude_patterns = source.metadata.get("exclude_patterns", [])
        if isinstance(exclude_patterns, list) and exclude_patterns:
            filters.append(
                self._pattern_filter([str(pattern) for pattern in exclude_patterns], reverse=True)
            )

        return filters

    def _domain_filter(self, domains: list[str]) -> dict[str, object]:
        return {
            "type": "DomainFilter",
            "params": {"allowed_domains": domains},
        }

    def _pattern_filter(self, patterns: list[str], reverse: bool = False) -> dict[str, object]:
        return {
            "type": "URLPatternFilter",
            "params": {
                "patterns": [self._normalize_crawl_pattern(pattern) for pattern in patterns],
                "reverse": reverse,
            },
        }

    def _normalize_crawl_pattern(self, pattern: str) -> str:
        stripped_pattern = pattern.strip()
        if (
            stripped_pattern.startswith("/")
            and stripped_pattern.endswith("/")
            and len(stripped_pattern) > 2
        ):
            return stripped_pattern[1:-1]

        return stripped_pattern.replace("**", "*")

    def _subpage_pattern(self, url: str) -> str:
        return f"{url.rstrip('/')}*"

    def _root_domain(self, host: str) -> str:
        parts = host.split(".")
        if len(parts) <= 2:
            return host
        return ".".join(parts[-2:])
