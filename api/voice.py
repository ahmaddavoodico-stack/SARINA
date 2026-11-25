"""Vercel entry point for SARINA's self-hosted-source voice runtime.

The inference code is imported from SARINA's vendored repository sources.
Small multilingual model weights are cached in the function's writable /tmp
space; they are fetched from their public upstream repositories on first use.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVICE_ROOT = ROOT / "services" / "voice-runtime"

# Vercel Functions have a read-only deployment filesystem and writable /tmp.
# Use the compact multilingual Whisper Tiny model for the initial single-user
# workflow test. The vendored inference engine remains the same.
os.environ.setdefault("WHISPER_MODEL_PATH", "/tmp/sarina-models/whisper/tiny")
os.environ.setdefault("WHISPER_MODEL_REPO", "Systran/faster-whisper-tiny")
os.environ.setdefault("PIPER_FA_MODEL_PATH", "/tmp/sarina-models/piper/fa_IR-amir-medium.onnx")
os.environ.setdefault("PIPER_AR_MODEL_PATH", "/tmp/sarina-models/piper/ar_JO-kareem-medium.onnx")
os.environ.setdefault("WHISPER_CPU_THREADS", "2")

# Import the engine source directly from this SARINA repository.
sys.path.insert(0, str(ROOT / "vendor"))
sys.path.insert(0, str(SERVICE_ROOT))

from app.main import app  # noqa: E402

# Vercel routes requests through /api/voice/* to this single FastAPI function.
# Strip the function prefix so the existing /v1/* routes remain unchanged.
@app.middleware("http")
async def strip_vercel_function_prefix(request, call_next):
    path = request.scope.get("path", "")
    prefix = "/api/voice"
    if path == prefix or path.startswith(prefix + "/"):
        request.scope["path"] = path[len(prefix):] or "/"
        raw_path = request.scope.get("raw_path")
        if raw_path:
            request.scope["raw_path"] = request.scope["path"].encode("utf-8")
    return await call_next(request)
