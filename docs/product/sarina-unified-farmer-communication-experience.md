# SARINA — Unified Farmer Communication Experience & Multimodal AI Architecture

**Decision date:** 2026-11-23; voice and intelligent-routing decisions added 2026-11-25  
**Status:** Product direction approved; implementation and live model invocation are not yet verified.  
**Repository:** `ahmaddavoodico-stack/SARINA`  
**Execution rule:** Keep implementation on an isolated feature branch. Do not merge to `main` or alter Production until the relevant tests, acceptance checks, and explicit owner approval are complete.

## 1. Why this is a major product milestone

Until now, SARINA's capabilities and internal components have been examined largely as separate building blocks. Starting on 2026-11-23, the focus shifts to how a farmer actually communicates with SARINA and how all those capabilities are presented as one coherent experience.

This is a central product layer, not a decorative chat widget. It defines how farmers ask for help, provide evidence, receive guidance, move between services without navigating modules, and maintain continuity with SARINA.

This workstream must proceed **in parallel with resolving the remaining Phase 0 and Phase 1 issues**. It must not replace, silently defer, or destabilize those foundational tasks. The work plan should track both streams together and make dependencies visible.

## 2. Approved product principle: one conversation, many capabilities

The farmer sees one recognizable SARINA companion and one conversational entry point. The farmer should not need to understand the platform's internal modules or decide which department/service to open.

Behind this single doorway, an orchestration layer identifies the request and invokes the appropriate internal capability. Services remain independently maintainable behind the scenes; the farmer receives one coherent conversational experience.

The single conversation should progressively support:
- Text messages.
- Voice notes: record and send an audio message; no live call or always-on microphone session is required.
- Spoken responses returned as playable audio, alongside readable text.
- Photo and image attachments.
- Documents and other relevant farm records.

The interface must make these inputs discoverable and easy to use on mobile devices. A farmer must be able to send a photo or voice note proactively or when SARINA asks for one, without leaving the conversation.

## 3. AI routing and model responsibilities

Model selection is internal to SARINA. Farmers should not have to choose a model or understand which provider is answering. SARINA should route requests by task, risk, modality, availability, and measured quality, and record usage by provider/model.

### 3.1 Strata — candidate for local, routine processing

Strata is to be evaluated first as a separate pilot. It is not yet approved as a production dependency and must not be connected to the main SARINA architecture until its quality, hardware requirements, operating cost, Persian performance, speed, stability, concurrency, and privacy/security characteristics have been tested.

Potential low-sensitivity tasks, subject to validation:
- Friendly everyday conversation and greetings.
- Simple general questions and low-risk agricultural explanations.
- Classification, extraction, summarization, and preparation of structured information.
- Preliminary image description or visual triage only if the selected Strata model genuinely supports vision and passes image-quality tests.

Strata's ability to run a model does not itself prove that the model supports images or produces reliable agricultural diagnoses. Vision capability and performance must be verified for the exact model and runtime. No production routing decision should be based on assumptions.

### 3.2 OpenAI API — selective escalation for important work

OpenAI API is intended to help SARINA with important, complex, specialized, ambiguous, or higher-risk analysis—not to power every greeting or routine exchange.

Escalation candidates include:
- Complex crop and plant-health assessments.
- Difficult or multi-cause diagnosis, especially when image evidence and farm history must be considered together.
- High-consequence recommendations that need stronger reasoning and explicit uncertainty handling.
- Cases where the local model is uncertain, unavailable, or fails a quality threshold.
- Complex multimodal interpretation when the selected provider/model supports the required inputs.

Use the minimum necessary context and media, with the farmer's authorized records and appropriate consent. The assistant must distinguish observations, farmer-reported facts, retrieved evidence, and hypotheses. It must not present an AI estimate as a confirmed diagnosis.

The previously approved OpenAI test budget remains a **one-time $5 technical-test ceiling**, not a production budget. Automatic recharge remains off. Keep the provider/model disabled until the server-side credential, explicit model allowlist, and enforceable server-side spending guard are verified. Inspect usage after each test stage. Never expose API secrets in the browser.

### 3.3 Official agricultural circulars and institutional information

