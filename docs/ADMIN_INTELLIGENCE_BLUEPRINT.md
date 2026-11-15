# SARINA Intelligent Administration Tool — Design Blueprint

**Status:** Design baseline, implementation-ready in stages  
**Repository branch:** `feature/farmer-portal-foundation`  
**Scope:** Administrator-only operational visibility and decision support  
**Non-goals for this phase:** database redesign, public admin registration, broad security remediation, automatic destructive actions.

## Product principle

The management tool must help the authorized operator answer four questions quickly:

1. Is SARINA operating normally?
2. Which subsystem needs attention, and what evidence supports that conclusion?
3. What is the likely impact on farmers, farms, experts, or marketplace workflows?
4. What is the safest next action, and who must approve it?

The interface should show concise operational conclusions. Detailed diagnostics remain available to the internal SARINA central intelligence layer and technical operators.

## Five implementation steps

### 1. Command center and metric definitions

Build a single overview with clear states: **Healthy**, **Attention**, **Degraded**, **Unavailable**, and **Unknown**. Unknown must never be presented as healthy.

Initial metric groups:
- Platform adoption: registered accounts, active accounts, farms, and new registrations by period.
- Farm data readiness: farms with location, fields, crop cycles, soil/water tests, and recent observations.
- Human support: pending expert applications, open expert requests, assignment delays, and unresolved cases.
- Marketplace operations: active sellers/products, pending verification, orders by status, and quote requests.
- AI operations: provider/model availability, analysis runs, success/failure rate, latency, and feedback.
- Infrastructure: database/API reachability, edge-function failures, deployment status, and stale data feeds.

Every metric must include source, calculation window, last-updated timestamp, and confidence/coverage. Do not fabricate missing values.

### 2. Secure administrative data gateway

Use one server-side administrative gateway (initially a Supabase Edge Function) rather than querying platform-wide records from browser code.

Contract:
- Input: authenticated session JWT and a narrowly defined dashboard request.
- Authorization: validate the user JWT, resolve the SARINA profile, and verify the manually granted global `admin` role for that profile on every request.
- Data access: use explicit allow-listed queries and return aggregated/minimized results only.
- Output: versioned JSON with `generated_at`, `window`, `metrics`, `data_quality`, and `source_status`.
- Denial: return 401 for missing/invalid session and 403 for non-admin users.
- Never expose service-role credentials, raw user records, private farm coordinates, message bodies, payment payloads, or provider secrets to the browser.

The existing `users`, `user_roles`, and `roles` model is sufficient for the first authorization check. Ordinary role self-selection must continue to exclude `admin`.

### 3. Events, audit trail, and alert pipeline

Define a common event envelope before adding collectors:
- `event_id`, `occurred_at`, `source`, `component`, `event_type`
- `severity` (info/warning/error/critical)
- `correlation_id`, `duration_ms`, `status`
- `safe_summary`, `details_ref`, `environment`

Collect operational events from application errors, Edge Functions, AI analysis runs, integration sync jobs, and marketplace workflows. Store references to detailed diagnostics rather than copying sensitive payloads into the admin dashboard.

Alerts should be deduplicated, time-bounded, and actionable. A warning should include impact, evidence, first-seen time, and a suggested next check.

### 4. Specialist AI and central intelligence monitoring

Track each specialist integration independently:
- provider/model identifier and capability
- configured / enabled / reachable state
- last successful request and last failure
- request count, error rate, latency, and token usage when available
- timeout/rate-limit/provider-error categories
- schema/protocol validation and SIACP compatibility outcomes

Track the central orchestrator separately:
- request received → context assembled → specialist selected → response validated → final answer produced
- missing specialist, timeout, invalid response, low confidence, safety flag, and human-review escalation counts

Do not mark a model healthy merely because its configuration row exists. A recent successful health check or real request is required.

### 5. Management intelligence and controlled actions

Generate recommendations from observed evidence, not from unsupported model guesses. Each recommendation must contain:
- problem statement and affected subsystem
- evidence and time window
- impact level and confidence
- recommended next action
- whether human approval is required
- expected result and a way to verify completion

Phase-one recommendations are advisory only. No automatic role changes, user suspension, financial actions, database mutations, or deployments. Every approved administrative action must create an auditable record.

## Existing database mapping (read-only design)

| Management area | Existing candidate sources |
|---|---|
| Accounts and access | `users`, `roles`, `user_roles` |
| Farms and readiness | `farms`, `farm_fields`, `farm_locations`, `crop_cycles`, `soil_tests`, `water_tests`, `farm_observations` |
| Experts and support | `expert_profiles`, `expert_credentials`, `expert_requests`, `expert_request_assignments`, `expert_request_reports` |
| Marketplace | `marketplace_sellers`, `marketplace_products`, `marketplace_orders`, `marketplace_quote_requests` |
| AI and SIACP | `ai_providers`, `ai_models`, `ai_analysis_runs`, `ai_messages`, `siacp_key_registry` |
| External integrations | `integration_connections`, `integration_sync_jobs`, `integration_logs`, `communication_logs` |

These are candidate sources only; actual availability and safe aggregation must be verified before each metric is exposed.

## Important implementation constraints

- Keep the existing schema as-is until a concrete missing requirement is demonstrated.
- Do not add broad client-side SELECT access to operational tables.
- The current database advisor reports 25 RLS-enabled tables without policies and one public table with RLS disabled. Treat this as a known access-control review item; do not bypass it to make the dashboard work.
- The current global role self-read policy is scoped to the signed-in user's own SARINA profile. The frontend role check must additionally filter by the resolved profile ID.
- No production health, deployment, or AI availability claim is valid until a live source has been connected and tested.
- Keep Persian and English support, mobile/tablet responsiveness, and concise operator-facing language.

## Delivery sequence and acceptance criteria

1. **Overview UI:** the five stages and metric categories are visible; missing sources are explicitly marked pending.
2. **Admin gateway:** a real admin can call it; a normal authenticated user receives 403; unauthenticated callers receive 401.
3. **First read-only metrics:** counts/aggregates reconcile against controlled database queries; no personal records leak.
4. **Event monitoring:** a test warning/error appears with severity, source, timestamp, and correlation reference.
5. **Recommendation loop:** a recommendation cites evidence, requires approval where appropriate, and can be marked resolved with an audit record.

A step is complete only after its acceptance test passes. A committed file or successful build alone is not proof of runtime correctness.
