from __future__ import annotations

import asyncio
import os
import math
import logging
import subprocess
import sys
import tempfile
import wave
from pathlib import Path
from typing import Any

import httpx
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from starlette.background import BackgroundTask

APP_VERSION = "0.2.1"
logger = logging.getLogger("sarina.voice")
MAX_AUDIO_BYTES = int(os.getenv("MAX_AUDIO_BYTES", str(20 * 1024 * 1024)))
MAX_TEXT_CHARS = int(os.getenv("MAX_TEXT_CHARS", "6000"))
MAX_AUDIO_SECONDS = int(os.getenv("MAX_AUDIO_SECONDS", "90"))
WHISPER_MODEL_PATH = Path(os.getenv("WHISPER_MODEL_PATH", "/models/whisper/small"))
WHISPER_MODEL_REPO = os.getenv("WHISPER_MODEL_REPO", "Systran/faster-whisper-small")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
WHISPER_CPU_THREADS = int(os.getenv("WHISPER_CPU_THREADS", "4"))
TINY_AVA_CACHE = Path(os.getenv("SARINA_TINY_AVA_CACHE", "/tmp/sarina-models/tiny-ava"))
TINY_AVA_REPO = "mehdi-hf/tiny-ava"
TINY_AVA_G2P_REVISION = "eb4dd87438aef3235c6efaed1faba714f0d75ae5"
PIPER_AR_MODEL_PATH = Path(os.getenv("PIPER_AR_MODEL_PATH", "/models/piper/ar_JO-kareem-medium.onnx"))
def _resolve_piper_cli_path() -> Path:
    configured = os.getenv("PIPER_CLI_PATH")
    if configured:
        return Path(configured)
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "vendor" / "piper_cli.py"
        if candidate.is_file():
            return candidate
    return Path("/app/vendor/piper_cli.py")


PIPER_CLI_PATH = _resolve_piper_cli_path()
SUPABASE_URL = os.getenv("SUPABASE_URL", os.getenv("VITE_SUPABASE_URL", "")).rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", os.getenv("VITE_SUPABASE_PUBLISHABLE_KEY", ""))
CORS_ORIGINS = [item.strip() for item in os.getenv("CORS_ORIGINS", "").split(",") if item.strip()]
TTS_ALLOWED_USER_IDS = frozenset(
    item.strip() for item in os.getenv("SARINA_TTS_ALLOWED_USER_IDS", "").split(",") if item.strip()
)

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
_tiny_ava_sessions: tuple[Any, Any, Any, dict[str, Any]] | None = None


class SynthesisRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TEXT_CHARS)
    language: str = Field(default="fa", min_length=2, max_length=12)


def _require_configuration() -> None:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=503, detail="Voice authentication is not configured")


def _is_tts_allowed(user: dict[str, Any]) -> bool:
    """Fail closed unless the authenticated user is explicitly allowlisted."""
    return bool(TTS_ALLOWED_USER_IDS) and user.get("id") in TTS_ALLOWED_USER_IDS


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


def _configure_huggingface_cache() -> Path:
    """Keep all Hugging Face/Xet cache and log writes on Vercel's writable /tmp."""
    cache_root = Path("/tmp/sarina-hf")
    cache_root.mkdir(parents=True, exist_ok=True)
    (cache_root / "hub").mkdir(exist_ok=True)
    (cache_root / "xet").mkdir(exist_ok=True)
    (cache_root / "home").mkdir(exist_ok=True)

    os.environ.setdefault("XDG_CACHE_HOME", str(cache_root / "home"))
    os.environ.setdefault("HF_HOME", str(cache_root / "home" / "huggingface"))
    os.environ.setdefault("HF_HUB_CACHE", str(cache_root / "hub"))
    os.environ.setdefault("HF_XET_CACHE", str(cache_root / "xet"))
    # Xet's default log location can resolve to the read-only deployment home.
    # The standard Hub HTTP downloader is reliable and avoids that write path.
    os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
    return cache_root


