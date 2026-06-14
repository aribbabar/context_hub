from pathlib import Path

from app.core.config import get_settings
from app.models.sources import SourceRecord


class Crawl4AiScraper:
    """Boundary for web crawling before content is handed to docs-mcp-server."""

    def __init__(self) -> None:
        self.settings = get_settings()

    def output_dir_for(self, source: SourceRecord) -> Path:
        return self.settings.indexed_docs_dir / source.id

    def output_file_for(self, source: SourceRecord) -> Path:
        return self.output_dir_for(source) / "crawl.md"

    def build_crawl_command(self, source: SourceRecord) -> list[str]:
        crwl_exe = self.settings.project_root / "backend" / ".venv" / "Scripts" / "crwl.exe"
        command = [
            str(crwl_exe) if crwl_exe.exists() else "crwl",
            "crawl",
            source.location,
            "--output",
            "markdown",
            "--output-file",
            str(self.output_file_for(source)),
        ]

        max_depth = int(source.metadata.get("max_depth", 0))
        if max_depth > 0:
            command.extend(
                ["--deep-crawl", "bfs", "--max-pages", str(source.metadata.get("max_pages", 10))]
            )

        return command
