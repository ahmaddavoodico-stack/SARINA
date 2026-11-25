from __future__ import annotations

import asyncio
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Any

import httpx
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from starlette.background import BackgroundTask

APP_VERSION = "0.1.0"
MAX_AUDIO_BYTES = int(os.getenv("MAX_AUDIO_BYTES", str(20 * 1024 * 1024)))
MAX_TEXT_CHARS = int(os.getenv("MAX_TEXT_CHARS", "6000"))
MAX_AUDIO_SECONDS = int(os.getenv("MAX_AUDIO_SECONDS", "90"))
WHISPER_MODEL_NAME = os.getenv("WHISPER_MODEL", "small")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
WHISPER_CPU_THREADS = int(os.getenv("WHISPER_CPU_THREADS", "4"))
PIPER_MODEL_PATH = Path(os.getenv("PIPER_MODEL_PATH", "/models/fa_IR-amir-medium.onnx"))
PIPER_EXECUTABLE = os.getenv("PIPER_EXECUTABLE", "piper")
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
CORS_ORIGINS = [item.strip() for item in os.getenv("CORS_ORIGINS", "").split(",") if item.strip()]

app = FastAPI(title="SARINA Self-hosted Voice Runtime", version=APP_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

_model_lock = asyncio.Lock()
_inference_lock = asyncio.Semaphore(1)
_whisper_model: Any | None = None


class SynthesisRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TEXT_CHARS)
    language: str = Field(default="fa", min_length=2, max_length=12)


def _require_configuration() -> None:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=503, detail="Voice authentication is not configured")


async def require_authenticated_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    _require_configuration()
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={"Authorization": authorization, "apikey": SUPABASE_ANON_KEY},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Authentication service temporarily unavailable") from exc

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    user = response.json()
    if not isinstance(user, dict) or not user.get("id"):
        raise HTTPException(status_code=401, detail="Invalid user session")
    return {"id": user["id"]}


def _get_whisper_model() -> Any:
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel

        _whisper_model = WhisperModel(
            WHISPER_MODEL_NAME,
            device=WHISPER_DEVICE,
            compute_type=WHISPER_COMPUTE_TYPE,
            cpu_threads=WHISPER_CPU_THREADS,
        )
    return _whisper_model


def _probe_audio_duration(path: str) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path],
        capture_output=True,
        text=True,
        timeout=10,
        check=False,
    )
    if result.returncode != 0:
        raise ValueError("Audio container could not be decoded")
    try:
        duration = float(result.stdout.strip())
    except (TypeError, ValueError) as exc:
        raise ValueError("Audio duration could not be determined") from exc
    if duration <= 0:
        raise ValueError("Audio duration is invalid")
    return duration


def _transcribe_file(path: str) -> dict[str, Any]:
    model = _get_whisper_model()
    segments, info = model.transcribe(
        path,
        language=None,
        beam_size=3,
        vad_filter=True,
        condition_on_previous_text=False,
    )
    collected = []
    for segment in segments:
        text = (segment.text or "").strip()
        if text:
            collected.append(text)
    transcript = " ".join(collected).strip()
    return {
        "transcript": transcript,
        "language": getattr(info, "language", None),
        "language_probability": getattr(info, "language_probability", None),
        "duration_seconds": getattr(info, "duration", None),
        "segments_count": len(collected),
    }


def _synthesize_file(text: str, output_path: str) -> None:
    if not PIPER_MODEL_PATH.is_file():
        raise RuntimeError("Persian Piper voice model is not installed")
    command = [
        PIPER_EXECUTABLE,
        "--model",
        str(PIPER_MODEL_PATH),
        "--output_file",
        output_path,
    ]
    result = subprocess.run(
        command,
        input=text,
        text=True,
        capture_output=True,
        timeout=90,
        check=False,
    )
    if result.returncode != 0 or not Path(output_path).is_file():
        detail = (result.stderr or result.stdout or "Piper synthesis failed")[-1200:]
        raise RuntimeError(detail)


@app.get("/healthz")
async def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "sarina-voice-runtime",
        "version": APP_VERSION,
        "speech_to_text": "faster-whisper",
        "text_to_speech": "piper",
        "whisper_model_loaded": _whisper_model is not None,
        "piper_model_configured": PIPER_MODEL_PATH.is_file(),
        "execution": "local",
    }


@app.post("/v1/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    user: dict[str, Any] = Depends(require_authenticated_user),
) -> dict[str, Any]:
    del user
    content_type = (file.content_type or "").split(";")[0].lower()
    allowed_types = {
        "audio/webm",
        "audio/ogg",
        "audio/wav",
        "audio/x-wav",
        "audio/mpeg",
        "audio/mp4",
        "audio/aac",
        "application/octet-stream",
    }
    if content_type not in allowed_types:
        raise HTTPException(status_code=415, detail="Unsupported audio format")

    suffix = Path(file.filename or "voice.webm").suffix.lower()
    if suffix not in {".webm", ".ogg", ".wav", ".mp3", ".m4a", ".aac", ".mp4"}:
        suffix = ".audio"

    temp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(prefix="sarina-in-", suffix=suffix, delete=False) as temp:
            temp_path = temp.name
            total = 0
            while chunk := await file.read(1024 * 1024):
                total += len(chunk)
                if total > MAX_AUDIO_BYTES:
                    raise HTTPException(status_code=413, detail="Audio file is too large")
                temp.write(chunk)
        if total == 0:
            raise HTTPException(status_code=400, detail="Audio file is empty")

        try:
            duration = await asyncio.to_thread(_probe_audio_duration, temp_path)
        except (ValueError, subprocess.SubprocessError) as exc:
            raise HTTPException(status_code=400, detail="Audio file could not be decoded") from exc
        if duration > MAX_AUDIO_SECONDS:
            raise HTTPException(status_code=413, detail="Audio duration exceeds the allowed limit")

        async with _inference_lock:
            try:
                result = await asyncio.to_thread(_transcribe_file, temp_path)
            except Exception as exc:
                raise HTTPException(status_code=503, detail="Speech recognition is temporarily unavailable") from exc

        return {"ok": True, **result, "processing": "local"}
    finally:
        await file.close()
        if temp_path:
            Path(temp_path).unlink(missing_ok=True)


@app.post("/v1/synthesize")
async def synthesize(
    payload: SynthesisRequest,
    user: dict[str, Any] = Depends(require_authenticated_user),
) -> FileResponse:
    del user
    if payload.language not in {"fa", "fa-IR", "fa_IR"}:
        raise HTTPException(status_code=422, detail="Only Persian synthesis is enabled in this release")

    output_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(prefix="sarina-out-", suffix=".wav", delete=False) as temp:
            output_path = temp.name
        async with _inference_lock:
            await asyncio.to_thread(_synthesize_file, payload.text.strip(), output_path)
        return FileResponse(
            output_path,
            media_type="audio/wav",
            filename="sarina-response.wav",
            background=BackgroundTask(lambda: Path(output_path).unlink(missing_ok=True)),
        )
    except RuntimeError as exc:
        if output_path:
            Path(output_path).unlink(missing_ok=True)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        if output_path:
            Path(output_path).unlink(missing_ok=True)
        raise HTTPException(status_code=503, detail="Speech synthesis is temporarily unavailable") from exc