def _ensure_whisper_model() -> None:
    global WHISPER_MODEL_PATH
    required_files = ("config.json", "model.bin", "tokenizer.json", "vocabulary.txt")
    if WHISPER_MODEL_PATH.is_dir() and all((WHISPER_MODEL_PATH / name).is_file() for name in required_files):
        return
    if os.getenv("VERCEL") != "1":
        missing = [name for name in required_files if not (WHISPER_MODEL_PATH / name).is_file()]
        raise RuntimeError(
            f"Local Whisper model is incomplete at {WHISPER_MODEL_PATH}; missing: {', '.join(missing)}"
        )

    cache_root = _configure_huggingface_cache()
    from huggingface_hub import snapshot_download

    try:
        downloaded_path = Path(
            snapshot_download(
                repo_id=WHISPER_MODEL_REPO,
                allow_patterns=["config.json", "model.bin", "tokenizer.json", "vocabulary.txt"],
                cache_dir=str(cache_root / "hub"),
                max_workers=4,
            )
        )
        missing = [name for name in required_files if not (downloaded_path / name).is_file()]
        if missing:
            raise RuntimeError(
                f"Whisper model download is incomplete at {downloaded_path}; missing: {', '.join(missing)}"
            )
        WHISPER_MODEL_PATH = downloaded_path
    except Exception:
        logger.exception(
            "voice_whisper_model_download_failed repo_id=%s cache_dir=%s",
            WHISPER_MODEL_REPO,
            cache_root / "hub",
        )
        raise


def _ensure_piper_model(model_path: Path) -> Path:
    if model_path.is_file():
        return model_path
    if os.getenv("VERCEL") != "1":
        raise RuntimeError("Piper voice model is not installed: " + model_path.name)
    cache_root = _configure_huggingface_cache()
    from huggingface_hub import hf_hub_download

    if model_path.name == "fa_IR-amir-medium.onnx":
        voice_repo = "fa/fa_IR/amir/medium"
        revision = "b22aa2aa275d5e8d528994782814cd8bf9d0337f"
    elif model_path.name == "ar_JO-kareem-medium.onnx":
        voice_repo = "ar/ar_JO/kareem/medium"
        revision = "3ec800dafed75d43bbca3a82f2e67acddbcaf9ac"
    else:
        raise RuntimeError("Unsupported Piper voice model")
    model = Path(hf_hub_download(
        repo_id="rhasspy/piper-voices",
        filename=f"{voice_repo}/{model_path.name}",
        revision=revision,
        cache_dir=str(cache_root / "hub"),
    ))
    hf_hub_download(
        repo_id="rhasspy/piper-voices",
        filename=f"{voice_repo}/{model_path.name}.json",
        revision=revision,
        cache_dir=str(cache_root / "hub"),
    )
    return model


def _get_whisper_model() -> Any:
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel

        _ensure_whisper_model()
        _whisper_model = WhisperModel(
            str(WHISPER_MODEL_PATH),
            device=WHISPER_DEVICE,
            compute_type=WHISPER_COMPUTE_TYPE,
            cpu_threads=WHISPER_CPU_THREADS,
        )
    return _whisper_model


def _decode_audio_to_wav(source_path: str, wav_path: str) -> float:
    """Decode browser-recorded audio and normalize it to Whisper-friendly PCM WAV.

    MediaRecorder output varies across Android/browser versions (WebM/Opus,
    Ogg/Opus, MP4/AAC). Whisper should receive a consistent mono 16 kHz stream.
    """
    import av

    target_rate = 16_000
    sample_count = 0
    try:
        with av.open(source_path, mode="r") as container:
            audio_streams = [stream for stream in container.streams if stream.type == "audio"]
            if not audio_streams:
                raise ValueError("No audio stream found")
            stream = audio_streams[0]

            estimated_duration = None
            if container.duration is not None:
                estimated_duration = float(container.duration / av.time_base)
            elif stream.duration is not None and stream.time_base is not None:
                estimated_duration = float(stream.duration * stream.time_base)
            if estimated_duration is not None and estimated_duration > MAX_AUDIO_SECONDS:
                raise ValueError("Audio duration exceeds the allowed limit")

            resampler = av.AudioResampler(format="s16", layout="mono", rate=target_rate)
            with wave.open(wav_path, "wb") as output:
                output.setnchannels(1)
                output.setsampwidth(2)
                output.setframerate(target_rate)

                def write_frames(frames: list[Any]) -> None:
                    nonlocal sample_count
                    for frame in frames:
                        samples = int(frame.samples)
                        sample_count += samples
                        if sample_count > MAX_AUDIO_SECONDS * target_rate:
                            raise ValueError("Audio duration exceeds the allowed limit")
                        output.writeframesraw(bytes(frame.planes[0]))

                for decoded_frame in container.decode(stream):
                    write_frames(resampler.resample(decoded_frame))
                write_frames(resampler.resample(None))
    except Exception as exc:
        if isinstance(exc, ValueError) and str(exc) == "Audio duration exceeds the allowed limit":
            raise
        logger.warning(
            "voice_audio_decode_failed error_type=%s error=%s",
            type(exc).__name__,
            str(exc),
        )
        raise ValueError("Audio container could not be decoded") from exc

    duration = sample_count / target_rate
    if duration <= 0 or not math.isfinite(duration):
        raise ValueError("Audio duration is invalid")
    return duration

