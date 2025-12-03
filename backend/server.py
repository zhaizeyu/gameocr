#!/usr/bin/env python3
"""FastAPI service exposing OCR extraction for game values."""
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Dict

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse

from extract_game_values import extract_values

app = FastAPI(title="Game OCR Service", version="1.0.0")


@app.post("/ocr")
async def ocr_image(file: UploadFile = File(...)) -> JSONResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    suffix = Path(file.filename).suffix or ".png"
    try:
        with NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            if not content:
                raise HTTPException(status_code=400, detail="Empty file")
            tmp.write(content)
            tmp_path = Path(tmp.name)
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Failed to save upload: {exc}") from exc

    try:
        values = extract_values(tmp_path)
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"OCR failed: {exc}") from exc
    finally:
        try:
            tmp_path.unlink()
        except OSError:
            pass

    return JSONResponse(
        {"filename": file.filename, "values": values}  # type: Dict[str, str | None]
    )


@app.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
