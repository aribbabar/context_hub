import json
import shutil
from uuid import uuid4

from app.core.config import get_settings
from app.models.sources import (
    LocalFolderSourceRequest,
    SourceKind,
    SourceRecord,
    WebSourceRequest,
)
from app.services.path_utils import normalize_local_path, path_to_file_url


class SourceRegistry:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.registry_path = self.settings.data_dir / "sources.json"

    def register_local_folder(self, request: LocalFolderSourceRequest) -> SourceRecord:
        folder = normalize_local_path(request.path)
        if not folder.exists() or not folder.is_dir():
            raise FileNotFoundError(f"Folder does not exist: {folder}")

        source_id = uuid4().hex
        copy_path = self.settings.source_copies_dir / source_id / folder.name
        if copy_path.exists():
            shutil.rmtree(copy_path)
        shutil.copytree(folder, copy_path, ignore=shutil.ignore_patterns(".git", "node_modules", ".venv"))

        source = SourceRecord(
            id=source_id,
            kind=SourceKind.LOCAL_FOLDER,
            name=request.name or folder.name,
            version=request.version,
            origin_location=str(folder),
            working_path=str(copy_path),
            docs_mcp_url=path_to_file_url(copy_path),
            metadata=self._scrape_metadata(request),
        )
        self._upsert(source)
        return source

    def register_web_source(self, request: WebSourceRequest) -> SourceRecord:
        source_id = uuid4().hex
        crawl_output_path = self.settings.indexed_docs_dir / source_id / "crawl.md"
        source = SourceRecord(
            id=source_id,
            kind=SourceKind.WEB,
            name=request.name or request.url.host or str(request.url),
            version=request.version,
            origin_location=str(request.url),
            working_path=str(crawl_output_path),
            docs_mcp_url=path_to_file_url(crawl_output_path),
            metadata=self._scrape_metadata(request),
        )
        self._upsert(source)
        return source

    def list_sources(self) -> list[SourceRecord]:
        return list(self._read().values())

    def get_source(self, source_id: str) -> SourceRecord | None:
        return self._read().get(source_id)

    def update_source(self, source: SourceRecord) -> SourceRecord:
        self._upsert(source)
        return source

    def _upsert(self, source: SourceRecord) -> None:
        sources = self._read()
        sources[source.id] = source
        self._write(sources)

    def _read(self) -> dict[str, SourceRecord]:
        if not self.registry_path.exists():
            return {}

        raw_sources = json.loads(self.registry_path.read_text(encoding="utf-8"))
        return {source_id: SourceRecord.model_validate(raw) for source_id, raw in raw_sources.items()}

    def _write(self, sources: dict[str, SourceRecord]) -> None:
        self.registry_path.parent.mkdir(parents=True, exist_ok=True)
        serialized = {source_id: source.model_dump(mode="json") for source_id, source in sources.items()}
        self.registry_path.write_text(json.dumps(serialized, indent=2), encoding="utf-8")

    def _scrape_metadata(
        self,
        request: LocalFolderSourceRequest | WebSourceRequest,
    ) -> dict[str, str | int | bool | list[str]]:
        return {
            "max_pages": request.max_pages,
            "max_depth": request.max_depth,
            "max_concurrency": request.max_concurrency,
            "include_patterns": request.include_patterns,
            "exclude_patterns": request.exclude_patterns,
            "scope": request.scope,
            "scrape_mode": request.scrape_mode,
            "preserve_hashes": request.preserve_hashes,
            "follow_redirects": request.follow_redirects,
            "ignore_errors": request.ignore_errors,
            "clean": request.clean,
        }