Routine explanation of Ministry of Agriculture Jihad circulars, official instructions, forms, and support programs should not trigger an expensive general-purpose API call by default.

The primary path is retrieval from trusted, current, source-controlled or otherwise verified documents and records. A response should identify the issuing authority, document/date, validity or update status, and source link when available. SARINA may explain a circular and help prepare a checklist, but must not invent a circular or claim to make an official eligibility or approval decision.

Use a stronger model only when a genuinely complex interpretation is needed, and keep the official source as the authority.

## 4. Photo intake is a core conversation capability

The conversation interface currently lacks a clear place for a farmer to send an image when SARINA asks for one—for example, during a discussion about yellowing leaves. This is a product gap and must be addressed as part of this workstream.

### Required user experience

- A visible attachment action in the farmer conversation, available even when SARINA has not explicitly requested a photo.
- Direct access to camera capture and the device photo gallery, subject to platform/browser permissions.
- Support for one or multiple images in a conversation.
- A clear preview before sending, with the ability to remove or replace an image.
- SARINA can request a specific useful view, such as the whole plant, the affected leaf, the underside of the leaf, stem/base, or roots where appropriate.
- Images appear as part of the relevant conversation turn and remain associated with the correct farmer, conversation, and—only after selection/confirmation—the correct farm.
- Upload, processing, and analysis states are visible. Failures must be explained; the farmer must not be told an image was analyzed if it was not.
- The experience must work well on common mobile screen sizes and with accessible controls.

### Secure handling

- Store uploaded media in private storage, not a publicly readable bucket.
- Enforce authenticated ownership and authorization on upload, retrieval, and deletion.
- Use short-lived signed access where needed; never expose service-role credentials.
- Validate file type and size, generate safe storage paths, and avoid trusting client-supplied ownership or farm identifiers.
- Apply retention and deletion rules consistent with SARINA's privacy approach.
- Do not expose one farmer's images or conversation attachments to another farmer or an unrelated specialist.
- Keep expert consultation records and specialist communications separate from the AI conversation history, while allowing an explicitly authorized referral to include selected relevant evidence.

### Diagnostic interaction

A photo is evidence, not a diagnosis by itself. SARINA should combine it with a small number of relevant questions: crop/variety, affected plant part, onset and progression, irrigation/fertilizer or spray history, spread across plants, and farm conditions as relevant. Ask one useful question at a time rather than presenting a long form.

For uncertain cases, request additional angles or a human specialist review. The system must preserve the original image and the model's actual analysis status without overstating certainty.

## 5. One conversational doorway and internal service routing

The orchestration layer should route farmer intent to existing services, including:
- Farm registration, farm records, and progress.
- Crop and agronomy guidance.
- Official circulars, support programs, and document checklists.
- Marketplace and product/service discovery.
- Market information and investment opportunities.
- Human specialist referral and follow-up.

Do not duplicate the underlying business records or create a parallel copy of existing workflows merely to support chat. The conversational layer should call the appropriate service and present the result naturally.

The specialist workspace remains separate and professional. A farmer can request a specialist through the same SARINA conversation, while expert work, internal notes, and specialist-to-specialist communications retain their own records and permissions.

## 6. Context, identity, and continuity

- Authenticate every farmer interaction.
- Retrieve only the signed-in farmer's authorized records.
- Reuse relevant conversation history and farm context only within the caller's permissions.
- Ask the farmer to select or confirm a farm before attaching farm-specific context.
- Never infer ownership from client-editable metadata or trust farm identifiers supplied without server-side authorization.
- Keep a general conversation mode available before the farmer has registered a farm.
- Persist user and assistant messages with correct conversation linkage, ownership, and status.
- Use bounded history and idempotency/retry behavior; failures must not silently lose messages.
- Do not show a successful AI answer unless a provider was actually invoked and the assistant response was persisted.

## 7. Workstreams from 2026-11-23

Run two coordinated workstreams:

### Workstream A — Phase 0 and Phase 1 stabilization

Continue fixing the foundational defects and completing the existing acceptance requirements. Do not declare a phase complete without evidence from the relevant checks.

