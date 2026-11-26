# SCI Durable Task Runtime Foundation

**Status:** Database migration and Edge Function foundations are deployed; durable task intake remains guarded; no specialist worker is running.
**Date:** 2026-11-26
**Authority:** SARINA Central Intelligence (SCI)

## 1. Architecture

SCI remains the only command center. The durable layer consists of:
- `sci_internal.sci_tasks`: private parent tasks and specialist proposal children;
- `sci_internal.sci_task_events`: append-only lifecycle history;
- the logged Supabase PGMQ queue `sarina_sci_tasks`: durable delivery and visibility-timeout redelivery;
- narrowly granted server-side RPCs for creation, approval, claiming, heartbeat, completion, failure, recovery, cancellation, and task-tree history.

The queue is logged/durable; no unlogged queue is used. The PGMQ schema is not exposed through the Data API. The application does not depend on a paid AI provider or a separate queue vendor.

## 2. Deployment and verification facts

The following facts were checked against the primary Supabase project on 2026-11-26:

- Migrations `20261126020120_enable_pgmq_extension_for_sci` and `20261126020336_sci_durable_task_queue` are present in migration history.
- `sarina-central-intelligence` is ACTIVE, deployed version 5, with platform JWT verification enabled.
- `sarina-task-control` is ACTIVE, deployed version 1, with platform JWT verification enabled.
- The cron recovery job was previously verified active.
- Transactional SQL tests exercised parent/child creation, task-tree reads, authorization gates, cancellation, idempotency, and registered-only blocking; test rows were rolled back.
- After rollback, task/event/queue/archive counts were zero.
- No authenticated live HTTP end-to-end test with a real user and registered farm has yet been completed.

No runtime secret values or activation flags are documented here. The code defaults to simulation-only unless the trusted server-side durable-task flag is explicitly set to the exact enabling value.

## 3. Persistence and data scope

- Every root task is linked to the authenticated Supabase user and a farm that was first verified under the caller JWT and existing RLS.
- Child specialist proposals must belong to the same owner and farm as their parent.
- At most four specialist proposals can be attached to one parent task.
- Idempotency is unique per authenticated owner; reuse with a different request fingerprint is rejected.
- The question, language, and user-supplied references are stored in the private task record for resumability. Weather and land-context payloads are not copied into the queue; only scoped reference handles are stored.
- Task tables live in an unexposed schema, have RLS enabled, and grant no direct access to `anon` or `authenticated`. Only server-side `service_role` RPC access is granted.
- The event table grants insert/select but not update/delete to `service_role`, preserving append-only application behavior.

## 4. State and dispatch gates

New requests are persisted as `validated` or `waiting_for_human`; creation never puts a task directly onto the executable queue.

Dispatch requires all of:
1. an SCI policy-decision reference;
2. an enabled agent lifecycle state;
3. a human approval reference whenever the task is marked human-review-required.

Only the authorization RPC moves a task to `queued` and inserts a PGMQ message in the same database transaction. A specialist proposal is initially recorded as `waiting_for_human`, `registered`, and dispatch-disabled. Registered-only specialists cannot be claimed.

## 5. Worker lifecycle contract

- `sci_claim_tasks` reads durable messages with a visibility timeout and assigns a random lease token.
- `sci_heartbeat_task` extends a live lease, never beyond the task deadline.
- `sci_complete_task` and `sci_fail_task` require the active lease token.
- Retry is bounded by max attempts, deadline, and exponential delay.
- Expired leases can be reclaimed by a subsequent queue read or the recovery routine.
- If an agent is paused before claim/retry, the task returns to human review instead of being executed.
- `sci_recover_expired_tasks` is scheduled once per minute through pg_cron. It only retries expired work or marks overdue work terminal; it never executes an agent.
- `sci_cancel_task` cancels the parent and all nonterminal descendants and archives pending queue messages.
- `sci_get_task_tree` returns the owner's parent/child task history and audit events.

**Important:** These are database and lifecycle primitives. A production worker consumer is not deployed. The queue does not currently execute a specialist or model.

## 6. Edge Function boundaries

### `sarina-central-intelligence`

After authenticating the caller, verifying farm access through the caller-JWT client, and validating current farm context, the endpoint uses a server-only service-role client to persist the parent task and any specialist proposal children. An optional `Idempotency-Key` header supports retry-safe submissions; without it, a fresh key is generated.

The service-role key is never returned to the client. When durable mode is active, the response reports `durable_pending_authorization`, `dispatch_authorized: false`, and `execution_status: not_started`.

### `sarina-task-control`

Provides owner-scoped `get_tree` and `cancel` operations. The caller is authenticated first; the database RPC additionally checks the task owner.

## 7. Current limitations and rollout gates

- No specialist or model/provider is invoked by this runtime.
- The queue worker consumer is not deployed.
- No agent-runtime heartbeat or capacity registry exists yet.
- A user-facing task-history/cancel interface is not yet wired into the farmer portal.
- Authenticated live HTTP end-to-end testing with a real user and registered farm remains outstanding.
- The ten new specialist roles remain registered-only and disabled.
- The collaboration planner and aggregator still require human review; exception-based automatic quality review is a target policy, not active runtime behavior.

## 8. Activation, privacy, and release gates

- Durable task intake and task-control endpoints remain guarded by the trusted Edge Function environment flag; do not assume or disclose its current value.
- If the flag is unset or not exactly enabled, SCI remains in simulation-only mode and does not persist tasks or invoke providers.
- The task record stores the farmer's submitted question in `request_payload` and scoped farm references. A retention, export, and erasure policy must be approved before broad durable intake.
- No worker is included in this phase. Queue creation, authorization gates, task history, cancellation, and lease-recovery primitives do not mean a specialist/model is executing.
- Before enabling any worker, complete authenticated end-to-end tests, least-privilege context resolution, heartbeat/health reporting, idempotency, retry, timeout, cancellation, audit, and exception-review tests.
- Introduce one low-risk read-only adapter at a time. Never mark an agent ready solely because its registry entry exists or its Edge Function is deployed.
