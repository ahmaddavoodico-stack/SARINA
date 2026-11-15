# SARINA Central Intelligence — Architecture V1

Status: design baseline for the first implementation slice.
Scope: one authenticated farmer request, one registered specialist model, one SIACP task, one validated result, one farmer-readable response.
Non-goals for V1: multi-agent debate, autonomous farm actions, worker dispatch, billing, provider marketplace, long-running workflows, and broad database redesign.

## 1. Product responsibility

SARINA Central Intelligence (SCI) owns the quality and lifecycle of the final advisory response. It is not a transparent proxy and is not itself a specialist agronomy authority. It must:
- understand the farmer's request and farm scope;
- assemble the freshest eligible farm context;
- choose an enabled, registered specialist model through provider-independent routing;
- create and validate a SIACP task envelope;
- invoke the selected provider through a replaceable adapter;
- validate and normalize the returned task result;
- preserve evidence, provenance, uncertainty, conflicts and safety limits;
- produce a concise farmer-facing answer and any necessary follow-up question;
- record lifecycle outcomes for later evaluation.

The farmer-facing application remains simple. Specialist reports and raw model traces are internal SCI material and must not be exposed as the default farmer response.

## 2. V1 request lifecycle

1. **Receive** — authenticated farmer submits farm_id, question, preferred language and optional user-supplied references. The client does not select a provider or send trusted farm context.
2. **Authorize** — server verifies the session and ownership/access to the requested farm. A request without valid farm access is rejected.
3. **Assemble context** — server retrieves the same-farm weather context and SARINA_FARM_LAND_CONTEXT_V1. Context is time-bounded. Farmer reports, lab records, weather-provider estimates and regional model predictions remain separate provenance classes. Missing values remain missing.
4. **Check readiness** — if essential context is missing, stale or mismatched, do not call a model. Return a precise recoverable status and ask only for the minimum missing input.
5. **Route** — select one active, eligible specialist from the existing provider/model registry using task domain, language, availability and configured policy. Do not hard-code a vendor into the SCI core.
6. **Build SIACP task** — create a fresh TASK_REQUEST using SIACP/1.1, unique message/correlation IDs, nonce, timestamp, TTL, explicit task, question, inputs, required output and constraints. Include provenance and safety requirements.
7. **Dispatch** — provider-specific adapter translates the SIACP task to the provider API. Provider secrets remain server-side. Apply timeout, bounded retries only for safe transient failures, and request-size limits.
8. **Validate result** — require a matching correlation/task identity, expected result type/schema, non-empty substantive response, and provider/model metadata. Reject malformed, mismatched, expired or unsupported results. Treat model output as untrusted data, never as executable instructions.
9. **Assess** — derive an evidence/provenance summary and confidence band from available support, context completeness and model-reported uncertainty. Do not turn model confidence into a verified fact. Flag conflicts or unsupported claims; do not silently resolve material disagreements.
10. **Compose** — create a Persian/English farmer-readable answer: short finding, practical low-risk next step, what is unknown, evidence/source class, confidence and escalation condition. Ask a focused follow-up when required.
11. **Persist and return** — store task lifecycle metadata and normalized result using an approved persistence path with owner-scoped access. Return only the farmer-safe response plus a compact status; keep full specialist diagnostics internal.

## 3. Logical components and boundaries

| Component | Responsibility | Must not do |
|---|---|---|
| Request Gateway | Authenticated request contract, validation, rate/size limits | Trust client-supplied context or provider IDs |
| Context Manager | Fetch same-farm weather and land context; freshness and provenance | Fill missing values with guesses |
| AI Router | Select an eligible registered model from policy and task domain | Embed vendor-specific logic in SCI core |
| SIACP Envelope Builder | Create canonical task envelope and correlation metadata | Change SIACP semantics per provider |
| Provider Adapter | Translate SIACP to/from provider API; hold secrets server-side | Decide agricultural safety or farmer advice |
| Result Validator | Validate identity, schema, freshness and required fields | Trust raw provider text as authoritative |
| Evidence & Decision Layer | Track support, provenance, uncertainty, conflicts and safety flags | Claim laboratory/sensor verification without evidence |
| Farmer Response Composer | Produce concise localized guidance and follow-up questions | Expose raw internal specialist report by default |
| Audit/Feedback Store | Record request, selected model, statuses, result reference and farmer feedback | Store provider secrets or unnecessary personal data |

## 4. Canonical request contract (SCI API V1)

Endpoint: POST /functions/v1/sarina-central-intelligence

Authenticated request body:
- farm_id — required UUID.
- question — required non-empty string, bounded length.
- language — optional fa or en; defaults to farmer profile preference.
- references — optional list of user-supplied reference identifiers; never arbitrary trusted URLs or provider instructions.

The client must not send:
- provider/model selection as an authoritative instruction;
- weather or land context as trusted data;
- API keys, signing keys or internal routing policy;
- a request to execute physical farm actions.