def _transcribe_file(path: str, language_hint: str | None = None) -> dict[str, Any]:
    model = _get_whisper_model()
    segments, info = model.transcribe(
        path,
        language=language_hint,
        multilingual=True,
        beam_size=3,
        # Avoid runtime downloads of optional VAD assets; audio length is
        # bounded before inference and the vendored engine runs fully locally.
        vad_filter=False,
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


def _download_tiny_ava_file(url: str, destination: Path) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.is_file() and destination.stat().st_size > 1024:
        return destination
    temporary = destination.with_suffix(destination.suffix + ".part")
    try:
        with httpx.stream("GET", url, timeout=45.0, follow_redirects=True) as response:
            response.raise_for_status()
            with temporary.open("wb") as output:
                for chunk in response.iter_bytes(1024 * 1024):
                    if chunk:
                        output.write(chunk)
        if not temporary.is_file() or temporary.stat().st_size <= 1024:
            raise RuntimeError("Downloaded Persian female voice asset is incomplete")
        temporary.replace(destination)
        return destination
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def _ensure_tiny_ava_assets() -> tuple[Path, Path, Path, Path]:
    """Fetch the offline Parisa female voice and its small Persian G2P frontend."""
    _configure_huggingface_cache()
    from huggingface_hub import hf_hub_download

    model_dir = TINY_AVA_CACHE / "parisa"
    model_dir.mkdir(parents=True, exist_ok=True)
    model_path = Path(hf_hub_download(
        repo_id=TINY_AVA_REPO,
        filename="onnx/tiny-ava-parisa.onnx",
        revision="d25914e",
        cache_dir="/tmp/sarina-hf/hub",
    ))
    meta_path = Path(hf_hub_download(
        repo_id=TINY_AVA_REPO,
        filename="onnx/tiny-ava-parisa.json",
        revision="main",
        cache_dir="/tmp/sarina-hf/hub",
    ))
    g2p_root = "https://raw.githubusercontent.com/mallahyari/tiny-ava/" + TINY_AVA_G2P_REVISION + "/demo/assets/g2p/"
    encoder_path = _download_tiny_ava_file(g2p_root + "g2p_encoder.onnx", model_dir / "g2p_encoder.onnx")
    decoder_path = _download_tiny_ava_file(g2p_root + "g2p_decoder.onnx", model_dir / "g2p_decoder.onnx")
    return model_path, meta_path, encoder_path, decoder_path


def _tiny_ava_phonemes(repr1: str, meta: dict[str, Any]) -> tuple[list[int], list[int]]:
    sym2id = {symbol: index for index, symbol in enumerate(meta["symbols"])}
    phone_set = set(meta["symbols"][17:])
    vowels = {"a", "e", "o", "i", "u", "ɑ"}
    r1_to_ipa = {
        "a": "a", "A": "ɑ", "e": "e", "o": "o", "i": "i", "u": "u",
        "p": "p", "b": "b", "t": "t", "d": "d", "k": "k", "g": "ɡ", "q": "q", "?": "ʔ",
        "f": "f", "v": "v", "s": "s", "z": "z", "S": "ʃ", "Z": "ʒ", "x": "x", "h": "h",
        "C": "tʃ", "j": "dʒ", "m": "m", "n": "n", "l": "l", "r": "r", "y": "j",
    }
    symbols, stress = ["<bos>"], [0]
    for word in repr1.split():
        if symbols[-1] in phone_set:
            symbols.append("<sp>")
            stress.append(0)
        if word.endswith("-ye"):
            stem, ezafe = word[:-3], "ye"
        elif word.endswith("-e"):
            stem, ezafe = word[:-2], "e"
        else:
            stem, ezafe = word, ""
        stem = stem.replace("-", "")
        if len(stem) >= 2 and stem[0] == "?" and stem[1] in "aAeoiu":
            stem = stem[1:]
        phones = [[r1_to_ipa[ch], 0] for ch in stem if ch in r1_to_ipa]
        for index in range(len(phones) - 1, -1, -1):
            if phones[index][0] in vowels:
                phones[index][1] = 1
                break
        for char in ezafe:
            if char in r1_to_ipa:
                phones.append([r1_to_ipa[char], 2 if r1_to_ipa[char] in vowels else 0])
        for phone, level in phones:
            symbols.append(phone)
            stress.append(level)
    symbols.extend([".", "<eos>"])
    stress.extend([0, 0])
    try:
        return [sym2id[symbol] for symbol in symbols], stress
    except KeyError as exc:
        raise RuntimeError("Persian female voice received an unsupported phoneme") from exc


def _get_tiny_ava_sessions() -> tuple[Any, Any, Any, dict[str, Any]]:
    global _tiny_ava_sessions
    if _tiny_ava_sessions is None:
        import json
        import onnxruntime as ort

        model_path, meta_path, encoder_path, decoder_path = _ensure_tiny_ava_assets()
        with meta_path.open("r", encoding="utf-8") as source:
            meta = json.load(source)
        options = ort.SessionOptions()
        options.intra_op_num_threads = max(1, min(4, WHISPER_CPU_THREADS))
        options.inter_op_num_threads = 1
        _tiny_ava_sessions = (
            ort.InferenceSession(str(encoder_path), sess_options=options, providers=["CPUExecutionProvider"]),
            ort.InferenceSession(str(decoder_path), sess_options=options, providers=["CPUExecutionProvider"]),
            ort.InferenceSession(str(model_path), sess_options=options, providers=["CPUExecutionProvider"]),
            meta,
        )
    return _tiny_ava_sessions


def _synthesize_persian_female(text: str, output_path: str) -> None:
    import numpy as np
    import wave

    encoder, decoder, tts, meta = _get_tiny_ava_sessions()
    input_ids = np.array([[byte + 3 for byte in text.encode("utf-8")] + [1]], dtype=np.int64)
    attention = np.ones_like(input_ids, dtype=np.int64)
    (encoded,) = encoder.run(None, {"input_ids": input_ids, "attention_mask": attention})
    output_ids = [0]
    for _ in range(256):
        (logits,) = decoder.run(None, {
            "decoder_input_ids": np.array([output_ids], dtype=np.int64),
            "encoder_hidden_states": encoded,
            "encoder_attention_mask": attention,
        })
        next_id = int(logits[0, -1].argmax())
        if next_id == 1:
            break
        output_ids.append(next_id)
    repr1 = bytes(index - 3 for index in output_ids[1:] if 3 <= index <= 258).decode("utf-8", errors="ignore").strip()
    if not repr1:
        raise RuntimeError("Persian female voice could not phonemize the response")
    tokens, stress = _tiny_ava_phonemes(repr1, meta)
    audio, _ = tts.run(None, {
        "tokens": np.array([tokens], dtype=np.int64),
        "stress": np.array([stress], dtype=np.int64),
        "voice": np.array([0], dtype=np.int64),
        "speed": np.array([1.0], dtype=np.float32),
        "pitch_shift": np.array([0.0], dtype=np.float32),
        "pitch_range": np.array([1.05], dtype=np.float32),
    })
    samples = np.asarray(audio[0], dtype=np.float32).reshape(-1)
    peak = float(np.max(np.abs(samples))) if samples.size else 0.0
    if not np.isfinite(peak) or peak < 1e-7:
        raise RuntimeError("Persian female voice generated empty audio")
    if peak > 0.99:
        samples *= 0.99 / peak
    pcm = np.clip(samples * 32767.0, -32768, 32767).astype("<i2")
    with wave.open(output_path, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(24000)
        wav_file.writeframes(pcm.tobytes())


def _synthesize_file(text: str, output_path: str, model_path: Path) -> None:
    if model_path.name == PIPER_AR_MODEL_PATH.name:
        model_path = _ensure_piper_model(model_path)
        if not PIPER_CLI_PATH.is_file():
            raise RuntimeError("Vendored Piper runner is missing")
        command = [
            sys.executable,
            str(PIPER_CLI_PATH),
            "--model",
            str(model_path),
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
        return
    _synthesize_persian_female(text, output_path)


@app.get("/healthz")
async def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "sarina-voice-runtime",
        "version": APP_VERSION,
        "speech_to_text": "faster-whisper",
        "text_to_speech": "tiny-ava (Persian female Parisa) + Piper (Arabic)",
        "whisper_model_loaded": _whisper_model is not None,
        "whisper_model_path_configured": WHISPER_MODEL_PATH.is_dir(),
        "whisper_model_source": "local-vendored-code-and-local-weights",
        "piper_engine_source": "SARINA-vendored-Piper-subprocess",
        "persian_female_voice": "Parisa" if _tiny_ava_sessions is not None else "Parisa (lazy-loaded)",
        "arabic_piper_model_configured": PIPER_AR_MODEL_PATH.is_file(),
        "whisper_languages": ["fa", "ar", "auto"],
        "execution": "local",
    }


@app.post("/v1/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: str = Form(default="auto"),
    user: dict[str, Any] = Depends(require_authenticated_user),
) -> dict[str, Any]:
    del user
    language_hint = language.strip().lower()
    if language_hint not in {"auto", "fa", "ar"}:
        raise HTTPException(status_code=422, detail="Language must be auto, fa, or ar")
    if language_hint == "auto":
        language_hint = None
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

        normalized_path: str | None = None
        try:
            with tempfile.NamedTemporaryFile(prefix="sarina-normalized-", suffix=".wav", delete=False) as normalized:
                normalized_path = normalized.name
            duration = await asyncio.to_thread(_decode_audio_to_wav, temp_path, normalized_path)
        except ValueError as exc:
            if normalized_path:
                Path(normalized_path).unlink(missing_ok=True)
            if "duration exceeds" in str(exc):
                raise HTTPException(status_code=413, detail="Audio duration exceeds the allowed limit") from exc
            raise HTTPException(status_code=400, detail="Audio file could not be decoded; please try recording again") from exc
        except Exception as exc:
            if normalized_path:
                Path(normalized_path).unlink(missing_ok=True)
            logger.exception("voice_audio_normalization_failed")
            raise HTTPException(status_code=503, detail="Audio conversion is temporarily unavailable") from exc

        try:
            await asyncio.wait_for(_inference_lock.acquire(), timeout=3)
        except TimeoutError as exc:
            Path(normalized_path).unlink(missing_ok=True)
            raise HTTPException(status_code=429, detail="Voice service is busy; retry shortly") from exc
        try:
            try:
                result = await asyncio.to_thread(_transcribe_file, normalized_path, language_hint)
            except Exception as exc:
                logger.exception("voice_transcription_failed")
                raise HTTPException(status_code=503, detail="Speech recognition is temporarily unavailable") from exc
        finally:
            _inference_lock.release()
            Path(normalized_path).unlink(missing_ok=True)

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
    if not _is_tts_allowed(user):
        raise HTTPException(status_code=403, detail="Spoken replies are not enabled for this account")
    language = payload.language.strip().lower().replace("_", "-")
    if language in {"fa", "fa-ir"}:
        voice_model = Path("tiny-ava-parisa")
    elif language in {"ar", "ar-jo"}:
        voice_model = PIPER_AR_MODEL_PATH
    else:
        raise HTTPException(status_code=422, detail="Supported synthesis languages are fa and ar")

    output_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(prefix="sarina-out-", suffix=".wav", delete=False) as temp:
            output_path = temp.name
        try:
            await asyncio.wait_for(_inference_lock.acquire(), timeout=3)
        except TimeoutError as exc:
            raise HTTPException(status_code=429, detail="Voice service is busy; retry shortly") from exc
        try:
            await asyncio.to_thread(_synthesize_file, payload.text.strip(), output_path, voice_model)
        finally:
            _inference_lock.release()
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