Known open items surfaced in the project record and requiring status verification:
- Resolve the approved SARINA master-logo asset and replace incorrect sprout placeholders where the official logo is required. The official identity is the approved two symbolic human figures among green leaves beneath a protective green arch, using green and gold/orange. Do not substitute a generic sprout.
- Reconcile the still-open/unstable PR #121 executive-home/PWA work before merge or deployment; prior build success alone is not proof of merge, deployment, or device acceptance.
- Complete real-device PWA installation, offline behavior, update behavior, and icon verification.
- Continue the existing login, installation, and end-to-end first-farm setup checks as applicable; report actual current status rather than assuming completion.
- Keep dependencies and blockers visible and do not let the new conversation workstream mask foundational defects.

### Workstream B — Farmer communication experience

Begin implementation and validation of the unified farmer conversation:
1. Audit the current farmer chat component and its mounted location in the app.
2. Implement a real conversation composer with text and a visible photo attachment action.
3. Implement secure media upload and conversation-message linkage.
4. Verify existing conversation/message schema, ownership, RLS, auth identity mapping, and migration history before changing persistence.
5. Implement or complete the secure server-side conversation endpoint and message persistence.
6. Add intent routing to existing services without duplicating their data.
7. Implement selective model routing: routine low-risk work to a validated local model only after Strata testing; important/complex work to OpenAI API under the hard test budget and server-side controls.
8. Add voice and document support in staged increments after text and image flows are secure and reliable.
9. Run end-to-end acceptance tests on mobile and with real farmer scenarios.

The two workstreams should share a single visible project status: completed, in progress, blocked, and awaiting test. Prioritize tasks that unblock both streams, but do not make unsafe shortcuts to database security, model spending, or production deployment.

## 8. Implementation order and acceptance gates

### Gate 1 — Baseline and security audit
- Inspect current code, live schema, RLS, migrations, storage policies, Edge Functions, and deployment state.
- Confirm auth-to-farmer identity mapping and farm ownership checks.
- Record current Phase 0/1 status and dependencies.
- No database migration or live schema mutation before the audit.

### Gate 2 — Conversation shell and image intake
- Mobile-first composer with text, camera/gallery attachment, preview, multi-image handling, upload progress, retry, and removal.
- Private storage and server-enforced ownership.
- User can send an image whether requested by SARINA or proactively.
- No false claim that an image was received or analyzed.

### Gate 3 — Real text conversation and persistence
- Authenticated server request, authorized conversation creation/resume, bounded context, persisted messages, idempotency, transparent failures.
- At least three coherent conversational turns.
- Cross-user isolation and farm confirmation verified.

### Gate 4 — Model routing and controlled escalation
- Strata benchmark completed separately before any production routing to it.
- OpenAI secret and server-side hard budget guard verified before any paid test.
- Per-provider/model usage recorded and reviewed.
- API is not invoked for ordinary greetings or routine circular lookup/explanation by default.
- Important cases can be escalated with the necessary authorized context and image input when supported.

### Gate 5 — Unified services and modalities
- Intent routing works through the same farmer conversation.
- Specialist referral is available without merging specialist records into AI chat history.
- Voice and documents are added with explicit upload/consent, secure handling, and clear status.

### Gate 6 — Acceptance and release
- Persian conversation, continuity, farm context confirmation, image intake, image analysis status, source-grounded official information, uncertain diagnosis, specialist referral, retry/error paths, mobile usability, security isolation, and cost controls all tested.
- Phase 0/1 completion is tracked independently and remains a release condition wherever foundational acceptance requires it.
- Do not claim build, deployment, or acceptance success unless the corresponding check was actually run and passed.

## 9. Known technical checkpoint at the time of this decision

