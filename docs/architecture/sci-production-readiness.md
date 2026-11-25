# SCI Production Readiness Architecture

**Status:** Approved implementation direction; staged delivery in progress.  
**Scope:** Prepare SARINA's core intelligence execution platform before farmer-facing production launch.  
**Safety boundary:** This architecture document does not itself authorize production database migrations, Edge Function deployment, secret changes, paid model calls, external messages, payments, or physical actions.

## Goals and approved stages

1. Stabilize deterministic routing and the simulated-dispatch baseline.
2. Add durable task persistence, idempotent intake, and a persistent queue.
3. Add an isolated worker runtime and real specialist-agent execution behind policy gates.
4. Add operational control, audit, health, pause/resume, retry, cancellation, and emergency stop.
5. Prepare deployment, security, backups, recovery, monitoring, and capacity controls.
6. Run end-to-end failure, concurrency, recovery, security, and acceptance tests before production enablement.

## Architecture decisions

### SCI owns task truth

- SCI remains the authority for intent routing, task policy, permissions, risk, consent, approval requirements, and final response lifecycle.
- Agent definitions describe responsibilities and capabilities; they do not imply that an agent is executable or enabled.
- Models are replaceable tools behind provider adapters. No agent is coupled to a paid provider.
- The deterministic first routing pass remains model-free.

### Durable task state

Use a dedicated internal schema for execution state, separate from farmer-facing domain tables.

Initial persistence model:

- `sci_tasks`: canonical task envelope, verified principal and farm scope, idempotency key, request fingerprint, assigned agent, priority, risk, lifecycle status, deadline, retry policy, attempt count, lease metadata, result reference, and timestamps.
- `sci_task_events`: append-only lifecycle and policy audit events. Runtime workers cannot update or delete events.
- `sci_task_approvals`: explicit human approval records bound to an authenticated actor, task, action, and confirmation reference.
- `sci_task_effects`: idempotency ledger for future external/domain effects, with a unique effect key and recorded outcome.

Minimize payload storage. Prefer references to existing conversation/message/document records. Any retained task payload needs explicit classification, bounded size, access controls, and retention policy.

Idempotency must be enforced by a database uniqueness constraint scoped to the authenticated principal and request key, not by an in-memory map. Reusing the same key with a different request fingerprint must return a conflict.

### Persistent queue transport

Use Supabase's Postgres-native PGMQ as the first queue candidate, subject to migration and integration tests.

- The project is PostgreSQL 17 and currently has `pg_cron` installed.
- PGMQ is available in the project's extension catalog but is not currently installed.
- Use a logged/durable queue only; never use an unlogged queue for work that must survive a crash.
- Queue messages should contain opaque task identifiers and schema versions, not full farmer records or credentials.
- Enqueue the task and queue message in one database transaction.
- Use visibility timeouts, bounded batch sizes, lease renewal, bounded retries, and a dead-letter/archival path.
- Treat delivery as at-least-once at the business-effect boundary. Consumers and effect handlers must be idempotent; a queue visibility timeout alone does not prove that an external side effect happened exactly once.
- Archive completed/terminal messages according to retention policy. Do not use destructive pop semantics for recoverable work.

PGMQ is transport; `sci_tasks` remains the canonical task state.

### Worker runtime

Use an isolated, containerizable Deno worker service for sustained task execution. Keep request intake in the existing authenticated SCI Edge Function.

- Workers claim tasks through a narrow database interface and receive short-lived leases.
- A worker may execute only an enabled agent with a registered capability set.
- Workers never receive unrestricted SQL access or direct credentials for third-party services.
- Domain access is mediated by typed, least-privilege internal tools.
- Model calls remain disabled by default and are available only through explicit server-side provider allowlists, policy approval, quotas, and budget gates.
- Workers support graceful shutdown, lease renewal, bounded execution time, cancellation checks, and safe restart/recovery.
- Human-review and clarification tasks must never be auto-completed by a generic worker.

### Security and data boundaries

- Keep execution tables in a non-exposed internal schema where practical.
- Revoke direct access from `anon` and `authenticated`; grant only the minimum server-side role access required.
- Do not expose service-role credentials to browsers, model providers, agents, or logs.
- Validate caller JWT and farm access before task intake. Persist the verified principal and scope for worker authorization.
- Do not trust user-editable JWT metadata for authorization.
- Treat model output, documents, retrieved text, and image-embedded instructions as untrusted data.
- Require explicit human confirmation for orders, payments, outbound messages, account changes, deletions, and consequential operations.
- High-consequence agronomic recommendations and physical operations remain subject to specialist/human review.

### Operational control

Provide an internal control surface and auditable controls for:

