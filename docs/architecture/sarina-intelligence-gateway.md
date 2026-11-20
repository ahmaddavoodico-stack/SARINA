# SARINA Intelligence Gateway (SIG)

Status: architecture proposal for review; provider dispatch is disabled by default. This document defines the provider-neutral design and a low-cost evaluation path. It does not add runtime code, credentials, billing, or production integrations.

## Decision

Establish **SARINA Intelligence Gateway (SIG)** as an independent, provider-neutral service layer between SARINA's domain orchestration and external or self-hosted AI models.

SIG is an execution and evaluation gateway, not the source of agricultural truth and not a policy authority.

## Responsibilities and boundaries

- **SCI (SARINA Core Intelligence):** owns the agricultural task, policy, consent and data scope, eligibility rules, workflow state, and final SARINA decision. SCI decides whether a model call is allowed and what evidence may be shared.
- **SIG:** selects an approved provider/model, builds a versioned request from SCI-approved data, dispatches through a provider adapter, validates and normalizes the response, records provenance/usage/latency, and returns evidence-linked results to SCI.
- **Provider adapters:** translate the stable SIG contract to a provider's API. Adapters must be replaceable and must not contain agricultural policy.
- **Specialist workflow:** verified specialists remain responsible for professional review when the case or policy requires it. Model consensus never replaces specialist review.
- **Infrastructure Bridge:** remains exclusively for controlled SARINA infrastructure operations. It must not be used as the model-routing layer.
- **SIACP:** remains a communication/task protocol; it is not the SIG provider API.

## Logical flow

```text
Farmer / Specialist / Farm Core Record
                 |
                 v
       SCI: policy + consent + scope
                 |
          approved task packet
                 v
       SIG: routing + evaluation
          /       |        \
         v        v         v
     Provider A Provider B Local model
         \        |         /
          normalized, versioned results
                 |
                 v
       SIG: validation + comparison
                 |
                 v
       SCI: evidence-based decision
                 |
        specialist review if required
                 |
                 v
       Farmer-facing recommendation
```

## Stable request contract

Each model request should carry:
- `request_id`, `case_id`, `farm_id` (opaque identifiers; omit farmer identity unless strictly necessary);
- `task_type` and a versioned task schema;
- `instruction_version`, `evaluation_rubric_version`, and `dataset_version`;
- the minimum SCI-approved observations, measurements, images, and source references;
- output schema, language, deadline, and token/compute budget;
- consent/scope reference and data classification;
- idempotency key and correlation ID.

The provider response envelope should preserve:
- provider and model identifier, model/version when available;
- request and response timestamps, latency, usage/cost metadata when available;
- raw provider response reference (securely retained according to policy), normalized output, and schema-validation status;
- citations/evidence supplied by the model, clearly distinguished from independently verified sources;
- uncertainty, missing information, limitations, and refusal/error state.

Never silently discard malformed output. Mark it invalid and route it through bounded retry/fallback policy.

## Provider-neutral adapter interface

An adapter should implement a narrow interface equivalent to:
- `capabilities()`: modalities, structured output, context limits, region/data controls;
- `health()`: availability and configured quota status without exposing credentials;
- `invoke(request)`: one bounded inference call;
- `normalize(response)`: map provider output into the SIG response envelope;
- `usage(response)`: usage and cost metadata where available.

Provider-specific SDKs, model IDs, and secrets stay inside server-side adapters. The browser and farmer app must never receive provider API keys.

Initial provider classes:
1. Hosted commercial APIs (enabled only when configured and approved).
2. Hosted free-tier APIs for development/evaluation only, subject to their current terms, quotas, region availability, and data-use conditions.
3. Self-hosted open-weight models, where compute and operational costs are budgeted separately.

No provider is mandatory. If one provider is unavailable or its free quota is exhausted, SIG must report that fact and follow an explicit fallback policy; it must not silently switch to an unapproved provider.

## Evaluation and adjudication

The first benchmark should be a bounded, real agricultural task such as **date-palm condition assessment** using a controlled case packet:
- one or more farm/palm photographs;
- known soil and irrigation facts;
- symptoms and dated observations;
- recent operations and relevant history;
- explicit unknowns and image limitations.

Run at least two independent models on the same frozen input packet and instruction version. Randomize/blind model labels during evaluation where practical. Then have a separate evaluator produce a comparison. The evaluator may be another model (including an OpenAI model) or a human specialist; its role is to assess evidence and reasoning, not to declare itself infallible.

The adjudication rubric should score:
- agreement with observed facts and image evidence;
- whether claims are traceable to supplied evidence or reliable references;
- detection of missing/contradictory data;
- calibration of uncertainty and appropriate abstention;
- safety of proposed actions and whether specialist escalation is required;
- schema validity, clarity, and usefulness.

Do not use majority vote as truth. Correlated models can repeat the same error. A disagreement should be surfaced with the competing claims, evidence, uncertainty, and a request for more data or specialist review.

## Free-first test strategy

The initial objective is **zero or near-zero API spend for a small, non-production experiment**, not a promise of permanently unlimited free service.