The following are previously inspected facts and must be re-verified before implementation:
- `src/SarinaCompanion.tsx` exists and is mounted for farmer accounts in `src/App.tsx`; the send handler was a local-only prototype, not a real AI request/persistence flow.
- `sarina-central-intelligence` was an authenticated safety stub returning `model_invoked: false`, not a working farmer chat endpoint.
- OpenAI provider/model configuration was inactive and credentials were marked pending in database configuration; the registered model code is configuration, not proof of model availability.
- AI conversation/message tables had RLS enabled; the inspected state did not show ordinary authenticated-user policies. Do not open these tables to clients or disable RLS as a shortcut. Use secure server-side operations with explicit ownership checks.
- The specialist-only Responses adapter must not be reused as the general farmer conversational response contract.
- The one-time $5 technical test ceiling and disabled automatic recharge remain in force.
- No live model call, paid API usage, database migration, or production chat deployment is implied by this document.

## 10. Operating principle

SARINA should feel to the farmer like one attentive, reliable companion—not a collection of disconnected tools. Internally, however, every action must be routed to the right service, use the right evidence and model, respect permissions, and report honestly what did and did not happen.

**From 2026-11-23 onward, the farmer communication experience is an active top-level product workstream, pursued alongside Phase 0 and Phase 1 stabilization.**

## 11. Approved decision — SARINA Voice Notes & Spoken Responses (2026-11-25)

**Decision status:** Approved product requirement. The interaction is asynchronous voice messaging, not a live telephone call, continuous voice session, or always-on microphone.

### 11.1 Farmer-facing experience

- The farmer can press a record button, record a voice note, preview/cancel it, and send it as a normal conversation message.
- SARINA returns the recognized transcript for transparency and correction where useful.
- The final assistant response is delivered as both readable text and a playable audio message.
- The farmer can replay the response; playback must not require a live connection to an AI provider.
- Text input remains available as an equal alternative.
- The same voice-message contract is available through the SARINA web app, Telegram and Baleh adapters. Channel adapters handle their own upload/download formats but do not contain separate AI brains.
- The first version is push-to-record / send / process / reply. No live streaming speech, call UI, wake-word listener, or real-time duplex audio is required.

### 11.2 Speech-to-text (STT) — local-first and API-free by default

- Run speech recognition on infrastructure controlled by SARINA using a self-hosted open-source engine and downloadable model weights.
- Initial candidate: multilingual Whisper through `faster-whisper` with CPU INT8 as a benchmark baseline; `whisper.cpp` with quantized models is an alternative for constrained CPU environments.
- Explicitly support Persian (`fa`) and Arabic (`ar`) in the first evaluation. Language auto-detection may assist, but the user profile or a simple language selector should be available to avoid silent misrecognition.
- Preserve the language spoken; do not translate speech to English as the default transcription behavior.
- Add Persian normalization after transcription (Arabic/Persian ی and ک variants, half-space/ZWNJ, punctuation and number handling) without changing the farmer's intended wording. Keep the raw transcript available for audit/debug under the retention policy.
- Test noisy outdoor recordings, regional accents, farm/equipment noise, low-end Android microphones, short clips, mixed Persian/Arabic phrases, crop/product names, and numbers/units.
- Voice recognition failure must produce a friendly retry or text-entry path; never fabricate a transcript.

### 11.3 Text-to-speech (TTS) — local-first and API-free by default

- Generate the spoken response on SARINA-controlled infrastructure with an open-source/local TTS engine.
- Initial candidate: Piper with Persian voice models, subject to listening tests and a per-model license review. Candidate voices must be compared for intelligibility, naturalness, pronunciation of agricultural terms, number/unit reading, dialect suitability and file size. Do not assume every Piper voice has the same license; retain each model card and attribution.
- Keep the TTS engine and voice model replaceable behind a stable internal adapter.
- Produce a mobile-friendly audio format supported by the target channels; normalize loudness and avoid excessively long single audio files by splitting at sentence boundaries when needed.
- Return text even if speech synthesis fails. A failed TTS step must not discard the written answer.
- Voice identity should be warm and clear, not imitate a real person or imply that SARINA is human.

### 11.4 Voice processing lifecycle and privacy

1. Authenticate the sender and validate file type, size, duration and ownership.
2. Store the original audio temporarily in private storage or a protected processing area.
3. Normalize/decode the channel format (for example OGG/Opus from messaging channels or WebM/Opus from browsers) using a maintained audio decoder such as FFmpeg/PyAV.
4. Run STT as an asynchronous background job with bounded duration, queue depth, retries and concurrency.
5. Attach the transcript to the correct conversation turn and pass it to the same intent router used for text.
6. Run the authorized task and persist the text response.
7. Run local TTS and attach the generated audio to the assistant response.
8. Apply the configured retention/deletion policy to source audio and generated audio; do not retain raw recordings indefinitely by default.

