from tkinter import TclError, Tk, filedialog

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

router = APIRouter(prefix="/folders", tags=["folders"])


class FolderPickResponse(BaseModel):
    path: str | None


class FilePickResponse(BaseModel):
    paths: list[str]


@router.post("/pick", response_model=FolderPickResponse)
def pick_folder() -> FolderPickResponse:
    root = None
    try:
        root = Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        selected_path = filedialog.askdirectory(title="Select documentation folder")
    except TclError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Native folder picker is unavailable",
        ) from error
    finally:
        if root is not None:
            root.destroy()

    return FolderPickResponse(path=selected_path or None)


@router.post("/pick-files", response_model=FilePickResponse)
def pick_files() -> FilePickResponse:
    root = None
    try:
        root = Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        selected_paths = filedialog.askopenfilenames(title="Select documentation files")
    except TclError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Native file picker is unavailable",
        ) from error
    finally:
        if root is not None:
            root.destroy()

    return FilePickResponse(paths=list(selected_paths))
