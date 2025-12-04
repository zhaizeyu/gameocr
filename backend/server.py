#!/usr/bin/env python3
"""FastAPI service exposing OCR extraction for game values."""
import logging
from pathlib import Path
from typing import Dict
from uuid import uuid4

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from extract_game_values import extract_values

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data" / "images"
LOG_DIR = BASE_DIR / "logs"
DATA_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(LOG_DIR / "server.log", encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger("gameocr.server")

app = FastAPI(title="Game OCR Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/ocr")
async def ocr_image(file: UploadFile = File(...)) -> JSONResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    original_name = Path(file.filename).name
    suffix = Path(original_name).suffix or ".png"
    saved_name = f"{uuid4().hex}{suffix}"
    saved_path = DATA_DIR / saved_name

    logger.info("OCR request received filename=%s", original_name)

    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Empty file")
        saved_path.write_bytes(content)
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Failed to save upload: {exc}") from exc

    try:
        values = extract_values(saved_path)
        logger.info("OCR success file=%s saved=%s values=%s", original_name, saved_path, values)
    except Exception as exc:  # pragma: no cover
        logger.exception("OCR failed for %s", saved_path)
        raise HTTPException(status_code=500, detail=f"OCR failed: {exc}") from exc

    return JSONResponse(
        {
            "filename": original_name,
            "saved_path": str(saved_path.relative_to(Path(__file__).resolve().parent)),
            "values": values,  # type: Dict[str, str | None]
        }
    )


@app.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
