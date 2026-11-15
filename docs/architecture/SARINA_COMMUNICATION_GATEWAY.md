# SARINA Communication Gateway
## Architecture decision record and phased implementation plan

Status: Proposed architecture / implementation contract  
Scope: Identity verification delivery, user-to-user communication, AI voice sessions, and authorized organization contact.

## 1. Product decision

SARINA owns identities, permissions, conversations, and audit metadata. External messaging and voice providers are replaceable transport adapters only. No provider (WhatsApp, Telegram, Iranian messaging apps, SMS vendor, or AI vendor) becomes the owner of a SARINA account or conversation.

The gateway serves three communication relationships:
1. Farmer ↔ specialist
2. User ↔ SARINA AI / specialist AI agent
3. User ↔ authorized organization representative

Supported communication modes are distinct capabilities:
- In-app text messaging
- Voice notes (record/upload/playback)
- Live audio sessions
- Optional provider hand-off/deep link where supported

A provider offering OTP delivery does not automatically qualify as a live-audio provider. Provider capabilities must be declared and verified separately.

## 2. High-level architecture

Client (PWA / mobile web)
  -> SARINA Communication API
     -> Policy & Consent Layer
     -> Identity / Participant Resolver
     -> Channel & Capability Router
        -> Verification adapters (WhatsApp Business provider, Telegram bot, regional messaging adapters, SMS/email fallback)
        -> Messaging adapters (in-app first; optional external delivery)
        -> Live audio adapters (WebRTC infrastructure / supported provider SDKs)
        -> AI session adapter (provider-neutral AI orchestration)
     -> Conversation & Session Service
     -> Notification Service
     -> Audit / Observability

The core API uses SARINA-owned participant IDs and conversation IDs. Provider IDs are stored only as adapter mappings and must never be used as authorization principals.

## 3. Country and channel selection

- Normalize a supplied phone number to E.164 and infer the phone-number country from its calling code.
- Do not treat a calling code as proof of the user's current physical location.
- If local availability materially affects routing, ask the user to choose/confirm their country or use a consent-based, coarse region signal. Do not silently collect precise location.
- Maintain a server-side provider registry with country coverage, capabilities, status, cost class, language support, and operational constraints.
- Recommend channels based on verified provider coverage and user preference; the user can switch channels.
- Never promise delivery or availability from a provider until credentials, templates/bot rules, and a live test have passed.
- Apply rate limits, resend cooldowns, attempt limits, expiry, one-time use, and abuse monitoring to all verification channels.

## 4. Verification flow

1. User enters phone number.
2. SARINA normalizes it and infers the calling-code country.
3. Gateway returns only currently enabled, eligible verification channels for that country.
4. User selects a channel (or accepts the recommended default).
5. Gateway creates a short-lived verification challenge and dispatches through the selected adapter.
6. User submits the code; the server validates it and consumes the challenge once.
7. Supabase Auth remains the identity/session authority. The gateway must integrate with a supported Auth flow or a carefully reviewed custom-auth bridge; it must not create a parallel, weak identity system.

Important: regional apps such as Bale, Eitaa, Rubika, WhatsApp, and Telegram are candidates, not assumed integrations. Each requires a documented official API/provider route and successful end-to-end test before being enabled. Where a platform cannot send OTP through an approved interface, it must not appear as a supported channel.

## 5. Communication model

### A. Farmer ↔ specialist
- In-app conversation and voice notes are the baseline.
- Live audio uses an in-app WebRTC session where available.
- Scheduling, availability, and call requests are first-class records.
- Specialist access to farm records is explicit, scoped, revocable, and logged.

### B. User ↔ AI
- Voice input, transcription, AI orchestration, and spoken response are separate services.
- AI provider selection follows SARINA's provider-neutral orchestration and SIACP rules.
- AI sessions must identify the AI/agent clearly; do not impersonate a human specialist.
- Store session metadata and user-approved summaries; raw audio retention is opt-in and policy-controlled.

### C. User ↔ organization
- Organizations are provisioned only by SARINA central administration, consistent with the organization onboarding policy.
- Each organization representative has an individual account and role; shared organization credentials are prohibited.
- Calls and messages are allowed only within the organization's assigned scope and permissions.
- Formal requests, case IDs, outcomes, and relevant communication metadata are auditable.

## 6. Live audio design

