from tkinter import TclError, Tk, filedialog

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

router = APIRouter(prefix="/folders", tags=["folders"])


class FolderPickResponse(BaseModel):
    path: str | None


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
