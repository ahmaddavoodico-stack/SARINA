# SARINA Self-hosted Voice Runtime

This service provides Persian speech-to-text and text-to-speech on SARINA-controlled compute. It does not call an external AI inference API.

## Components

- STT: faster-whisper, CPU INT8 by default, with the multilingual `small` model.
- TTS: Piper with the Persian `fa_IR-amir-medium` voice.
- Authentication: validates the caller's existing Supabase access token against SARINA's own Supabase Auth endpoint. This is identity validation, not an AI inference provider.
- Audio processing: runs locally in this container. Audio is held in a temporary file during transcription and removed afterward; this service does not persist recordings.

The Persian Piper voice is listed in the upstream voice catalog. Its model card identifies Persian (Iran), medium quality, and a CC0 training dataset. Review the current upstream model card before redistribution. See the [voice model card](https://huggingface.co/rhasspy/piper-voices/blob/main/fa/fa_IR/amir/medium/MODEL_CARD) and [Piper voice catalog](https://github.com/rhasspy/piper/blob/master/VOICES.md).

## First-time setup

1. Copy `.env.example` to `.env` and set the Supabase URL, publishable/anon key, and the exact SARINA web origins.
2. Download the Persian Piper model and its matching JSON configuration from the pinned upstream revision into `models/`:
```sh
mkdir -p models
curl -L "https://huggingface.co/rhasspy/piper-voices/resolve/b22aa2aa275d5e8d528994782814cd8bf9d0337f/fa/fa_IR/amir/medium/fa_IR-amir-medium.onnx?download=true" -o models/fa_IR-amir-medium.onnx
curl -L "https://huggingface.co/rhasspy/piper-voices/resolve/b22aa2aa275d5e8d528994782814cd8bf9d0337f/fa/fa_IR/amir/medium/fa_IR-amir-medium.onnx.json?download=true" -o models/fa_IR-amir-medium.onnx.json
```
3. Build and start the service:

```sh
docker compose -f compose.yml up -d --build
```

4. Check `http://127.0.0.1:8090/healthz` from the server. Put the service behind SARINA's HTTPS reverse proxy; do not expose port 8090 directly to the public internet.
5. The Whisper model is downloaded into the persistent model cache on first use. To pre-cache it before enabling users, run:
```sh
docker compose -f compose.yml run --rm sarina-voice-runtime python -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')"
```
After model weights are cached, inference is local. If the server must be completely offline from first boot, pre-populate the cache before disconnecting it.

## API

- `POST /v1/transcribe`: multipart field `file`, plus a SARINA Supabase access token. Returns transcript, detected language and duration.
- `POST /v1/synthesize`: JSON `{"text":"...","language":"fa"}`, plus a SARINA Supabase access token. Returns WAV audio.
- `GET /healthz`: basic service health only.

The service enforces audio-size and duration limits, a single inference slot for CPU protection, and Persian-only synthesis in this first release. It does not accept arbitrary model names or user-selected filesystem paths.

## Resource profile

The default configuration targets a modest CPU server: Whisper small / INT8, four CPU threads, one inference at a time, and a Piper medium voice. This is a starting point, not a performance guarantee. Benchmark latency, peak RAM, concurrent requests, and Persian accuracy on the actual SARINA host before enabling it for users.

## Conversation scope

The voice runtime serves three roles: farmers, administrators, and assigned verified specialists. Farmer and administrator voice belongs in the unified SARINA AI chat. Farmer–specialist voice notes belong in the existing human consultation thread and must remain separate from the AI assistant history. The specialist workflow uses asynchronous recorded voice notes, not live calling.

The React controls are reusable across these composers. The parent conversation must upload audio to SARINA's private, participant-scoped storage, persist a message descriptor in the existing conversation store, and render authenticated playback. Do not expose public audio URLs or let the voice runtime write directly to consultation tables. The runtime only performs STT/TTS.

The repository's current chat UI does not yet render voice payloads end-to-end. Existing voice-note SQL and storage policies must be verified against the active migration history and current database before relying on them. No database migration, storage policy change, Edge Function deployment, or production server change is included here.