Preferred provider-neutral baseline:
- WebRTC for browser-to-browser / browser-to-service live audio.
- A managed SFU or equivalent media relay may be selected later based on cost, geography, reliability, and compliance.
- Signaling, authorization, room membership, and session lifecycle remain SARINA-controlled.
- AI audio uses a separate adapter and may use streaming speech-to-text / text-to-speech or realtime audio APIs behind the AI gateway.
- External messenger voice calls are optional hand-off experiences only; they are not assumed to be controllable through the messaging bot API.

## 7. Security, privacy, and governance

- Enforce authorization server-side for every conversation, participant, attachment, and call room.
- Use least-privilege roles and row-level security for exposed data.
- Do not use user-editable metadata as an authorization source.
- Keep provider secrets server-side; never expose service-role keys or provider tokens in the client.
- Encrypt transport; define retention and deletion rules for messages, recordings, and transcripts.
- Obtain explicit consent before recording, transcription, or sharing farm records.
- Provide block/report controls, abuse throttling, and account-level restrictions.
- Organization access follows central-admin provisioning and assigned jurisdiction/scope.
- Maintain audit events for access grants, revocations, call initiation/end, verification attempts, and formal organization interactions. Avoid logging OTP values or raw secrets.

## 8. Provider registry contract

Each adapter should declare:
- provider_key
- supported_countries / regions
- capabilities: otp, text, voice_note, live_audio, ai_audio
- languages
- delivery_mode and operational prerequisites
- enabled / disabled state
- health status and last_verified_at
- cost_class and fallback_priority

Routing must use this registry, not hard-coded country-to-app conditionals.

## 9. Suggested logical data model (not yet migrated)

- communication_providers: provider registry and capability metadata
- user_channel_endpoints: verified user endpoints and provider identity mappings
- verification_challenges: hashed challenge state, expiry, attempts, consumption metadata
- conversations: conversation type, context, status, owner
- conversation_participants: participant role, permissions, join/leave state
- messages: text and voice-note metadata / storage object reference
- audio_sessions: session type, provider, lifecycle, participants, consent metadata
- communication_consents: scoped consent and revocation
- communication_audit_events: security-relevant events

Before creating tables, compare these entities with existing SARINA schema and reuse existing user, role, organization, specialist, and farm relations. Do not duplicate identity or organization tables.

## 10. Phased delivery

### Phase 0 — Architecture and capability inventory
- Confirm existing app structure, Supabase schema, RLS patterns, and current authentication branch.
- Document provider interfaces and data contracts.
- No provider credentials or paid subscriptions required.

### Phase 1 — In-app communication foundation
- Authenticated conversation list and text messages.
- Voice-note upload/playback with private storage and explicit access rules.
- Participant authorization, block/report, and audit events.
- No external messenger dependency.

### Phase 2 — AI voice
- Push-to-talk / voice input, transcription, AI response, and speech output.
- Connect through the existing provider-neutral AI gateway/SIACP.
- Start with a low-cost test path; keep provider implementation replaceable.

### Phase 3 — Human live audio
- WebRTC signaling and live audio for farmer-specialist sessions.
- Add scheduling and specialist availability.
- Add organization representatives only after role/scope authorization is tested.

### Phase 4 — Regional verification and messaging adapters
- Enable one provider at a time after official API review, configuration, and end-to-end tests.
- Test Iran-specific providers independently; do not assume public bot APIs support OTP delivery.
- Add WhatsApp/Telegram or other regional channels where lawful and operationally supported.

## 11. Definition of done for the first usable release

- User can start an authorized in-app conversation with a specialist.
- User can send and receive a voice note.
- User can start an AI voice interaction through the SARINA AI gateway.
- Organization contact is visible only when provisioned and authorized.
- No external provider is required for the in-app baseline.
- No recording occurs without explicit consent.
- Authorization and RLS tests cover cross-user and cross-organization access.
- Provider failure does not break core SARINA identity or conversations.

## 12. Explicit non-goals for the first release

- No automatic access to phone contacts.
- No silent geolocation-based country inference.
- No promise that all Iranian messaging apps support official OTP or voice integrations.
- No recording of human calls by default.
- No merging of provider accounts into SARINA identity.
- No broad schema expansion before confirming existing tables and first UI use case.

## Implementation status — voice-note slice

The first media slice is implemented on `feature/sarina-communication-gateway`:

