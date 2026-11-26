# SCI Durable Task Runtime Foundation

**Status:** Durable task persistence and queue-control primitives implemented in the feature branch; not applied to the primary database and not deployed.  
**Date:** 2026-11-26  
**Authority:** SARINA Central Intelligence (SCI)

## 1. Architecture

SCI remains the only command center. The durable layer consists of:
- `sci_internal.sci_tasks`: private parent tasks and specialist proposal children;
- `sci_internal.sci_task_events`: append-only lifecycle history;
- the logged Supabase PGMQ queue `sarina_sci_tasks`: durable delivery and visibility-timeout redelivery;
- narrowly granted server-side RPCs for creation, approval, claiming, heartbeat, completion, failure, recovery, cancellation, and task-tree history.

The queue is logged/durable; no unlogged queue is used. The PGMQ schema is not exposed through the Data API. The application does not depend on a paid AI provider or a separate queue vendor.

## 2. Persistence and data scope

- Every root task is linked to the authenticated Supabase user and a farm that was first verified under the caller JWT and existing RLS.
- Child specialist proposals must belong to the same owner and farm as their parent.
- At most four specialist proposals can be attached to one parent task.
- Idempotency is unique per authenticated owner; reuse with a different request fingerprint is rejected.
- The question, language, and user-supplied references are stored in the private task record for resumability. Weather and land-context payloads are not copied into the queue; only scoped reference handles are stored.
- Task tables live in an unexposed schema, have RLS enabled, and grant no direct access to `anon` or `authenticated`. Only server-side `service_role` RPC access is granted.
- The event table grants insert/select but not update/delete to `service_role`, preserving append-only application behavior.

## 3. State and dispatch gates

New requests are persisted as `validated` or `waiting_for_human`; creation never puts a task directly onto the executable queue.

Dispatch requires all of:
1. an SCI policy-decision reference;
2. an enabled agent lifecycle state;
3. a human approval reference whenever the task is marked human-review-required.

Only the authorization RPC moves a task to `queued` and inserts a PGMQ message in the same database transaction. A specialist proposal is initially recorded as `waiting_for_human`, `registered`, and dispatch-disabled. Registered-only specialists cannot be claimed.

## 4. Worker lifecycle

- `sci_claim_tasks` reads durable messages with a visibility timeout and assigns a random lease token.
- `sci_heartbeat_task` extends a live lease, never beyond the task deadline.
- `sci_complete_task` and `sci_fail_task` require the active lease token.
- Retry is bounded by max attempts, deadline, and exponential delay.
- Expired leases can be reclaimed by a subsequent queue read or the recovery routine.
- If an agent is paused before claim/retry, the task returns to human review instead of being executed.
- `sci_recover_expired_tasks` is scheduled once per minute through the existing pg_cron extension. It only retries expired work or marks overdue work terminal; it never executes an agent.
- `sci_cancel_task` cancels the parent and all nonterminal descendants and archives pending queue messages.
- `sci_get_task_tree` returns the owner's parent/child task history and audit events.

## 5. Edge Function boundaries

### `sarina-central-intelligence`
After authenticating the caller, verifying farm access through the caller-JWT client, and validating current farm context, the endpoint uses a server-only service-role client to persist the parent task and any specialist proposal children. An optional `Idempotency-Key` header supports retry-safe submissions; without it, a fresh key is generated.

The service-role key is never returned to the client. The response explicitly reports `durable_pending_authorization`, `dispatch_authorized: false`, and `execution_status: not_started`.

### `sarina-task-control`
Provides owner-scoped `get_tree` and `cancel` operations. The caller is authenticated first; the database RPC additionally checks the task owner.

## 6. Current limitations and rollout gates

- No specialist or model/provider is invoked by this milestone.
- The queue worker consumer is not yet deployed. The claim/heartbeat/complete/fail RPCs are the worker contract, not evidence of a running worker.
- The migration has not been applied to the primary Supabase project. It must be tested in an isolated Supabase development branch before any production rollout.
- The new Edge Functions are committed to the feature branch only; no deployment has been made.
- A user-facing task-history/cancel interface is not yet wired into the farmer portal.
- Deno tests and database migration tests still require execution in a supported environment.

## 7. Acceptance gates before production

1. Run Deno tests and type checks for SCI and task-control functions.
2. Apply the migration to an isolated Supabase development branch and run `supabase/tests/sci_durable_task_queue.test.sql`.
3. Verify RLS/grants, PGMQ visibility-timeout redelivery, idempotency races, parent-child ownership, cancellation, deadline expiry, retry cap, lease reclamation, and cron recovery.
4. Deploy the migration and Edge Functions only through a reviewed rollout; keep worker dispatch disabled.
5. Introduce one low-risk read-only worker only after separate approval, worker authentication, least-privilege context resolution, audit, and end-to-end tests.


## Activation, privacy, and rollout gates

- Durable task intake and task-control endpoints remain disabled unless `SCI_DURABLE_TASKS_ENABLED=true` is explicitly configured in the trusted Edge Function environment.
- The existing simulation-only SCI response remains the default, so deploying this code before the database migration does not break the current endpoint.
- Apply the migration and run `supabase/tests/sci_durable_task_queue.test.sql` in an isolated test database before enabling the flag. The migration has not been applied to the primary Supabase database as part of this code transfer.
- The task record stores the farmer's submitted question in `request_payload` and scoped farm references. A retention, export, and erasure policy must be approved before durable intake is enabled.
- No worker is included in this phase. Queue creation, authorization gates, task history, cancellation, and lease-recovery primitives do not mean a specialist/model is executing. All ten new specialist agents remain registered-only and disabled.
