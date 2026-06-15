import string
from pathlib import Path
from tkinter import TclError, Tk, filedialog

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

router = APIRouter(prefix="/folders", tags=["folders"])


class FolderPickResponse(BaseModel):
    path: str | None


class LocalPathEntry(BaseModel):
    name: str
    path: str
    is_dir: bool


class LocalPathListResponse(BaseModel):
    current_path: str
    parent_path: str | None
    entries: list[LocalPathEntry]


class LocalPathRootsResponse(BaseModel):
    roots: list[LocalPathEntry]


@router.post("/pick", response_model=FolderPickResponse)
def pick_folder() -> FolderPickResponse:
    try:
        root = Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        selected_path = filedialog.askdirectory(title="Select documentation folder")
        root.destroy()
    except TclError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Native folder picker is unavailable",
        ) from error

    return FolderPickResponse(path=selected_path or None)


@router.get("/roots", response_model=LocalPathRootsResponse)
def list_roots() -> LocalPathRootsResponse:
    roots: list[LocalPathEntry] = []
    home = Path.home()
    if home.exists():
        roots.append(LocalPathEntry(name="Home", path=str(home), is_dir=True))

    for drive in string.ascii_uppercase:
        root = Path(f"{drive}:\\")
        if root.exists():
            roots.append(LocalPathEntry(name=f"{drive}:\\", path=str(root), is_dir=True))

    return LocalPathRootsResponse(roots=roots)


@router.get("/browse", response_model=LocalPathListResponse)
def browse_local_path(path: str | None = Query(default=None)) -> LocalPathListResponse:
    current_path = Path(path).expanduser() if path else Path.home()

    try:
        current_path = current_path.resolve()
    except OSError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error

    if not current_path.exists() or not current_path.is_dir():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Folder does not exist")

    try:
        entries = [
            LocalPathEntry(name=entry.name, path=str(entry), is_dir=entry.is_dir())
            for entry in current_path.iterdir()
            if not entry.name.startswith(".")
        ]
    except PermissionError as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Folder cannot be opened") from error

    entries.sort(key=lambda entry: (not entry.is_dir, entry.name.lower()))
    parent = current_path.parent if current_path.parent != current_path else None

    return LocalPathListResponse(
        current_path=str(current_path),
        parent_path=str(parent) if parent else None,
        entries=entries,
    )
