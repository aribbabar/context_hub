from datetime import UTC, datetime
from enum import StrEnum
from pathlib import Path
from uuid import uuid4

from pydantic import BaseModel, Field, HttpUrl


class SourceKind(StrEnum):
    LOCAL_FOLDER = "local_folder"
    WEB = "web"


class SourceStatus(StrEnum):
    REGISTERED = "registered"
    QUEUED = "queued"
    INDEXING = "indexing"
    INDEXED = "indexed"
    FAILED = "failed"


class LocalFolderSourceRequest(BaseModel):
    path: Path
    name: str | None = None
    version: str = "latest"
    max_pages: int = Field(default=100, ge=1, le=10000)
    max_depth: int = Field(default=10, ge=0, le=100)
    max_concurrency: int = Field(default=4, ge=1, le=32)
    include_patterns: list[str] = Field(default_factory=list)
    exclude_patterns: list[str] = Field(default_factory=list)
    scope: str = "subpages"
    scrape_mode: str = "auto"
    preserve_hashes: bool = False
    follow_redirects: bool = True
    ignore_errors: bool = True
    clean: bool = True


class WebSourceRequest(BaseModel):
    url: HttpUrl
    name: str | None = None
    version: str = "latest"
    max_depth: int = Field(default=2, ge=0, le=10)
    max_pages: int = Field(default=25, ge=1, le=1000)
    max_concurrency: int = Field(default=4, ge=1, le=32)
    include_patterns: list[str] = Field(default_factory=list)
    exclude_patterns: list[str] = Field(default_factory=list)
    scope: str = "subpages"
    scrape_mode: str = "auto"
    preserve_hashes: bool = False
    follow_redirects: bool = True
    ignore_errors: bool = True
    clean: bool = True


class SourceRecord(BaseModel):
    id: str = Field(default_factory=lambda: uuid4().hex)
    kind: SourceKind
    name: str
    version: str
    origin_location: str
    working_path: str | None = None
    docs_mcp_url: str | None = None
    metadata: dict[str, str | int | bool | list[str]] = Field(default_factory=dict)
    status: SourceStatus = SourceStatus.REGISTERED
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    @property
    def location(self) -> str:
        return self.origin_location


class SourceRegistrationResponse(BaseModel):
    source: SourceRecord
    command_preview: list[str]


class SourceDeletionResponse(BaseModel):
    deleted_source: SourceRecord
    docs_mcp_command: list[str] | None = None
    docs_mcp_stdout: str = ""
    docs_mcp_stderr: str = ""
    docs_mcp_removed: bool = False
    docs_mcp_skipped: bool = False


class SourceIndexRequest(BaseModel):
    source_id: str


class SearchRequest(BaseModel):
    source_id: str
    query: str
    limit: int = Field(default=5, ge=1, le=25)
    exact_match: bool = False


class SearchResponse(BaseModel):
    command: list[str]
    stdout: str
    stderr: str
    results: object | None = None