- Storage must be private and ownership-scoped. Do not put audio in a public bucket or expose service-role credentials.
- The client must not be trusted for user, farm, role, provider or model identity.
- Record status and minimal audit metadata; avoid copying full audio or sensitive transcript content into application logs.
- The farmer must be told whether transcription, analysis and voice generation each succeeded. Never claim a step completed when it did not.

## 12. Approved architecture — SARINA Front Desk & Intelligence Orchestrator

### 12.1 Single front door

SARINA Front Desk is the one user-facing assistant identity. It receives text, voice transcripts, images and documents, maintains the conversational thread, and presents the final response. It is not itself a large language model and does not directly own business data or permissions.

### 12.2 Orchestrator responsibilities

The SARINA Intelligence Orchestrator is an internal, channel-independent service. It must:

1. Classify the request using deterministic rules first, then a small local classifier only when needed.
2. Distinguish social conversation, general information, agricultural advice, image/document analysis, marketplace, account/support, management and specialist-referral intents.
3. Determine risk, required capabilities, data sensitivity, user consent and authorization scope.
4. Select the responsible internal agent/service and then an approved model/tool only if the task requires one.
5. Dispatch a bounded, versioned task envelope and track status, timeout, retry and cancellation.
6. Validate the result against the expected schema and applicable safety policy.
7. Compose a single SARINA-branded answer, then optionally synthesize that answer to speech.
8. Persist task outcome and minimal audit/usage metadata; report failure or human-review requirement honestly.

### 12.3 Cost-aware routing policy

- Greetings, thanks, acknowledgements and simple social exchanges should be handled by deterministic response templates/state-aware conversation rules wherever possible. They must not invoke a paid model by default.
- For simple but non-deterministic friendly exchanges, a validated small self-hosted local model may be used. This remains subject to Persian quality and hardware tests.
- STT and TTS are separate local services. A voice greeting may require local STT and TTS, but must not invoke a general-purpose paid LLM solely because the input arrived as audio.
- Routine official-document questions should use verified retrieval before any general-purpose model call.
- Use a stronger local or approved hosted model only when the request is complex, ambiguous, multimodal, or exceeds the quality threshold of the lightweight route.
- High-impact agricultural, financial, account-security and physical-operation requests must follow domain rules and human approval requirements. The model cannot grant itself permissions or directly execute privileged actions.
- If confidence is low, ask one concise clarification question or refer to a qualified specialist; do not silently escalate to an unapproved provider.
- The routing policy, provider allowlist, risk thresholds and budgets are controlled server-side, never by client-supplied model names or prompts.

### 12.4 Task envelope and agent contract

Each delegated task should use a versioned contract containing at least:
- `task_id`, `conversation_id`, opaque actor reference, optional confirmed `farm_id`;
- `task_type`, `intent`, `assigned_agent`, `priority`, `risk_level`;
- `required_capabilities` and allowed tools;
- minimum authorized input/context and consent/scope reference;
- expected output schema, language, deadline and resource budget;
- `idempotency_key`, correlation ID, created/updated timestamps;
- status: `received`, `classified`, `queued`, `running`, `awaiting_human`, `completed`, `failed`, or `cancelled`.

Agents return structured results with status, evidence/source references, uncertainty, missing information, and any human-review requirement. The Orchestrator—not an agent—owns the user-visible task lifecycle and final handoff.

### 12.5 Security and operational boundaries

- SCI/SARINA domain policy remains authoritative for consent, authorization, task eligibility and final decisions; the model gateway only dispatches approved work.
- No model receives direct database credentials or unrestricted SQL access. Agents use narrowly scoped server-side tools/APIs.
- Never allow model output to alter permissions, provider allowlists, safety policy, spending limits or its own system instructions.
- Require explicit confirmation for orders, payments, outbound messages, account changes, data deletion, and other consequential actions.
- Use least privilege, per-task timeouts, bounded retries, concurrency limits, rate limits, idempotency and auditable execution.
- Support cancellation and clear handoff to a human specialist or support operator.
- Keep channel adapters thin: Telegram, Baleh and web app authenticate/normalize messages and deliver responses; orchestration remains central.

