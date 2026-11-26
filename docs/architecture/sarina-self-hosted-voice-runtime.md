# SARINA Self-hosted Voice Runtime

Status: Persian female Parisa TTS is integrated into the existing restricted spoken-reply path; production release and end-to-end audio verification are pending.

## Product scope

Voice support covers three roles and two distinct conversation types:\n- Farmer and administrator use voice in their unified SARINA AI conversation.\n- Farmers and assigned, verified specialists may exchange asynchronous voice notes inside their existing human consultation thread.\n- The specialist conversation remains separate from “Talk to SARINA”; do not merge human and AI histories or route specialist audio through the AI chat.\n\nVoice notes are asynchronous recordings in this release, not live calls or always-on microphone sessions.

## Runtime

- STT: faster-whisper, multilingual `small` model, CPU INT8 by default.
- TTS (Persian): tiny-ava ONNX, Parisa female voice, with the compact Persian G2P ONNX frontend; local CPU inference. Model license CC BY 4.0; attribution is required.
- TTS (Arabic): Piper `ar_JO-kareem-medium` voice.
- Runtime: a dedicated FastAPI service in `services/voice-runtime`, packaged with Docker.
- Authentication: validate the current SARINA Supabase access token using SARINA's own Auth endpoint.
- Inference: local CPU process only. No OpenAI, Google, Azure, ElevenLabs, or other external AI inference API. Model assets are downloaded and cached; inference itself remains local.
- Temporary audio: the runtime deletes temporary input/output files after processing. Durable conversation media storage remains the responsibility of the authorized chat service.

## API contract

- `GET /healthz`
- `POST /v1/transcribe` with multipart audio field `file`
- `POST /v1/synthesize` with JSON `{ "text": "...", "language": "fa" }`

The first version limits input size, duration, text length, synthesis language, and concurrent inference. The runtime must sit behind HTTPS and must not expose its container port directly to the public internet.

## Frontend contract

`src/components/VoiceMessageControls.tsx` is a reusable composer accessory:
- records a short audio note through the browser microphone;
- forwards the raw audio blob to the parent chat for authorized storage/message linkage;
- requests a transcript from the self-hosted STT service and returns it to the parent;
- requests local TTS playback for an assistant message.

Set `VITE_SARINA_VOICE_API_URL` to the HTTPS URL of SARINA's own voice runtime when that service is installed. No provider key or model API key is present in the frontend. Required Persian voice attribution: “Powered by tiny-ava (Mehdi Allahyari / OncillaAI)” with a link to https://huggingface.co/mehdi-hf/tiny-ava.

The parent chat must persist the audio in private storage and link it to the authenticated conversation. The component itself does not create a message row or bypass RLS.

## Deployment and release gates

1. Install the service on a SARINA-controlled host and cache model weights.
2. Configure exact CORS origins, Supabase Auth validation, HTTPS reverse proxy and resource limits.
3. Benchmark Persian speech, farm noise, southern accents, CPU latency, peak memory and concurrency.
4. Integrate the reusable control into the single AI chat composer shared by farmer and admin roles.\n4a. Integrate recording, private upload, message descriptors, and authenticated playback into the existing farmer–specialist consultation thread for the farmer and assigned verified specialist.
5. Connect persisted assistant responses to the TTS playback control.
6. Test farmer/specialist participant authorization, reassignment and revoked-specialist access, plus cross-user isolation, expired tokens, unsupported media, oversize recordings, retries and mobile microphone permissions.

No Supabase migration, RLS change, production deployment, DNS change, server operation, or paid API was performed by this repository change.
