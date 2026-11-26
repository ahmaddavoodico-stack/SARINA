# SARINA Assistant Core and Executive Home

## Purpose

Create one trusted assistant core with role-specific experiences:

- **Farmer companion:** farm-scoped agricultural help, grounded in the farmer's own farm records and clearly labelled external, laboratory, modelled and farmer-reported data.
- **Expert office secretary:** expert-owned case queue, priority and waiting-time awareness, reminders, case summaries and navigation. It must never expose another expert's cases.
- **Executive Home:** organization-wide operational overview, management priorities and evidence-backed summaries. It must not expose private farmer or expert conversations by default.

The shared core owns authentication, request validation, context authorization, audit, routing, cost controls and safety boundaries. Each role surface supplies only the context that its authenticated user is permitted to see.

## Current verified baseline

- Supabase project has `ai_conversations`, `ai_messages`, `ai_analysis_runs`, provider/model configuration, usage and credit-ledger tables.
- The AI conversation/message tables have RLS enabled and currently no direct client policies. Keep them server-managed; do not solve this by opening broad browser access.
- The deployed `sarina-central-intelligence` Edge Function currently validates a bearer session, resolves farm access under the caller's RLS context and returns `202 accepted_for_validation`.
- That deployed slice explicitly does **not** invoke a model, persist a conversation, sign a SIACP result, or authorize physical actions.
- Current database configuration reports the OpenAI provider and configured GPT model as inactive. No model call should be enabled until credentials, routing policy, provider pricing, safety tests and operational limits are explicitly configured.
- `sarina-siacp-bridge` is a validation-only transport bridge. It is not a model runner.

## Request and trust boundaries

1. The browser sends the Supabase user session JWT through `supabase.functions.invoke`.
2. The Edge Function verifies the user and resolves the internal SARINA user ID through trusted server-side identity mapping.
3. Authorization comes from database-owned role and relationship records, never editable user metadata.
4. Farmer requests must prove ownership/access to the requested farm under the caller's authorization context.
5. Expert requests must resolve the authenticated expert profile and only that expert's assignments, notifications and permitted case context.
6. Executive requests must pass the central-admin authorization gate and use aggregate or explicitly approved operational data.
7. Conversation and message persistence, provider credentials, model selection, usage accounting and cost ledgers remain server-side.
8. Any future model response must carry provenance, limitations and confidence appropriate to the evidence. A validation receipt is never presented as an AI answer.

## Implementation sequence

### Slice 1 — contract and role surfaces
- Typed browser boundary for the existing farm validation endpoint.
- Keep role-specific UI surfaces separate while reusing the same SARINA character and shared orchestration concepts.
- Replace the current admin landing page with SARINA Executive Home: operational metrics, attention queue, quick navigation and recent activity.

### Slice 2 — durable conversation service
- Add server-side create/list/send operations for `ai_conversations` and `ai_messages`.
- Keep RLS restrictive and use an authenticated Edge Function with explicit ownership checks before privileged writes.
- Add idempotency, rate limits, safe error states and audit references.
- Do not persist raw provider secrets or duplicate channel-message bodies.

### Slice 3 — provider and routing activation
- Configure provider credentials through Supabase secrets, not source code or browser variables.
- Activate a model only after checking provider availability, current pricing, budgets, fallback behavior and safety evaluations.
- Record per-request usage and provider costs separately from farmer-facing credits.
- Fail closed when no eligible model or safe route is available.

### Slice 4 — role-specific context adapters
- Farmer: selected farm, weather and land context, crop cycle, tests, observations and approved documents.
- Expert: assigned case, case timeline, consented attachments and expert-only notes.
- Executive: organization-wide counts, queue health, response times, unresolved risks and cost/usage summaries with privacy-preserving aggregation.

### Slice 5 — multimodal and channel expansion
- Add file, image, audio and video processing through explicit consent and safe storage references.
- Connect messaging channels through SARINA Connect adapters; keep transport independent from assistant business logic.

## This branch

This branch adds the typed farmer validation client and the first SARINA Executive Home interface. It does not change production database policies, activate providers, deploy Edge Functions, or claim that AI chat is live.
