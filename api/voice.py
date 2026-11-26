"""Vercel entry point for SARINA's self-hosted-source voice runtime.

The inference code is imported from this SARINA repository.
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
# Use the compact multilingual Whisper Tiny model for the initial workflow.
os.environ.setdefault("WHISPER_MODEL_PATH", "/tmp/sarina-models/whisper/tiny")
os.environ.setdefault("WHISPER_MODEL_REPO", "Systran/faster-whisper-tiny")
os.environ.setdefault("PIPER_AR_MODEL_PATH", "/tmp/sarina-models/piper/ar_JO-kareem-medium.onnx")
os.environ.setdefault("SARINA_TINY_AVA_CACHE", "/tmp/sarina-models/tiny-ava")
os.environ.setdefault("WHISPER_CPU_THREADS", "2")

# Import the engine source directly from this SARINA repository.
sys.path.insert(0, str(ROOT / "vendor"))
sys.path.insert(0, str(SERVICE_ROOT))

from app.main import app  # noqa: E402


class RestoreVercelVoiceRoute:
    """Rewrite Vercel's single-function route without wrapping the request body.

    A pure ASGI middleware preserves the original receive/send callables.
    This avoids BaseHTTPMiddleware's request-stream wrapper around multipart
    audio uploads, which can otherwise surface as opaque ASGI application
    exceptions before the transcription endpoint returns a useful response.
    """

    def __init__(self, application):
        self.application = application

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http":
            await self.application(scope, receive, send)
            return

        routed_scope = dict(scope)
        path = routed_scope.get("path", "")
        prefix = "/api/voice"

        if path == prefix:
            query = parse_qs(routed_scope.get("query_string", b"").decode("latin-1"))
            rewritten_path = query.get("__voice_route", [None])[0]
            if rewritten_path in {"/healthz", "/v1/transcribe", "/v1/synthesize"}:
                routed_scope["path"] = rewritten_path
                routed_scope["raw_path"] = rewritten_path.encode("utf-8")
                # The routing marker is internal, not an application query.
                routed_scope["query_string"] = b""
        elif path.startswith(prefix + "/"):
            rewritten_path = path[len(prefix):]
            routed_scope["path"] = rewritten_path
            raw_path = routed_scope.get("raw_path")
            if raw_path:
                routed_scope["raw_path"] = rewritten_path.encode("utf-8")

        await self.application(routed_scope, receive, send)


app.add_middleware(RestoreVercelVoiceRoute)
