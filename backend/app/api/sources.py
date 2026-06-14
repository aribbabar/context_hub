import json
import subprocess

from fastapi import APIRouter, HTTPException, status

from app.core.config import get_settings
from app.models.sources import (
    LocalFolderSourceRequest,
    SearchRequest,
    SearchResponse,
    SourceIndexRequest,
    SourceRegistrationResponse,
    WebSourceRequest,
)
from app.services.crawl4ai_scraper import Crawl4AiScraper
from app.services.docs_mcp import DocsMcpAdapter
from app.services.job_runner import JobRunner
from app.services.source_registry import SourceRegistry
from app.services.app_settings import AppSettingsStore

router = APIRouter(prefix="/sources", tags=["sources"])
settings = get_settings()
registry = SourceRegistry()
docs_mcp = DocsMcpAdapter()
crawl4ai = Crawl4AiScraper()
jobs = JobRunner()
app_settings = AppSettingsStore()


@router.post("/local-folder", response_model=SourceRegistrationResponse)
def register_local_folder(request: LocalFolderSourceRequest) -> SourceRegistrationResponse:
    try:
        source = registry.register_local_folder(request)
    except FileNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error

    command_preview = docs_mcp.build_local_scrape_command(source)
    return SourceRegistrationResponse(source=source, command_preview=command_preview)


@router.post("/web", response_model=SourceRegistrationResponse, status_code=status.HTTP_202_ACCEPTED)
def register_web_source(request: WebSourceRequest) -> SourceRegistrationResponse:
    source = registry.register_web_source(request)
    return SourceRegistrationResponse(
        source=source,
        command_preview=crawl4ai.build_crawl_command(source),
    )


@router.get("")
def list_sources():
    return {"sources": registry.list_sources(), "jobs": jobs.list_jobs()}


@router.get("/{source_id}")
def get_source(source_id: str):
    source = registry.get_source(source_id)
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")
    return {"source": source, "latest_job": jobs.latest_job_for_source(source_id)}


@router.post("/{source_id}/index")
def start_index_source(source_id: str):
    source = registry.get_source(source_id)
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")

    job = jobs.start_index_job(source)
    return {"job": job}


@router.post("/index")
def start_index_source_by_body(request: SourceIndexRequest):
    return start_index_source(request.source_id)


@router.get("/jobs/{job_id}")
def get_index_job(job_id: str):
    job = jobs.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return {"job": job, "logs": jobs.read_logs(job_id)}


@router.get("/jobs/{job_id}/logs")
def get_index_job_logs(job_id: str):
    job = jobs.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return {"logs": jobs.read_logs(job_id)}


@router.post("/search", response_model=SearchResponse)
def search_source(request: SearchRequest) -> SearchResponse:
    source = registry.get_source(request.source_id)
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")

    command = docs_mcp.build_search_command(source, request.query, request.limit, request.exact_match)
    completed = subprocess.run(
        command,
        cwd=settings.docs_mcp_dir,
        env=app_settings.docs_mcp_env(),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )

    parsed_results = None
    if completed.stdout.strip():
        try:
            parsed_results = json.loads(completed.stdout)
        except json.JSONDecodeError:
            parsed_results = _extract_json_payload(completed.stdout)

    return SearchResponse(
        command=command,
        stdout=completed.stdout,
        stderr=completed.stderr,
        results=parsed_results,
    )


def _extract_json_payload(output: str):
    start = output.find("[")
    end = output.rfind("]")
    if start == -1 or end == -1 or end < start:
        return None
    try:
        return json.loads(output[start : end + 1])
    except json.JSONDecodeError:
        return None
