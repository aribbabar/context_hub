import json
import shutil
from pathlib import Path
from urllib.parse import urlparse, urlunparse
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
        source_paths = self._local_source_paths(request)

        source_id = uuid4().hex
        copy_path = self._copy_local_paths(source_id, source_paths)

        source = SourceRecord(
            id=source_id,
            kind=SourceKind.LOCAL_FOLDER,
            name=request.name or (source_paths[0].name if len(source_paths) == 1 else "Local selection"),
            version=request.version,
            origin_location="; ".join(str(path) for path in source_paths),
            working_path=str(copy_path),
            docs_mcp_url=path_to_file_url(copy_path),
            metadata=self._scrape_metadata(request),
        )
        self._upsert(source)
        return source

    def register_web_source(self, request: WebSourceRequest) -> SourceRecord:
        sources = self._read()
        source_name = request.name or request.url.host or str(request.url)
        source_location = str(request.url)
        existing_source = self._matching_web_source(sources, source_name, source_location)
        source_id = existing_source.id if existing_source else uuid4().hex
        crawl_output_path = self.settings.indexed_docs_dir / source_id / "pages"
        source_kwargs = {
            "id": source_id,
            "kind": SourceKind.WEB,
            "name": source_name,
            "version": request.version,
            "origin_location": source_location,
            "working_path": str(crawl_output_path),
            "docs_mcp_url": path_to_file_url(crawl_output_path),
            "metadata": self._scrape_metadata(request),
        }
        if existing_source:
            source_kwargs["created_at"] = existing_source.created_at

        source = SourceRecord(**source_kwargs)
        sources[source.id] = source
        self._write(sources)
        return source

    def list_sources(self) -> list[SourceRecord]:
        return list(self._read().values())

    def get_source(self, source_id: str) -> SourceRecord | None:
        return self._read().get(source_id)

    def update_source(self, source: SourceRecord) -> SourceRecord:
        self._upsert(source)
        return source

    def delete_source(self, source_id: str) -> SourceRecord | None:
        sources = self._read()
        source = sources.pop(source_id, None)
        if source is None:
            return None

        self._write(sources)
        self._remove_generated_files(source)
        return source

    def has_equivalent_source(self, source: SourceRecord) -> bool:
        return any(
            current.id != source.id
            and current.name == source.name
            and current.version == source.version
            for current in self._read().values()
        )

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

    def _matching_web_source(
        self,
        sources: dict[str, SourceRecord],
        name: str,
        url: str,
    ) -> SourceRecord | None:
        normalized_url = self._normalized_url_key(url)
        for source in sources.values():
            if (
                source.kind == SourceKind.WEB
                and source.name == name
                and self._normalized_url_key(source.origin_location) == normalized_url
            ):
                return source
        return None

    def _normalized_url_key(self, url: str) -> str:
        parsed = urlparse(url)
        path = parsed.path.rstrip("/") or "/"
        return urlunparse(
            (
                parsed.scheme.lower(),
                parsed.netloc.lower(),
                path,
                "",
                parsed.query,
                "",
            )
        )

    def _remove_generated_files(self, source: SourceRecord) -> None:
        candidates = [
            self.settings.source_copies_dir / source.id,
            self.settings.indexed_docs_dir / source.id,
        ]

        for generated_path in candidates:
            self._remove_path_under_data_dir(generated_path)

        if source.working_path:
            self._remove_path_under_data_dir(Path(source.working_path))

    def _remove_path_under_data_dir(self, path: Path) -> None:
        try:
            resolved_path = path.resolve()
            resolved_data_dir = self.settings.data_dir.resolve()
        except OSError:
            return

        if resolved_path == resolved_data_dir or resolved_data_dir not in resolved_path.parents:
            return
        if not resolved_path.exists():
            return

        if resolved_path.is_dir():
            shutil.rmtree(resolved_path)
        else:
            resolved_path.unlink()

    def _scrape_metadata(
        self,
        request: LocalFolderSourceRequest | WebSourceRequest,
    ) -> dict[str, str | int | bool | list[str] | dict[str, str]]:
        metadata = {
            "max_pages": request.max_pages,
            "max_depth": request.max_depth,
            "max_concurrency": request.max_concurrency,
            "include_patterns": request.include_patterns,
            "exclude_patterns": request.exclude_patterns,
            "scope": request.scope,
            "scrape_mode": request.scrape_mode,
            "headers": request.headers,
            "preserve_hashes": request.preserve_hashes,
            "follow_redirects": request.follow_redirects,
            "ignore_errors": request.ignore_errors,
            "clean": request.clean,
        }

        if isinstance(request, LocalFolderSourceRequest):
            metadata["source_count"] = len(self._local_source_paths(request))

        return metadata

    def _local_source_paths(self, request: LocalFolderSourceRequest) -> list[Path]:
        requested_paths = request.paths or ([request.path] if request.path else [])
        if not requested_paths:
            raise FileNotFoundError("Select at least one local folder or file")

        source_paths = [normalize_local_path(path) for path in requested_paths]
        missing_paths = [path for path in source_paths if not path.exists()]
        if missing_paths:
            raise FileNotFoundError(f"Path does not exist: {missing_paths[0]}")

        invalid_paths = [path for path in source_paths if not path.is_dir() and not path.is_file()]
        if invalid_paths:
            raise FileNotFoundError(f"Path is not a file or folder: {invalid_paths[0]}")

        return source_paths

    def _copy_local_paths(self, source_id: str, source_paths: list[Path]) -> Path:
        if len(source_paths) == 1 and source_paths[0].is_dir():
            copy_path = self.settings.source_copies_dir / source_id / source_paths[0].name
            if copy_path.exists():
                shutil.rmtree(copy_path)
            shutil.copytree(source_paths[0], copy_path, ignore=shutil.ignore_patterns(".git", "node_modules", ".venv"))
            return copy_path

        copy_root = self.settings.source_copies_dir / source_id / "selection"
        if copy_root.exists():
            shutil.rmtree(copy_root)
        copy_root.mkdir(parents=True, exist_ok=True)

        used_names: set[str] = set()
        for source_path in source_paths:
            destination = copy_root / self._unique_copy_name(source_path.name, used_names)
            if source_path.is_dir():
                shutil.copytree(source_path, destination, ignore=shutil.ignore_patterns(".git", "node_modules", ".venv"))
            else:
                shutil.copy2(source_path, destination)

        return copy_root

    def _unique_copy_name(self, name: str, used_names: set[str]) -> str:
        if name not in used_names:
            used_names.add(name)
            return name

        stem = Path(name).stem
        suffix = Path(name).suffix
        counter = 2
        while True:
            candidate = f"{stem}-{counter}{suffix}"
            if candidate not in used_names:
                used_names.add(candidate)
                return candidate
            counter += 1