- Start with provider APIs that explicitly publish a free developer tier for selected models. Google's Gemini API pricing page currently documents a free tier for selected models, with model and quota restrictions; confirm the exact model's current limits in the provider console before each test.
- Other providers may offer free developer/testing quotas, but eligibility, model availability, rate limits, data use, and geographic access change. Treat each provider's official pricing and terms as authoritative; do not hard-code quota assumptions.
- Do not assume a consumer ChatGPT/Claude/Gemini app subscription includes API access. Consumer UI access and developer API access are separate products and may have separate billing.
- OpenAI API calls must remain disabled until a valid API project/credential and an approved spend/credit policy exist. A ChatGPT subscription alone must not be treated as API authorization or free API credit.
- A self-hosted open-weight model can avoid per-token provider charges, but is not cost-free: server/GPU capacity, electricity, maintenance, storage, and monitoring still cost money.
- Cache deterministic test requests, cap calls per case/day, limit image resolution and context size appropriately, and record usage. Do not retry quota/billing failures indefinitely.
- Never create multiple accounts or rotate identities to evade provider quotas or terms.

### Data protection for free-tier providers

Free tiers may have different data-use terms from paid tiers. Before sending a case:
- use synthetic or explicitly approved, de-identified test records;
- remove names, phone numbers, precise coordinates, account identifiers, and unrelated personal details;
- do not send private farmer records, commercially sensitive data, or identifiable images unless the provider's terms, consent, and SARINA policy explicitly permit it;
- record provider, tier, region, applicable data-use setting, and consent basis for each evaluation run;
- stop dispatch if the data-use terms or region eligibility cannot be confirmed.

## Routing policy

Routing must be explicit and deterministic for each test:
- `primary`: selected provider/model;
- `secondary`: independent comparison provider/model;
- `judge`: optional evaluator, isolated from the primary answers when possible;
- `fallback`: only a pre-approved provider/model;
- `disabled`: no external dispatch.

The routing decision, model allowlist, data classification, and budget are controlled by SCI policy. SIG cannot expand scope or override consent.

## Reliability, security, and observability

- Store credentials only in a server-side secret manager; redact them from logs and errors.
- Enforce per-provider allowlists, timeouts, bounded retries, rate limits, concurrency limits, and hard budget caps.
- Validate provider response schemas and sanitize untrusted model output before rendering or tool use.
- Treat provider output, retrieved documents, and image-embedded text as untrusted data, never as executable instructions.
- Keep prompt/instruction templates versioned and reviewed. Do not allow model output to alter policy, routing, permissions, or its own system instructions.
- Record audit metadata: actor/service, case, task, provider/model, instruction/schema versions, consent scope, timestamps, status, latency, usage/cost, and artifact hashes. Avoid retaining unnecessary raw personal data.
- Separate test, staging, and production credentials and quotas. Production dispatch is off by default.

## Phased delivery

### Phase 0 — architecture and policy
- Document SIG boundaries, contracts, evaluation rubric, free-first constraints, and privacy gates.
- No runtime dispatch or credentials.

### Phase 1 — deterministic mock adapter
- Implement request/response types, mock provider, schema validation, routing policy tests, audit metadata, and replayable fixtures.
- Verify no network calls occur when provider dispatch is disabled.

### Phase 2 — controlled free-tier experiment
- Enable one approved free-tier provider in an isolated test environment using synthetic/de-identified cases.
- Add a second provider only after the first adapter, quota handling, data controls, and repeatability tests pass.
- Run the frozen date-palm benchmark and preserve outputs for comparison.

### Phase 3 — adjudication and specialist validation
- Add blind comparison and rubric scoring.
- Compare model claims against known observations and a verified specialist's assessment.
- Publish limitations and disagreement cases; do not auto-issue high-impact treatment recommendations.

### Phase 4 — governed production use
- Requires security/privacy review, provider terms review, specialist escalation policy, operational monitoring, explicit owner approval, and separate budget approval.
- Production provider dispatch remains disabled until these gates are met.

## Acceptance criteria

- SCI alone authorizes task scope, consent, provider allowlist, and budget.
- SIG is provider-neutral and adapters are replaceable.
- No provider secret reaches browser/client code, Git, or logs.
- Disabled mode makes zero provider network calls.
- Every dispatched request is traceable to case, consent, task schema, instruction version, provider/model, and usage record.
- Free-tier quota exhaustion and provider outages are handled without unapproved fallback or runaway retries.
- Free-tier data-use restrictions are enforced; identifiable/private farmer data is not sent by default.
- Outputs include uncertainty and missing-data indicators and are never treated as ground truth.
- Model disagreement and low confidence trigger more evidence or specialist review.
- No production recommendation or provider dispatch is enabled by this architecture-only change.

## Initial test recommendation

Use two providers at most for the first date-palm case. Prefer a free-tier multimodal API for image + text input, and a second provider only if its current free quota and data terms are suitable. Keep the adjudicator separate from the two initial answers when practical; otherwise use a blinded rubric-based comparison and human specialist review. The first success metric is reproducibility and evidence quality, not the number of models connected.