## 13. Required components and deployment dependencies

The following are requirements to evaluate and implement; listing them does not claim they are already installed or deployed.

### 13.1 Application and orchestration service
- A persistent server-side service for orchestration and model/audio workers, preferably a small Python service (for example FastAPI) with versioned internal HTTP contracts.
- Existing Supabase Edge Functions can remain the authenticated application gateway, but must not load large models or run long audio jobs.
- The current Vercel static Vite deployment is the frontend host, not a persistent model-inference host.
- Use an internal/private network between the gateway and inference workers; do not expose Ollama, Whisper, Piper or worker control ports publicly.
- Keep model artifacts and Python dependencies outside Git and outside Vercel build bundles.

### 13.2 Audio processing stack
- STT engine and pinned model artifact (benchmark faster-whisper/Whisper multilingual against whisper.cpp quantized).
- TTS engine and individually licensed Persian voice model (benchmark Piper candidates first).
- Audio decoder/normalizer for browser and messaging-channel formats.
- Optional voice activity detection (VAD), for example Silero VAD, to trim silence and segment longer recordings; VAD is not a prerequisite for the first prototype.
- A background job queue/worker so uploads do not hold an Edge Function request open.
- Private temporary audio storage, signed/authorized retrieval, expiry/deletion and storage quotas.
- Configurable duration/file-size limits, supported MIME types and safe decoding limits.

### 13.3 Task routing and service integration
- Deterministic intent/risk rules and a lightweight classifier/embedding option for uncertain cases.
- A registry of approved agents, tools and model capabilities; no hard-coded provider assumptions in channel code.
- A common task queue/state machine, retry/idempotency handling and result validator.
- Adapters for the specialist, store/Manus, support, management and farmer-domain services, each with explicit capabilities and permissions.
- A response composer that produces a readable SARINA answer and invokes TTS only after the final text is ready.
- Reuse and audit existing conversation/message tables and RLS before any schema change. Add a task/job table or storage policy only after the schema/security audit and separate approval.

### 13.4 Observability and administration
- Health checks for STT, TTS, local LLM runtime, queue and agent adapters.
- Metrics for queue wait, transcription latency, transcription quality sample, TTS latency, model selection, task success/failure, resource use and provider spend.
- Safe logs that exclude secrets and unnecessary raw audio/transcript contents.
- Model/voice version registry, license and attribution inventory, rollback procedure and resource limits.
- A control-panel view of pending, running, failed and human-review tasks.

### 13.5 Hardware and capacity

- The existing Vercel + hosted Supabase architecture cannot itself host persistent local model inference; a separate persistent compute host or a future consolidated SARINA server is required.
- The local-AI pilot document's Qwen3.5 4B target (32 GB system RAM preferred, 8–12 GB VRAM preferred, and at least 100 GB free NVMe) is a planning target for a combined LLM host, not a minimum requirement for the separate STT/TTS services.
- STT/TTS can be benchmarked independently on CPU with smaller/quantized models, but acceptable latency, Persian accuracy, concurrent workload and peak RAM must be measured on the actual host. Do not assume the previously recorded 4-vCPU/8-GB server can run every model or all services concurrently.
- Apply resource isolation and concurrency caps so audio transcription cannot starve the web application, database gateway or other critical services.
- The software and model weights may be free/open-source, but server hosting, electricity, storage, bandwidth, maintenance and monitoring are not necessarily free.

## 14. Recommended evaluation shortlist (not yet a production selection)

