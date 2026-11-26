# SARINA Self-hosted Voice Runtime

This service provides multilingual Persian and Arabic speech-to-text, plus Persian and Arabic text-to-speech, on SARINA-controlled compute. It does not call an external AI inference API.

**The inference source code is vendored inside this SARINA repository** under `vendor/faster_whisper/` and `vendor/piper/`. The container imports the vendored faster-whisper source directly. The GPL-licensed Piper source is executed by a separate local runner process (`vendor/piper_cli.py`), not imported into the FastAPI service. CTranslate2, ONNX Runtime, Piper's native eSpeak bridge and its language data are platform-specific binary/runtime dependencies installed at image build time; they are not inference APIs. Their upstream licenses and pinned source revisions are recorded in [vendor/VOICE_ENGINE_NOTICES.md](../../vendor/VOICE_ENGINE_NOTICES.md).

## Components

- STT: SARINA-vendored faster-whisper source, CTranslate2 CPU INT8 backend, with the multilingual `small` model loaded from a local directory.
- TTS (Persian): `tiny-ava` ONNX with the Parisa female voice and its compact Persian G2P frontend. The model is cached locally and inference runs on CPU. Required attribution: “Powered by tiny-ava (Mehdi Allahyari / OncillaAI)” with a link to https://huggingface.co/mehdi-hf/tiny-ava.
- TTS (Arabic): SARINA-vendored Piper Python inference source, invoked as a separate local process with `ar_JO-kareem-medium` (Jordanian Arabic voice; not a Khuzestani dialect clone).
- Authentication: validates the caller's existing Supabase access token against SARINA's own Supabase Auth endpoint. This is identity validation, not an AI inference provider.
- Audio processing: runs locally in this container. Audio is held in a temporary file during transcription and removed afterward; this service does not persist recordings.

