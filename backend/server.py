#!/usr/bin/env python3
"""FastAPI service exposing OCR extraction for game values."""
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional
from uuid import uuid4

from fastapi import Body, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from extract_game_values import extract_values

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data" / "images"
LOG_DIR = BASE_DIR / "logs"
STATE_FILE = BASE_DIR / "data" / "state.json"
DATA_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)
STATE_FILE.parent.mkdir(parents=True, exist_ok=True)

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


def _normalize_account(account: Optional[str]) -> str:
    if not account:
        return "default"
    return account.replace("/", "_")


def _state_path(account: Optional[str]) -> Path:
    safe = _normalize_account(account)
    if safe == "default":
        return STATE_FILE
    return STATE_FILE.with_name(f"state_{safe}.json")


@app.post("/ocr")
async def ocr_image(
    file: UploadFile = File(...),
    account: Optional[str] = Query(default=None),
    account_form: Optional[str] = Form(default=None),
) -> JSONResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    account_name = _normalize_account(account or account_form)
    original_name = Path(file.filename).name
    suffix = Path(original_name).suffix or ".png"
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    saved_name = f"{account_name}_{ts}{suffix}"
    saved_path = DATA_DIR / saved_name

    logger.info("OCR request received filename=%s account=%s", original_name, account_name)

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


@app.get("/state")
async def get_state(account: Optional[str] = Query(default=None)) -> JSONResponse:
    state_path = _state_path(account)
    if not state_path.exists():
        return JSONResponse({})
    try:
        data = json.loads(state_path.read_text(encoding="utf-8"))
        return JSONResponse(data)
    except Exception as exc:  # pragma: no cover
        logger.exception("Failed to read state file %s", state_path)
        raise HTTPException(status_code=500, detail=f"Failed to read state: {exc}") from exc


@app.post("/state")
async def save_state(payload: Dict = Body(...), account: Optional[str] = Query(default=None)) -> JSONResponse:
    state_path = _state_path(account)
    try:
        state_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        logger.info("State saved to %s", state_path)
        return JSONResponse({"status": "ok"})
    except Exception as exc:  # pragma: no cover
        logger.exception("Failed to write state file %s", state_path)
        raise HTTPException(status_code=500, detail=f"Failed to save state: {exc}") from exc


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