| Capability | First candidate | Alternative | Decision gate |
|---|---|---|---|
| Persian/Arabic STT | faster-whisper + multilingual Whisper, CPU INT8 benchmark | whisper.cpp quantized | Persian/Arabic field-audio benchmark and actual host RAM/latency |
| Persian TTS | Piper with Persian voice candidates | another local ONNX/VITS TTS engine | naturalness, intelligibility, agricultural vocabulary, commercial-use license |
| Voice activity detection | Silero VAD (optional) | simple silence trimming | Only add if it improves latency/quality enough to justify complexity |
| Lightweight intent routing | deterministic rules first; small local classifier/embedding second | small local LLM fallback | Accuracy, false-routing rate, latency and resource use |
| General local LLM | Existing local adapter / Qwen3.5 4B pilot candidate | another tested open-weight model/runtime | Separate model benchmark; do not couple STT/TTS to the LLM choice |
| Job execution | Existing infrastructure after audit; otherwise a small queue/worker | database-backed job queue | Reliability, retry, cancellation and operational simplicity |

Whisper multilingual supports Persian as a language code, and its code/model weights are MIT-licensed. faster-whisper is a CTranslate2 reimplementation that reports lower memory use and faster inference than the reference implementation, including CPU INT8 options; these claims must still be benchmarked on SARINA's hardware. Piper has Persian voice candidates, but voice-model licenses differ and must be checked individually before commercial deployment. See the references below.

## 15. Delivery sequence and acceptance criteria for voice and orchestration

### Phase V0 — inventory and offline benchmark
- Verify actual host CPU/RAM/disk/GPU, current workloads and free capacity.
- Confirm available private storage, conversation schema/RLS, Edge Function gateway and branch/deployment state.
- Prepare a small consented or synthetic Persian/Arabic audio evaluation set, including noisy farm recordings and common agricultural vocabulary.
- Benchmark STT model size/quantization and Piper voice candidates on the actual target host.
- Record word error rate or character error rate, latency, peak RAM, disk footprint and CPU utilization. Do not choose a model based on marketing claims alone.

### Phase V1 — asynchronous voice-note pipeline
- Implement record/preview/send in the farmer UI.
- Add authenticated upload and temporary private storage.
- Add queued transcription worker and transcript display.
- Verify retry, duplicate submission protection, cancel/expiry and deletion.
- No paid speech API; no live call functionality.

### Phase V2 — spoken response
- Generate TTS from the final persisted assistant text.
- Return text and audio in the same assistant message.
- Verify Persian pronunciation, numbers, units, names, long-answer chunking and playback on low-end Android devices and Telegram/Baleh.
- If TTS fails, the text answer remains available.

### Phase V3 — Front Desk and task orchestration
- Implement deterministic social-intent fast path and local classifier fallback.
- Route at least greetings, general questions, farm/agronomy, specialist referral, store, support and management intents to their approved destinations.
- Verify permissions, agent capability registry, task states, timeout/retry/cancel and structured result validation.
- Verify greetings and thanks do not invoke a paid LLM; audio greetings may use local STT/TTS only.
- Verify no agent can exceed its task scope or execute consequential actions without explicit confirmation.

### Phase V4 — controlled pilot
- Run end-to-end tests through web app, Telegram and Baleh against the same central service.
- Test Persian and Arabic, noisy audio, regional accents, low bandwidth, interrupted uploads, provider/worker outage and concurrent messages.
- Measure latency, CPU/RAM/disk, transcription quality, TTS quality, queue backlog and task-routing precision.
- Keep paid provider dispatch disabled unless a separately approved, budget-capped escalation test is required.
- Production release requires security/privacy review, specialist validation for consequential agricultural advice, and explicit owner acceptance.

## 16. References

- OpenAI Whisper repository and MIT license: https://github.com/openai/whisper
- Whisper language list (includes Persian `fa`): https://github.com/openai/whisper/blob/main/whisper/tokenizer.py
- faster-whisper and CPU INT8/memory benchmarks: https://github.com/SYSTRAN/faster-whisper
- Piper voice catalog and per-voice model-card licensing: https://tderflinger.github.io/piper-docs/about/voices/
- Current Persian Piper voice catalog for evaluation: https://piperhub.org/voices/language/fa/
- Existing SARINA local-AI runtime pilot: `docs/architecture/local-ai-runtime-pilot.md`

## 17. Operating principle

SARINA should feel to the farmer like one attentive, reliable companion—not a collection of disconnected tools. Internally, however, every action must be routed to the right service, use the right evidence and model, respect permissions, and report honestly what did and did not happen.

