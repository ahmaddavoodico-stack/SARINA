"""Vercel entry point for SARINA's self-hosted-source voice runtime.

The inference code is imported from SARINA's vendored repository sources.
Small multilingual model weights are cached in the function's writable /tmp
space; they are fetched from their public upstream repositories on first use.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import parse_qs

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

# Vercel maps this single Python function to /api/voice. Explicit rewrites
# forward the nested public endpoints here with an internal __voice_route
# query parameter; direct-prefix routing is also supported for compatibility.
@app.middleware("http")
async def restore_vercel_voice_route(request, call_next):
    scope = request.scope
    path = scope.get("path", "")
    prefix = "/api/voice"

    if path == prefix:
        query = parse_qs(scope.get("query_string", b"").decode("latin-1"))
        rewritten_path = query.get("__voice_route", [None])[0]
        if rewritten_path in {"/healthz", "/v1/transcribe", "/v1/synthesize"}:
            scope["path"] = rewritten_path
            scope["raw_path"] = rewritten_path.encode("utf-8")
            # The routing marker is internal and is not an application query.
            scope["query_string"] = b""
    elif path.startswith(prefix + "/"):
        scope["path"] = path[len(prefix):]
        raw_path = scope.get("raw_path")
        if raw_path:
            scope["raw_path"] = scope["path"].encode("utf-8")

    return await call_next(request)
