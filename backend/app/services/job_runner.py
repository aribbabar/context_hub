import json
import subprocess
import threading
import time
from datetime import UTC, datetime
from pathlib import Path
from queue import Empty, Queue

from app.core.config import get_settings
from app.models.jobs import IndexJob, JobStatus
from app.models.sources import SourceKind, SourceRecord, SourceStatus
from app.services.crawl4ai_scraper import Crawl4AiScraper
from app.services.docs_mcp import DocsMcpAdapter
from app.services.path_utils import path_to_file_url
from app.services.source_registry import SourceRegistry
from app.services.app_settings import AppSettingsStore


class JobRunner:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.registry = SourceRegistry()
        self.docs_mcp = DocsMcpAdapter()
        self.crawl4ai = Crawl4AiScraper()
        self.app_settings = AppSettingsStore()
        self.jobs_path = self.settings.jobs_dir / "jobs.json"

    def start_index_job(self, source: SourceRecord) -> IndexJob:
        first_command = self._build_first_command(source)
        job = IndexJob(
            source_id=source.id,
            command=first_command,
            log_path=str(self.settings.jobs_dir / f"{source.id}.log"),
        )
        self._upsert(job)

        thread = threading.Thread(target=self._run_index_job, args=(job.id, source.id), daemon=True)
        thread.start()
        return job

    def list_jobs(self) -> list[IndexJob]:
        return list(self._read().values())

    def get_job(self, job_id: str) -> IndexJob | None:
        return self._read().get(job_id)

    def latest_job_for_source(self, source_id: str) -> IndexJob | None:
        jobs = [job for job in self.list_jobs() if job.source_id == source_id]
        if not jobs:
            return None
        return sorted(jobs, key=lambda job: job.created_at, reverse=True)[0]

    def has_active_job_for_source(self, source_id: str) -> bool:
        return any(
            job.source_id == source_id and job.status in {JobStatus.QUEUED, JobStatus.RUNNING}
            for job in self.list_jobs()
        )

    def delete_jobs_for_source(self, source_id: str) -> None:
        jobs = self._read()
        remaining_jobs = {
            job_id: job
            for job_id, job in jobs.items()
            if job.source_id != source_id
        }

        for job in jobs.values():
            if job.source_id == source_id:
                log_path = Path(job.log_path)
                if self._is_under_data_dir(log_path) and log_path.exists():
                    log_path.unlink()

        self.jobs_path.parent.mkdir(parents=True, exist_ok=True)
        serialized = {job_id: job.model_dump(mode="json") for job_id, job in remaining_jobs.items()}
        self.jobs_path.write_text(json.dumps(serialized, indent=2), encoding="utf-8")

    def _is_under_data_dir(self, path: Path) -> bool:
        try:
            resolved_path = path.resolve()
            resolved_data_dir = self.settings.data_dir.resolve()
        except OSError:
            return False
        return resolved_path != resolved_data_dir and resolved_data_dir in resolved_path.parents

    def read_logs(self, job_id: str) -> str:
        job = self.get_job(job_id)
        if job is None:
            return ""
        path = Path(job.log_path)
        if not path.exists():
            return ""
        return path.read_text(encoding="utf-8", errors="replace")

    def _run_index_job(self, job_id: str, source_id: str) -> None:
        job = self.get_job(job_id)
        source = self.registry.get_source(source_id)
        if job is None or source is None:
            return

        log_path = Path(job.log_path)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        log_path.write_text("", encoding="utf-8")

        job.status = JobStatus.RUNNING
        job.progress = 5
        job.started_at = datetime.now(UTC)
        source.status = SourceStatus.INDEXING
        self._upsert(job)
        self.registry.update_source(source)

        try:
            if source.kind == SourceKind.WEB:
                crawl_output_dir = self.crawl4ai.output_pages_dir_for(source)
                crawl_output_dir.mkdir(parents=True, exist_ok=True)
                self._run_command(self.crawl4ai.build_crawl_command(source), self.settings.project_root, log_path)
                source.docs_mcp_url = path_to_file_url(crawl_output_dir)
                source.working_path = str(crawl_output_dir)
                job.progress = 55
                self._upsert(job)
                self.registry.update_source(source)

            docs_url = source.docs_mcp_url
            if docs_url is None:
                raise RuntimeError("Source does not have a docs-mcp URL")

            if source.kind == SourceKind.WEB:
                if source.working_path is None:
                    raise RuntimeError("Web source does not have a generated docs directory")
                docs_command = self.docs_mcp.build_generated_docs_scrape_command(
                    source,
                    Path(source.working_path),
                )
            else:
                docs_command = self.docs_mcp.build_scrape_command(source, docs_url)
            job.command = docs_command
            job.progress = max(job.progress, 60)
            self._upsert(job)
            self._run_command(docs_command, self.docs_mcp.command_cwd(), log_path)

            job.status = JobStatus.SUCCEEDED
            job.progress = 100
            source.status = SourceStatus.INDEXED
        except Exception as error:
            job.status = JobStatus.FAILED
            job.error = str(error)
            source.status = SourceStatus.FAILED
            with log_path.open("a", encoding="utf-8") as log_file:
                log_file.write(f"\n[context-hub] {error}\n")
        finally:
            job.finished_at = datetime.now(UTC)
            self._upsert(job)
            self.registry.update_source(source)

    def _run_command(self, command: list[str], cwd: Path, log_path: Path) -> None:
        with log_path.open("a", encoding="utf-8", errors="replace") as log_file:
            log_file.write(f"\n$ {' '.join(command)}\n")
            process = subprocess.Popen(
                command,
                cwd=cwd,
                env=self.app_settings.docs_mcp_env(),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
            )

            assert process.stdout is not None
            output_queue: Queue[str] = Queue()

            def read_output() -> None:
                assert process.stdout is not None
                for output_line in process.stdout:
                    output_queue.put(output_line)

            threading.Thread(target=read_output, daemon=True).start()
            start_time = time.monotonic()

            while process.poll() is None:
                self._drain_output_queue(output_queue, log_file)
                if time.monotonic() - start_time > self.settings.command_timeout_seconds:
                    self._terminate_process_tree(process.pid)
                    raise TimeoutError(
                        f"Command timed out after {self.settings.command_timeout_seconds} seconds: {' '.join(command)}"
                    )
                time.sleep(0.2)

            self._drain_output_queue(output_queue, log_file)

            exit_code = process.wait()
            if exit_code != 0:
                raise RuntimeError(f"Command exited with code {exit_code}: {' '.join(command)}")

    def _drain_output_queue(self, output_queue: Queue[str], log_file) -> None:
        while True:
            try:
                line = output_queue.get_nowait()
            except Empty:
                return
            log_file.write(line)
            log_file.flush()

    def _terminate_process_tree(self, pid: int) -> None:
        subprocess.run(
            ["taskkill", "/PID", str(pid), "/T", "/F"],
            capture_output=True,
            text=True,
            check=False,
        )

    def _build_first_command(self, source: SourceRecord) -> list[str]:
        if source.kind == SourceKind.WEB:
            return self.crawl4ai.build_crawl_command(source)
        return self.docs_mcp.build_local_scrape_command(source)

    def _read(self) -> dict[str, IndexJob]:
        if not self.jobs_path.exists():
            return {}
        raw_jobs = json.loads(self.jobs_path.read_text(encoding="utf-8"))
        return {job_id: IndexJob.model_validate(raw) for job_id, raw in raw_jobs.items()}

    def _upsert(self, job: IndexJob) -> None:
        jobs = self._read()
        jobs[job.id] = job
        self.jobs_path.parent.mkdir(parents=True, exist_ok=True)
        serialized = {job_id: current.model_dump(mode="json") for job_id, current in jobs.items()}
        self.jobs_path.write_text(json.dumps(serialized, indent=2), encoding="utf-8")
