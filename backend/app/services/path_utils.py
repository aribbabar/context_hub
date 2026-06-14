from pathlib import Path


def normalize_local_path(path: Path) -> Path:
    return path.expanduser().resolve()


def path_to_file_url(path: Path) -> str:
    return normalize_local_path(path).as_uri()


def parse_pattern_lines(value: str | None) -> list[str]:
    if not value:
        return []

    return [line.strip() for line in value.splitlines() if line.strip()]
