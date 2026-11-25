# SARINA Self-hosted Voice Runtime

Status: implementation foundation committed to the development branch; not deployed or connected to a live chat.

## Product scope

The same reusable voice controls are intended for the unified SARINA AI conversation in both farmer and administrator workspaces. The farmer-specialist consultation inbox is a separate human-to-human workflow and must not be repurposed as the AI chat.

## Runtime

- STT: faster-whisper, multilingual `small` model, CPU INT8 by default.
- TTS: Piper, Persian Iran `fa_IR-amir-medium` voice.
- Runtime: a dedicated FastAPI service in `services/voice-runtime`, packaged with Docker.
- Authentication: validate the current SARINA Supabase access token using SARINA's own Auth endpoint.
- Inference: local CPU process only. No OpenAI, Google, Azure, ElevenLabs, or other external AI inference API.
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

Set `VITE_SARINA_VOICE_API_URL` to the HTTPS URL of SARINA's own voice runtime when that service is installed. No provider key or model API key is present in the frontend.

The parent chat must persist the audio in private storage and link it to the authenticated conversation. The component itself does not create a message row or bypass RLS.

## Deployment and release gates

1. Install the service on a SARINA-controlled host and cache model weights.
2. Configure exact CORS origins, Supabase Auth validation, HTTPS reverse proxy and resource limits.
3. Benchmark Persian speech, farm noise, southern accents, CPU latency, peak memory and concurrency.
4. Integrate the reusable control into the single AI chat composer shared by farmer and admin roles.
5. Connect persisted assistant responses to the TTS playback control.
6. Test cross-user isolation, expired tokens, unsupported media, oversize recordings, retries and mobile microphone permissions.

No Supabase migration, RLS change, production deployment, DNS change, server operation, or paid API was performed by this repository change.
