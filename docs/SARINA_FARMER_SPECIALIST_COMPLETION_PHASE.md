# SARINA Farmer & Specialist Completion Phase

**Branch:** `feature/farmer-specialist-completion-phase`  
**Base:** `main`  
**Purpose:** finish the farmer and verified-specialist workflows without duplicating the existing productivity, case-assistant, availability, or communications foundations.

## Release rule

This is a staged completion program, not a claim that the farmer/specialist modules are already production-complete. No production secrets, model provider, signing key, or external messaging credential may be invented or committed. Do not merge or deploy a live model path until the security, privacy, provider, and acceptance gates below pass.

## Workstream 1 — SIACP and ChatGPT adapter

### Existing state
- `sarina-central-intelligence` authenticates the caller and verifies farm access through caller-JWT/RLS.
- `sarina-siacp-bridge` validates the SIACP/1.1 envelope and farm weather/land context, then deliberately stops before model invocation, signing, persistence, or physical execution.
- The shared SCI contract validates request, context, task-envelope, and result structure. Signature verification and RFC 8785 canonicalization are explicitly not implemented in the current contract validator.

### Required implementation
1. Keep SCI as the only orchestration authority; adapters must not choose farms, roles, permissions, or policy.
2. Define a provider-neutral adapter interface and registry. Provider/model IDs must come from server-side allowlisted configuration, never farmer input.
3. Add ChatGPT as one adapter behind that interface; keep the provider secret server-side and support disabling/replacing the adapter without changing farmer or specialist workflows.
4. Before dispatch, verify canonicalization and SIACP signatures against published/approved test vectors; enforce TTL, nonce replay protection, sender/recipient allowlists, correlation binding, and bounded payload sizes.
5. Validate every adapter result against the expected correlation ID, recipient, schema, and provenance. Treat provider output as untrusted content.
6. Fail closed on missing secrets, unknown adapter, invalid signature, timeout, rate limit, malformed response, or context mismatch. Never convert a model response into a physical-action command.

### Not yet release-ready
No provider API secret or registered signing key was supplied in this work session. Therefore no live ChatGPT call, signed production dispatch, or result persistence is enabled by this branch.

## Workstream 2 — authenticated farm context assembly

- Reuse `farm-land-context` and `farm-weather-context`; do not recreate their data model.
- Fetch both using the caller's JWT so the existing farm ownership/RLS boundary remains in force.
- Validate exact farm ID, freshness, coordinate bounds, required source/provenance fields, and missing-data safety before any adapter dispatch.
- Preserve farmer reports, laboratory records, official sources, and regional/model estimates as distinct evidence classes.
- A regional estimate must never be represented as a farm-level lab measurement.
- Context assembly should return a traceable request manifest: source, retrieved_at, farm ID, schema version, omitted/missing domains, and evidence references. Avoid copying unnecessary personal data into provider prompts.

## Workstream 3 — evidence-based specialist preparation

- Load the farmer's existing farm record, field/crop-cycle scope, soil and water tests, observations, weather, productivity baseline, measurements, and prior actions only when the caller is authorized for that case/farm.
- Produce a structured draft: known facts, farmer-reported statements, verified measurements, model estimates, missing information, possible explanations, risk flags, follow-up questions, and source references.
- Display uncertainty and limitations. Do not issue diagnosis or treatment as a final expert decision.
- Keep the specialist responsible for assessment and final recommendations; preserve review/edit/override and audit history.
- Do not expose one farmer's records to another farmer or an unassigned/unverified specialist.

## Workstream 4 — comparable regional benchmarking

- Use the existing `regional_data_sources`, `regional_datasets`, and `farm_productivity_benchmarks` structures.
- Seed only datasets with traceable source, license, effective period, geography/resolution, sample size, statistic type, crop/system/season context, unit, quality, and uncertainty.
- Compare only sufficiently similar crop, production system, season, soil, water, climate, scale, and management contexts.
- If no credible comparable benchmark exists, say so; do not fabricate peer ranks or interpolate unsupported values.
- Current productivity documentation reports zero published benchmark records; comparisons remain unavailable until curated references are approved.

## Workstream 5 — real-data and authorization testing

### Automated checks added in this phase
- Deno unit tests for SCI request validation, freshness, farm-context scope, SIACP task validation, and result correlation/recipient binding.
- A dedicated GitHub Actions workflow runs those contract tests on relevant pull requests and main-branch changes.

### Required integration/security tests before release
- Farmer A cannot read or mutate Farmer B's farms, context, measurements, plans, or case attachments.
- An unverified specialist cannot access the verified-specialist workspace or case data.
- A verified specialist can access only assigned/authorized cases and supervised farms.
- An administrator can review only through the documented admin capability and audit path.
- Expired/stale context, wrong-farm context, invalid JWT, invalid SIACP signature, replayed nonce, unknown adapter, and malformed result all fail closed.
- Provider timeout/rate limit and duplicate delivery do not create duplicate case records, recommendations, or actions.
- Case handover requires farmer consent and replacement-specialist acceptance; rejected/expired handover leaves original ownership intact.
- Use isolated test identities and synthetic farms. Do not use or mutate production farmer data for tests.

## Workstream 6 — farmer and specialist end-to-end acceptance

### Farmer
- Create/edit a farm and multiple fields; permission-based GPS and manual map placement both work.
- Capture baseline and follow-up measurements with units, dates, provenance, and quality.
- Create an improvement plan and actions; track completion and evidence.
- See only published, context-compatible benchmarks; otherwise see an explicit unavailable state.
- Submit a case with images/observations and see its lifecycle, missing-information requests, and specialist response.
- Review any AI-generated preparation as a draft with sources, uncertainty, and clear human-review status.

### Verified specialist
- Complete verification before specialist-only tools become available.
- See only assigned cases and contracted/supervised farms.
- Review farm context and AI-prepared evidence without losing provenance.
- Record missing information, initial review, final expert assessment, and follow-up plan.
- Configure availability, capacity, leave, and handover; verify consent and acceptance gates.
- Monitor farm productivity trends and overdue actions without seeing unauthorized records.

### Release evidence
Record the commit, CI run, preview URL, test identity/role, scenario, expected result, actual result, and any issue for every acceptance test. A successful frontend build alone is not an end-to-end release sign-off.

## Current completion assessment

| Workstream | Current state |
|---|---|
| SIACP/provider adapter | Transport/schema foundations exist; signing, replay defense, adapter dispatch, and provider call remain |
| Context assembly | Separate authenticated land/weather functions exist; SCI orchestration and integrated tests remain |
| Specialist AI preparation | Case assistant data-entry workflow exists; evidence-grounded AI drafting remains |
| Regional benchmarks | Storage and governance exist; curated published reference data remain |
| Security/integration tests | Contract tests are added here; RLS and role-isolation tests remain |
| End-to-end acceptance | Test plan defined; real device and authorized test-user execution remains |

## Safety and data governance

- No automatic diagnosis, pesticide/fertilizer dosage, irrigation actuation, payment, or physical operation from model output.
- No model/provider receives a farm record unless the user is authenticated, farm/case access is verified, and the minimum necessary context is assembled.
- Model output is a draft; a qualified specialist remains accountable for specialist decisions.
- Keep provider secrets and signing keys in server-side secret storage only.
- Log correlation IDs, adapter version, prompt/template version, source manifest, model/provider metadata, and review outcome; do not log secrets or unnecessary personal data.
- Keep production migration history and data untouched during this completion phase.