The Parisa Persian female model is CC BY 4.0 and requires the attribution above. Its Persian G2P frontend is MIT-licensed. Review the [tiny-ava model card](https://huggingface.co/mehdi-hf/tiny-ava) and [Arabic Piper model card](https://huggingface.co/rhasspy/piper-voices/blob/main/ar/ar_JO/kareem/medium/MODEL_CARD) before redistribution.

## First-time setup

The code is already in SARINA. Model weights are separate large binary assets and are stored on the SARINA host, not in Git. Download them once before starting the service; inference then uses local files only.

1. Copy `.env.example` to `.env` and set the Supabase URL, publishable/anon key, and exact SARINA web origins.
2. From this directory, create model folders and download the multilingual Whisper Small weights. Install the free Hugging Face CLI locally if it is not already available:

```sh
python -m pip install --user -U huggingface_hub
mkdir -p models/whisper/small models/piper
hf download Systran/faster-whisper-small --local-dir models/whisper/small
```

3. Download the Arabic Piper voice model and its matching configuration. The Persian Parisa model and its small G2P frontend are cached on first use:

```sh
curl -L "https://huggingface.co/rhasspy/piper-voices/resolve/3ec800dafed75d43bbca3a82f2e67acddbcaf9ac/ar/ar_JO/kareem/medium/ar_JO-kareem-medium.onnx?download=true" -o models/piper/ar_JO-kareem-medium.onnx
curl -L "https://huggingface.co/rhasspy/piper-voices/resolve/3ec800dafed75d43bbca3a82f2e67acddbcaf9ac/ar/ar_JO/kareem/medium/ar_JO-kareem-medium.onnx.json?download=true" -o models/piper/ar_JO-kareem-medium.onnx.json
```

4. Build and start the service:

```sh
docker compose -f compose.yml up -d --build
```

5. Check `http://127.0.0.1:8090/healthz` from the server. Put the service behind SARINA's HTTPS reverse proxy; do not expose port 8090 directly to the public internet.

The Docker image copies the vendored engine source into `/app/vendor` and imports it through `PYTHONPATH`. Model weights are mounted read-only at `/models`. If a model directory is missing, the runtime reports a configuration error rather than silently downloading model files during inference.

## API

- `POST /v1/transcribe`: multipart fields `file` and optional `language=auto|fa|ar`, plus a SARINA Supabase access token. Returns transcript, detected language and duration. The multilingual Whisper model auto-detects by default; an explicit hint can help distinguish Persian from Arabic.
- `POST /v1/synthesize`: JSON `{"text":"...","language":"fa"}` or `{"text":"...","language":"ar"}`, plus a SARINA Supabase access token. Returns WAV audio from Parisa (Persian female, tiny-ava) or the Arabic Piper voice.
- `GET /healthz`: basic service health only.

The service enforces audio-size and duration limits, a single inference slot for CPU protection, and Persian/Arabic synthesis using fixed local models. Persian Parisa uses ONNX Runtime; Arabic Piper executes from SARINA's vendored source directory. It does not accept arbitrary model names or user-selected filesystem paths.

## Resource profile

The default configuration targets a modest CPU server: Vendored faster-whisper Small multilingual / INT8, two CPU threads by default, one inference at a time (raise to four on a 4-vCPU host), and the compact Parisa Persian female ONNX model plus one Arabic Piper medium voice. Arabic speech recognition supports Modern Standard Arabic and may understand regional speech with variable accuracy; the Jordanian Piper voice is not a southern-Iraqi/Khuzestani dialect voice. This is a starting point, not a performance guarantee. Benchmark latency, peak RAM, concurrent requests, and Persian/Arabic (including local dialect and mixed-language) accuracy on the actual SARINA host before enabling it for users.

## Conversation scope

The voice runtime serves three roles: farmers, administrators, and assigned verified specialists. Farmer and administrator voice belongs in the unified SARINA AI chat. Farmer–specialist voice notes belong in the existing human consultation thread and must remain separate from the AI assistant history. The specialist workflow uses asynchronous recorded voice notes, not live calling.

The React controls are reusable across these composers. The parent conversation must upload audio to SARINA's private, participant-scoped storage, persist a message descriptor in the existing conversation store, and render authenticated playback. Do not expose public audio URLs or let the voice runtime write directly to consultation tables. The runtime only performs STT/TTS.

The repository's current chat UI does not yet render voice payloads end-to-end. Existing voice-note SQL and storage policies must be verified against the active migration history and current database before relying on them. No database migration, storage policy change, Edge Function deployment, or production server change is included here.

## Existing Vercel host (initial Persian workflow)

SARINA can run the voice API on the existing Vercel project without a separate server. The root `api/voice.py` entrypoint imports the vendored runtime source and exposes it at `/api/voice`. The root `requirements.txt` contains only the Python packages required by that function.

For the first single-user workflow check, Vercel uses the multilingual Whisper Tiny model and the Persian female Parisa voice from tiny-ava. The Parisa ONNX model is downloaded from Hugging Face; compact G2P ONNX files are fetched from a pinned tiny-ava source revision. Assets are cached under the function's writable `/tmp` directory. Inference is local; downloads are model assets, not hosted inference calls. Warm invocations reuse the cache; Vercel may recycle an instance, so a later cold start can download the weights again. This is a practical low-resource starting configuration, not a promise of fixed latency.

The voice UI defaults to the same-origin `/api/voice` route, so no separate `VITE_SARINA_VOICE_API_URL` value or new secret is required. The function validates the user's existing Supabase session using the project's public URL and publishable key; it does not use a service-role key.

This initial path is deliberately limited to Persian and a single inference at a time for spoken replies; Arabic Piper remains available as a separate synthesis path. It is intended to prove one complete interaction on the current host before later moving the same vendored engines to a stronger server. Voice recordings and chat messages in the floating admin companion are still temporary in-memory UI state at this stage; durable voice history is a separate follow-up.

