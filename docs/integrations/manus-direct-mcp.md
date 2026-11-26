# SARINA ↔ Manus direct MCP integration

**Status:** Deployed and previously connection-checked; research-draft write/read acceptance and automated SCI dispatch are not yet proven.
**First adapter:** Manus for the Market Intelligence specialist role.
**Authority:** SARINA Central Intelligence (SCI).

## Architecture and role

Manus is an external research execution adapter serving SARINA's `market_intelligence_specialist` capability. It is not a second command center, does not own the market domain, does not own canonical SARINA data, and cannot grant itself permissions.

SCI remains responsible for task intent, assignment policy, data scope, execution authorization, quality evaluation, result aggregation, and operational reporting. The farmer remains the final decision-maker for farm and commercial choices.

Manus connects directly to the SARINA Supabase Edge Function using Streamable HTTP MCP. Activepieces is not part of this route.

Production endpoint:

`https://wwgkiclcpgpdktneovrx.supabase.co/functions/v1/sarina-manus-mcp`

Manus authentication is a dedicated bearer token in the `Authorization` header. Never put the token in the URL, source code, GitHub, prompts, or chat messages.

## Current deployed capabilities

The deployed Edge Function exposes:
- `sarina_connection_check` — connection and private draft-store readiness check;
- `sarina_integration_capabilities` — read-only capability and permission description;
- `save_market_research_draft` — insert-only private draft submission;
- `list_market_research_drafts` — list drafts submitted through the integration;
- `get_market_research_draft` — retrieve one draft by ID.

The deployed function was observed as ACTIVE (version 1, platform JWT verification disabled because the function performs its own bearer-token authentication). A previous authenticated connection check returned `ok=true`, `database_connected=true`, and `draft_store_ready=true`. These are historical observations, not a live health assertion for every future moment.

## Permission boundary

Manus cannot:
- read farmer identities, farm records, private conversations, orders, payments, or the active product catalog;
- publish or edit active products;
- change prices or inventory;
- place orders, issue refunds, or make payments;
- contact buyers or companies;
- publish external content;
- change production configuration.

Market research is saved to `public.sarina_manus_market_research_drafts` with status `pending_review`. The table has RLS enabled and no client policies; only the Edge Function's server-side service role can access it. Draft submission is not publication, factual verification, or promotion to SARINA Agricultural Intelligence (SAI).

## Operational status semantics

Do not infer that Manus is currently ready merely because the Edge Function is deployed or because a previous connection check succeeded.

- `responding`: a recent authenticated MCP request was received.
- `ready`: a fresh heartbeat and capability/capacity report confirms availability for new work.
- `busy`: a known active mission is running.
- `degraded`: communication works but capability, quota, or reliability is limited.
- `offline`: the configured health window elapsed without a heartbeat.
- `unknown`: current evidence is insufficient.

A dedicated heartbeat/status tool and fleet dashboard are not yet implemented. Until then, the console must not display a fabricated green readiness state.

## First pilot mission

The first controlled research mission is:

- Title: `Assess Khuzestan Dates Export Readiness for the UAE`
- Manus task ID: `Eii9EWz735xAwtbPSDNrBh`
- Task URL: https://manus.im/app/Eii9EWz735xAwtbPSDNrBh

Do not create a duplicate mission or poll its status. When Manus completes, it should save exactly one private draft and retrieve that same draft ID if its tools permit. If it cannot complete the save/read round-trip, it must state that explicitly.

The first report is intentionally presented to the project owner for a one-time pilot evaluation. Evaluate source quality, regulatory applicability, coverage, evidence discipline, practical usefulness, and governance compliance. This one-time review does not establish a permanent requirement that a human read every agent mission.

## Current limitations

- The connection check has previously succeeded, but a real research-draft save/get round-trip has not yet been verified.
- The first mission's report quality and Manus performance have not yet been assessed.
- The current MCP flow is Manus → SARINA (tool calls and draft submission). A secure SCI → Manus mission-dispatch path has not yet been demonstrated.
- The SCI durable queue primitives exist, but a production worker does not yet consume them.
- The current specialist collaboration planner and aggregator still require human review; exception-based automated quality review is a target operating policy, not an active runtime feature.
- No provider heartbeat/capacity telemetry is yet available to support a truthful `ready` status.

## Required server secrets

Configure these only in Supabase Edge Function secrets:
- `SARINA_MANUS_ACCESS_TOKEN`: independently generated random secret, at least 32 characters.
- `SUPABASE_URL`: project URL (normally already available to Edge Functions).
- `SUPABASE_SERVICE_ROLE_KEY`: server-only service role key. Never expose it to Manus or browser clients.

The Manus token must be different from all Supabase API keys. Rotate it if exposed.

## Rollback

Disable or delete the Edge Function and revoke/rotate `SARINA_MANUS_ACCESS_TOKEN`. The private draft table is isolated and can remain in place for audit/history.


## SCI runtime heartbeat and mission linkage

The gateway now exposes `sarina_agent_heartbeat`. It accepts Manus-reported active task count, declared capacity, and the MCP capability names it can access. The gateway persists an authenticated heartbeat and append-only health event for the `manus_market_intelligence` runtime. The existing `sarina_connection_check` also records a capability/connection signal after the database draft store check succeeds.

SCI derives readiness from a fresh heartbeat and capability signal; stale heartbeats become offline and incomplete capability evidence remains responding/unknown. A heartbeat does not enable provider dispatch: `dispatch_enabled` remains false, and there is still no production queue worker or SCI-to-Manus dispatch path.

`save_market_research_draft` accepts an optional `external_task_id`. When it matches a mission already registered in SCI, the private draft is linked to that mission and the mission enters owner review. The existing Khuzestan dates → UAE task is recorded as an external mission link; no farmer, farm, or owner identity is fabricated. The owner console can also link a saved Manus draft explicitly.

The admin-only `sarina-agent-operations` Edge Function supplies the existing SCI admin console with fleet status, mission links, and private Manus drafts. It verifies the caller with `is_sarina_admin` before reading operational records. No provider secret or farmer data is returned.


## Deployment verification (2026-11-26)

- Supabase Edge Function `sarina-manus-mcp`: ACTIVE version 2; custom bearer authentication remains enabled.
- Supabase Edge Function `sarina-agent-operations`: ACTIVE version 1; JWT verification enabled and admin authorization checked in the handler.
- Database migration version `20261126102437` is applied. Runtime and health-event tables are service-role-only; no direct anon/authenticated table privileges are granted.
- The production frontend deployment for the SCI console is READY on commit `2b2fd1c5cdfdfe039441cb8f052d4415c0a6797f`.
- At verification time the runtime registry contained no heartbeat rows and the Manus draft store contained no reports. No agent is therefore labelled ready, and the first mission remains linked but awaiting a saved report.