- queue depth, oldest-message age, throughput, latency, retry rate, and dead-letter count;
- worker health, concurrency, lease expiry, heartbeat, memory, CPU, and restart counts;
- task search by opaque task/correlation ID, status history, and redacted error details;
- pause/resume per agent and queue, bounded retry, cancellation, and manual replay;
- global emergency stop that prevents new claims and external effects while preserving queued records;
- model/provider allowlists, per-provider concurrency, timeouts, quotas, and spend caps;
- immutable audit events for operator actions and human approvals.

No operational control may silently bypass the SCI policy engine or a required human approval.

### Deployment and recovery

Prepare separate development, staging, and production configurations.

- Version all database migrations and worker/runtime contracts.
- Keep secrets outside Git and task payloads.
- Configure health checks, structured redacted logs, metrics, alert thresholds, and deployment rollback.
- Define database backup retention and test restore procedures before production.
- Test recovery after worker crash, process restart, database connection loss, expired lease, queue redelivery, and deployment rollback.
- Capacity-test expected concurrency and queue growth before launch; define scaling thresholds and resource limits.

## Verified project observations

- Supabase project status is `ACTIVE_HEALTHY`; database engine is PostgreSQL 17.
- The existing public schema contains 168 tables. New SCI execution state must not collide with farmer, marketplace, specialist, or messaging tables.
- Existing queue/outbox patterns include `regional_sync_outbox`, `sarina_connect_delivery_jobs`, and `activepieces_automation_inbox`. They are design references, not automatically the SCI task store.
- `pg_cron` is installed. PGMQ is available but not installed.
- Existing server-managed table patterns enable RLS and deny direct `anon`/`authenticated` access.

## PR #149 baseline caveat

The current simulated-dispatch PR is not a production task engine:

- It creates a new in-memory task manager for each request.
- The endpoint generates a new request ID server-side, so client retries cannot reuse an idempotency key.
- Task state and events disappear when the invocation ends.
- The simulated worker creates only a synthetic result; it does not invoke any registered domain agent.
- At the last review, GitHub Actions contract tests and frontend/PWA builds were green. Vercel reported a deployment rate-limit failure, and the Cloudflare Worker build check reported failure. The Cloudflare failure reason was not available in GitHub's check output and must not be guessed.
- Do not describe PR #149 as durable, production-ready, or a real agent runtime. Resolve or supersede this baseline through tested changes before production enablement.

## Acceptance gates

### Stage 1 — simulated baseline
- [ ] Verify request validation, deterministic routing, permitted state transitions, and safe human-review holds.
- [ ] Add tests for duplicate-intake semantics and document that in-memory deduplication is not cross-request persistence.
- [ ] Explain the Cloudflare check failure from authoritative build logs or replace the affected build integration with a verified check.
- [ ] Keep paid provider dispatch, external side effects, and production deployment disabled.

### Stage 2 — persistence and queue
- [ ] Add versioned migration(s) for the internal task schema and PGMQ queue.
- [ ] Add transactional task intake and durable idempotency.
- [ ] Add atomic claim/lease/heartbeat/acknowledge/retry/dead-letter operations.
- [ ] Add database tests for concurrent claims, duplicate keys, rollback atomicity, visibility timeout, and recovery.
- [ ] Verify RLS, grants, schema exposure, and Supabase security/performance advisors.

### Stage 3 — agent runtime
- [ ] Implement worker runtime and typed capability registry.
- [ ] Add one simulated worker adapter, then enable one low-risk real agent only after its tests and policy are approved.
- [ ] Keep high-consequence, ambiguous, and specialist-handoff tasks in human review.
- [ ] Prove provider-off mode makes zero model/provider calls.

### Stage 4 — operations
- [ ] Add metrics, health checks, alerting, audit, emergency stop, pause/resume, cancellation, and operator authorization.
- [ ] Verify every operator action is recorded and cannot bypass approval gates.

### Stage 5 — deployment readiness
- [ ] Prepare container/deployment manifests and environment separation.
- [ ] Verify secrets, backups, restore, monitoring, resource limits, and rollback.
- [ ] Do not provision new paid infrastructure without a separate cost review and approval.

### Stage 6 — acceptance
- [ ] Pass concurrency, restart, crash, duplicate, retry, cancellation, timeout, and data-isolation tests.
- [ ] Run an end-to-end test from authenticated request to worker result and farmer-facing response.
- [ ] Obtain explicit go-live acceptance only after all required gates pass.

## References

- Supabase Queues / PGMQ: https://supabase.com/docs/guides/queues/pgmq
- Supabase Queue consumers with Edge Functions: https://supabase.com/docs/guides/queues/consuming-messages-with-edge-functions
- Supabase breaking changes: https://supabase.com/changelog?types=breaking-change
