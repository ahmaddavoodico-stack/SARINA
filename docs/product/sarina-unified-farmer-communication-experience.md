# SARINA — Unified Farmer Communication Experience & Multimodal AI Architecture

**Decision date:** 2026-11-23  
**Status:** Product direction approved; this is now an active implementation workstream.  
**Repository:** `ahmaddavoodico-stack/SARINA`  
**Execution rule:** Work directly on `main`; do not create a feature branch.

## 1. Why this is a major product milestone

Until now, SARINA's capabilities and internal components have been examined largely as separate building blocks. Starting on 2026-11-23, the focus shifts to how a farmer actually communicates with SARINA and how all those capabilities are presented as one coherent experience.

This is a central product layer, not a decorative chat widget. It defines how farmers ask for help, provide evidence, receive guidance, move between services without navigating modules, and maintain continuity with SARINA.

This workstream must proceed **in parallel with resolving the remaining Phase 0 and Phase 1 issues**. It must not replace, silently defer, or destabilize those foundational tasks. The work plan should track both streams together and make dependencies visible.

## 2. Approved product principle: one conversation, many capabilities

The farmer sees one recognizable SARINA companion and one conversational entry point. The farmer should not need to understand the platform's internal modules or decide which department/service to open.

Behind this single doorway, an orchestration layer identifies the request and invokes the appropriate internal capability. Services remain independently maintainable behind the scenes; the farmer receives one coherent conversational experience.

The single conversation should progressively support:
- Text messages.
- Voice input and spoken responses.
- Photo and image attachments.
- Documents and other relevant farm records.

The interface must make these inputs discoverable and easy to use on mobile devices. A farmer must be able to send a photo proactively or when SARINA asks for one, without leaving the conversation.

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


## Superseding decision — 2026-11-23

The farmer-facing case conversation is one shared room for the farmer, assigned verified specialist, and SARINA. This supersedes earlier wording that separated the AI assistant from specialist chat. SARINA assists both sides, prepares concise explanations and structured case drafts, and helps promote important facts into the farmer's case file. Only specialist-approved findings and recommendations may become authoritative case records or operational instructions. Specialist-only internal notes remain private unless explicitly promoted. The shared room must preserve message provenance, server-side authorization, and the existing one-time USD 5 OpenAI test ceiling; no provider is activated by this decision.