**From 2026-11-23 onward, the farmer communication experience is an active top-level product workstream, pursued alongside Phase 0 and Phase 1 stabilization.**


## 18. Final owner confirmation — one persistent SARINA chatbox and design authority (2026-11-25)

**Decision status:** Explicitly confirmed by the product owner. This section consolidates the approved target experience and is the governing product direction for subsequent design and implementation work.

### 18.1 The single chatbox is the product experience

- There is exactly one primary farmer-facing SARINA conversation surface: the existing main SARINA chatbox.
- Text, voice notes, photos, images, documents, audio replies, specialist-referral updates and service results all appear in the same conversation timeline. Do not create separate voice-chat pages, specialist chatboxes, store chatboxes, or independent AI chat interfaces for the farmer.
- Voice is an input/output modality of the same message composer and conversation, not a separate product mode. Recording, preview, sending, transcription status, audio playback and retry states must fit naturally into this chatbox.
- The farmer never has to select an agent, department, model or provider. SARINA identifies intent and routes work internally.
- The visible identity remains SARINA throughout routing and handoffs. The farmer should not experience a change of page, assistant identity or conversation when a specialist, store workflow, support service or another internal capability is engaged.
- Specialist workspaces and internal operational tools may remain separate for their authorized staff. Their existence must not fragment the farmer-facing conversation. Only authorized, relevant updates and explicitly approved information return to the farmer's SARINA thread.
- All modalities and routed tasks must preserve conversation continuity, message ordering, delivery/processing status, authorization and the correct confirmed farm context. A farm must never be attached merely because a client supplied an identifier.

### 18.2 One central intelligence, multiple delivery channels

- The web app, Telegram and Baleh are channel adapters to the same central SARINA conversation and orchestration services.
- Channel adapters normalize channel-specific message and media formats, authenticate the sender, and deliver the response. They must not implement separate routing policies, independent agent brains or divergent conversation histories.
- Where channel platform limitations differ, preserve the same underlying task and conversation semantics and provide a clear, honest fallback in that channel.
- A task may continue asynchronously after the farmer sends a message. Its progress and final result must return to the same conversation thread, without requiring the farmer to open a different module.

### 18.3 Mandatory design and implementation alignment

This approved document is the source of truth for the farmer communication experience, voice, Front Desk, Orchestrator, routing, and multimodal interaction. Every related design, prototype, architecture decision, implementation plan, API contract and acceptance test must be checked against it.

Before accepting a related design or implementation, verify that it:
1. Preserves the single main SARINA chatbox and one continuous farmer conversation.
2. Keeps text, voice, images and documents in that same message timeline.
3. Leaves agent/model/provider selection and routing to SARINA behind the scenes.
4. Maintains one consistent SARINA identity through internal service handoffs.
5. Uses the shared central orchestration and channel-adapter architecture.
6. Follows local-first, cost-aware processing and the approved privacy, security, authorization and human-confirmation boundaries.
7. Provides clear status and never claims an upload, transcription, analysis, task or response succeeded unless it actually did.

If a proposed design conflicts with these requirements, do not silently implement or treat it as approved. Record the conflict, explain its user and technical impact, and obtain the product owner's decision before proceeding. Existing screens and workflows should be adapted toward this target incrementally; do not introduce a parallel chat experience.

### 18.4 Roadmap is approved; execution remains gated

The product direction and staged roadmap in this document are approved as the basis for upcoming work. Approval of the roadmap is not approval to bypass technical audits, security reviews, test gates, spending controls or release acceptance.

Implementation should begin with a verified inventory of the current code, conversation schema, RLS, storage, authentication, deployment and available compute. Then proceed in small, reviewable increments, keeping Phase 0/1 stabilization visible alongside the communication workstream. Record each item accurately as planned, implemented, tested, accepted or deployed. Do not mark a capability complete based solely on a design, commit or successful build.

No merge to `main`, production deployment, schema/security mutation, provider activation or paid usage is authorized merely by this product-direction confirmation. Continue using the isolated feature-branch and explicit acceptance process.