- A private Supabase Storage bucket, `expert-voice-notes`, is provisioned with a 20 MiB object limit and an explicit audio MIME allowlist.
- Storage INSERT/SELECT/DELETE policies restrict access to the farmer who opened the consultation and the currently assigned verified expert. Objects are stored under `<consultation_id>/<sarina_user_id>/<random_file>`.
- Consultation messages now support either ordinary text (`content_parts = []`) or one audio attachment descriptor in `content_parts`; the existing participant checks remain in force.
- Farmer and expert workspaces now expose audio-file upload and signed-URL playback controls. Audio URLs are short-lived and are never made public.
- If message insertion fails after upload, the client attempts to remove the just-uploaded object; the DELETE policy permits cleanup of the sender's own object.

This slice supports in-app microphone recording where the browser exposes MediaRecorder and microphone permission, plus audio-file selection as a fallback, upload, and signed-URL playback. Duration metadata, waveform UI, live WebRTC, AI voice, and regional messaging adapters are not yet implemented.

Validation completed: migrations applied successfully; the private bucket and expected RLS policies were queried and confirmed. Browser/device end-to-end testing with two real participant sessions and deployment remain outstanding.

## Implementation status — first live-audio slice

The first provider-neutral human-to-human live-audio slice is now present on `feature/sarina-communication-gateway`:

- `public.expert_audio_sessions` records call initiation, accepted/rejected/ended/missed status, expiry, and timestamps. RLS limits reads and writes to the farmer requester and the assigned verified expert after the assignment is accepted.
- Supabase Realtime private topic `consultation:<consultation_id>:call` carries only signaling events (invite, SDP answer, ICE candidates, reject, end). Realtime RLS policies restrict receive/send to those same accepted participants.
- The farmer and expert consultation panels expose start, accept, decline, and end controls. Browser microphone access is requested only when starting or accepting a call.
- WebRTC audio is peer-to-peer; no audio recording or media relay is implemented. Early ICE candidates are buffered during call setup, and unanswered invitations expire after 90 seconds.
- The default client ICE configuration currently contains a public STUN server. An optional `SARINA_WEBRTC_ICE_SERVERS` runtime configuration hook is available for a later TURN configuration; production reliability across restrictive NATs/firewalls requires a TURN service and tested short-lived credentials.

Validation completed: migration 036 applied; the call-session table's RLS and three participant policies were queried and confirmed; the identity-immutability trigger was confirmed; the two Realtime signaling policies were queried and confirmed.

Not yet completed: two-device browser E2E tests, microphone permission testing, TURN provisioning, Realtime project-level enforcement of private-only channels, deployment, and merge. Treat this as an implementation slice for controlled testing, not a production-ready calling service.


## Implementation readiness — TURN and Realtime project enforcement

Assessment for the next controlled test:

- The browser signaling channel is already created with `config: { private: true }`; the client-side requirement for private Realtime channels is present.
- Database verification on 2026-11-16 confirmed: RLS is enabled on `public.expert_audio_sessions`, three participant-scoped policies exist on that table, two participant-scoped policies exist on `realtime.messages` for the SARINA call topic, and `expert_consultation_messages` is included in `supabase_realtime`.
- Project-level enforcement is a separate dashboard setting and cannot be proven by database policies alone. In Supabase Dashboard → Realtime → Settings, disable **Allow public access** before treating private-channel enforcement as complete. This is a project-wide behavior change and should be checked by the project administrator.
- Cloudflare Realtime TURN is a viable provider-neutral media transport candidate for the existing peer-to-peer WebRTC design. Its documented service endpoint supports UDP, TCP, and TLS. Cloudflare requires a long-lived TURN key and API token to remain server-side; the application backend must exchange them for short-lived ICE credentials and return only those expiring credentials to the browser.
- Cloudflare documents TURN as free when used together with its Realtime SFU; standalone TURN is billed at USD 0.05 per real-time GB outbound from Cloudflare to the TURN client. This cost distinction must be considered before enabling it for SARINA's peer-to-peer calls.
- No Cloudflare account credentials, TURN key, or billing approval have been supplied. Therefore no TURN key was created, no provider secret was stored, and the current STUN-only behavior remains unchanged.
- Next implementation gate: provision a Cloudflare TURN key and narrowly scoped API token in the owner's Cloudflare account; store both as Supabase Edge Function secrets; implement an authenticated credential endpoint with short TTL and participant authorization; then pass the returned ICE server configuration to the browser. Never embed the long-lived key or API token in frontend code.
- No merge, application deployment, or production activation was performed as part of this assessment.