Successful response shape:
- ok: true
- request_id
- status: completed | needs_input | escalated
- farmer_response: localized summary, recommended_next_step, unknowns, confidence_band, evidence_summary, optional follow_up_question
- safety: physical_action_authorized: false
- provenance_summary: compact source classes and retrieval timestamps

Recoverable non-success responses use ok: false, stable machine-readable code, and a safe localized message. Provider credentials, raw stack traces and internal prompts must never be returned.

## 5. SIACP task/result expectations

- SCI emits SIACP/1.1 TASK_REQUEST; the provider adapter is the only component allowed to translate to vendor-native request formats.
- message_id identifies a message; correlation_id binds request and result; nonce, timestamp and ttl_seconds support freshness/replay controls.
- recipients contains the selected registered adapter/model identity, not a client-provided value.
- body.task, body.question, body.inputs, body.required_output and body.constraints are mandatory.
- body.inputs contains farm_id, farm_weather_context, farm_land_context, user question and explicit provenance metadata.
- A result must match the request correlation and selected recipient, declare provider/model identity and result timestamp, and satisfy the requested output schema.
- Do not invent a SIACP result type or signing scheme. Before dispatch is enabled, reconcile the exact TASK_RESULT, signature and key lifecycle requirements against the authoritative SIACP specification. If signing is mandatory and not configured, fail closed.

## 6. Evidence, confidence and safety policy

Source classes must remain explicit:
- farmer_report — user-entered, not independently verified;
- laboratory_record — lab record with sample date and lab/method metadata;
- sensor_observation — actual instrument reading with timestamp and sensor identity where available;
- weather_provider_model_estimate — external weather model output;
- regional_model_prediction — regional spatial model (e.g. SoilGrids), not a farm test;
- specialist_model_analysis — model-generated interpretation, not a measurement.

Confidence bands are qualitative and must be justified by context completeness and evidence quality. A model's self-reported confidence alone cannot establish the band. Contradictory specialist outputs or weak evidence result in a qualified answer or escalation, not fabricated consensus.

V1 is advisory only. It cannot trigger irrigation, fertilizer dosing, pesticide use, machinery, worker instructions or any physical operation. Any future action plan requires farmer review and explicit confirmation, plus separate safety policy.

## 7. Failure states

Use stable statuses/codes for at least:
- AUTH_REQUIRED, FARM_ACCESS_DENIED, INVALID_REQUEST;
- FARM_CONTEXT_MISSING, FARM_CONTEXT_STALE, FARM_CONTEXT_MISMATCH;
- NO_ELIGIBLE_SPECIALIST, PROVIDER_UNAVAILABLE, PROVIDER_TIMEOUT;
- SIACP_VALIDATION_FAILED, RESULT_IDENTITY_MISMATCH, RESULT_SCHEMA_INVALID;
- INSUFFICIENT_EVIDENCE, SPECIALIST_CONFLICT, INTERNAL_ERROR.

Failures must not be converted into fabricated agricultural recommendations. Retryable/non-retryable classification should be recorded internally where appropriate.

## 8. Delivery plan

### Slice A — contract and deterministic validation
- Keep current farmer portal and farm context endpoints intact.
- Add the SCI request/response contract and lifecycle status model.
- Add deterministic tests for authentication, farm ownership, freshness, context matching, SIACP envelope validation and result validation.
- No provider call until the existing registry and SIACP result/signing contract are confirmed.

### Slice B — one specialist, server-side dispatch
- Resolve the first registered specialist from the existing registry.
- Implement one isolated provider adapter using a server-side secret.
- Invoke one model through SIACP; validate and persist the result.
- Exercise one real farm request end-to-end and capture timing, failure codes and output quality.

### Slice C — farmer response and feedback
- Display only the farmer-safe answer and minimal provenance/confidence.
- Allow farmer feedback: helpful / not helpful / outcome observed / still unresolved.
- Keep raw specialist output and diagnostics internal to SCI.

### Acceptance criteria for V1
1. A signed-in farmer cannot query another farmer's farm.
2. The server, not the browser, assembles the farm context.
3. Stale, missing or mismatched context prevents dispatch.
4. Exactly one eligible registered specialist is selected for the first live slice.
5. Request/result correlation and output schema are validated.
6. Provider errors and malformed output never become advice.
7. Farmer response distinguishes known facts, self-reports, model estimates and unknowns.
8. No physical action is authorized.
9. A real end-to-end request can be traced from farmer submission to validated response.

## 9. Current implementation facts and explicit gaps

- farm-weather-context and farm-land-context already provide farm-scoped context endpoints.
- sarina-siacp-bridge currently validates a SIACP/1.1 TASK_REQUEST and farm context, then returns HTTP 202 with model_invoked: false.
- Therefore the bridge is not yet a live AI dispatcher. This document does not claim otherwise.
- The existing provider/model registry must be inspected and reused; no replacement registry or schema migration is authorized by this design.
- Before Slice B, inspect the authoritative SIACP specification and the current registered provider/model record, then implement only the smallest compatible adapter.
- No database redesign, broad security audit or unrelated farmer-form expansion is part of this milestone.
