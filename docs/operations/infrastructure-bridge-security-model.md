# SARINA Infrastructure Bridge — Security and Execution Design

Status: approved design baseline; implementation is staged and production-disabled.

## Decision

The owner-selected operating policy is **broad execution access with explicit owner approval for sensitive operations**. This is a policy for the SARINA execution bridge; it does not change permissions granted by ChatGPT, GitHub, Supabase, a hosting provider, or the operating system.

## Goals and boundaries

- Provide one audited control plane for approved SARINA infrastructure tasks.
- Keep the bridge separate from SCI, SIACP, SARINA Connect, and agricultural domain workflows.
- Support the Iran and international regions without making either region dependent on the other for its local control plane.
- Keep provider credentials server-side in a secret manager. Never return secrets to the model, browser, logs, Git, or tool output.
- Fail closed when identity, scope, policy, approval, backup, or target environment cannot be verified.
- Never expose a generic SQL console, arbitrary shell, unrestricted filesystem, or unrestricted cloud API as a tool.

## Trust boundaries

1. **ChatGPT / operator client** — submits a typed request; untrusted content and retrieved repository data are never treated as authorization.
2. **MCP/API gateway** — authenticates the caller, validates schemas, assigns request IDs, enforces rate limits and idempotency.
3. **Policy and approval engine** — classifies actions, checks environment/scope, records owner approval, and issues short-lived single-use execution grants.
4. **Execution adapters** — narrow allowlisted operations for GitHub, Supabase, deployment, storage, and regional infrastructure.
5. **Audit ledger** — append-only record of request, plan, approval, execution result, actor, target, and artifact/checksum references. Never store secret values.
6. **Target systems** — GitHub, Supabase, hosting, and regional servers. Credentials are least-privilege and isolated by environment.

## Action classes

### Class A — routine, no separate approval

Only allowlisted, reversible or read-only operations:
- inspect repository files, branches, pull requests, CI status, deployment status, Supabase project metadata, schema metadata, and logs with sensitive values redacted;
- run static checks and tests in an isolated development runner;
- create a feature branch and draft pull request;
- generate a proposed migration or deployment plan without applying it;
- read non-secret configuration metadata and backup inventory.

### Class B — approval required

Require explicit approval for the exact action, target, and immutable plan digest:
- write or modify production data, schema, RLS, grants, Auth, Storage policies, secrets, or Edge Functions;
- apply any database migration or run SQL that mutates data or schema;
- deploy, promote, cut over DNS, change regional routing, or alter production environment variables;
- delete, pause, overwrite, rotate, or decommission resources;
- create paid resources, increase plan/usage, or incur a new recurring cost;
- change user access, roles, permissions, OAuth scopes, or credential policies;
- export or transfer personal, restricted, or production data.

Approval is bound to: request ID, action name, environment, target resource IDs, exact parameter digest, expected impact, rollback plan, and expiry. Any changed parameter invalidates approval. Approval is one-time and cannot be replayed.

### Class C — prohibited

- Arbitrary shell/SQL execution exposed to the model.
- Secret retrieval or secret echoing.
- Disabling audit, RLS, authentication, backup gates, or approval checks to make an action succeed.
- Production destructive action without a verified independent backup and restore evidence.
- Physical/agricultural actuator commands or real-world actions.
- Actions outside the authenticated owner-approved scope.

## Approval lifecycle

`proposed → validated → awaiting_owner_approval → approved → executing → succeeded | failed`

Alternative terminal states: `rejected`, `expired`, `cancelled`, `blocked`.

- The owner sees a human-readable impact summary and exact target before approving.
- Approval requires a fresh authenticated owner session and a deliberate confirmation.
- Approval tokens are short-lived, single-use, action-bound, and stored hashed.
- Execution revalidates policy, target, plan digest, backup gate, and idempotency key immediately before mutation.
- Timeouts never imply success; the adapter must reconcile target state before retrying.
- Every state transition is audited. No approval is inferred from conversation text, repository content, or a model-generated claim.

## Backup and production gates

- Development and staging are the first implementation targets.
- Production writes stay disabled until a full independent backup exists and an isolated restore test passes.
- Follow `ops/backup/README.md`; database dumps alone do not cover Storage bytes, Auth configuration, Edge Functions, secrets, DNS, and provider settings.
- Do not migrate, pause, delete, or cut over the current Supabase project during bridge development.
- A backup reference, timestamp, checksum manifest, restore-test result, and rollback plan are mandatory inputs for eligible production mutations.

## Initial adapter allowlist

| Adapter | Initial read scope | Initial write scope |
|---|---|---|
| GitHub | repository metadata, files, branches, PRs, checks | feature branch and draft PR only; no direct main writes |
| Supabase | project metadata, table/migration/function inventory, redacted logs | none until approval engine, backup gate, and RLS review pass |
| Hosting | deployment/build status and configuration names | none initially |
| Regional server | health and inventory only | none initially |
| Storage | bucket/object metadata, redacted | none initially |

Each adapter must have a separate credential and scope per environment. Prefer OAuth or short-lived workload identity. Never put Supabase `service_role`, database passwords, provider API keys, or SSH private keys in client-visible configuration.

## Relationship to existing SARINA components

- **SCI** remains the domain orchestration, policy, and decision authority for agricultural workflows. Infrastructure Bridge does not replace SCI.
- **SIACP** remains the signed task/agent communication protocol. The existing `sarina-siacp-bridge` is a validation-only transport and is not an infrastructure command executor.
- **SARINA Connect** remains farmer-specialist communication routing. It is not used for operator approvals.
- Infrastructure Bridge has its own typed command envelope, policy registry, approval ledger, and adapter boundary.

## Phased implementation

### Phase 0 — governance baseline (this change)
- Record owner-selected policy and security boundaries.
- No production code, schema, secret, deployment, or infrastructure changes.

### Phase 1 — read-only inventory service
- Add authenticated MCP/API endpoint and typed read-only tools.
- Add audit events, request IDs, rate limits, redaction, and environment scoping.
- Verify read-only behavior with integration tests.

### Phase 2 — approval engine (development only)
- Add action registry, plan digest, approval state machine, expiry, single-use grants, idempotency, and audit verification.
- Test replay, tampering, stale approvals, cross-environment access, and failure recovery.

### Phase 3 — constrained development writes
- Enable only feature-branch creation, draft PR creation, and isolated development operations.
- Keep production adapters disabled.

### Phase 4 — gated production operations
- Requires independent backup and restore acceptance, security review, owner sign-off, and explicit enablement per adapter/action.
- No global “production write” switch.

## Acceptance criteria

- Unknown actions and parameters are rejected.
- No tool accepts arbitrary SQL, shell, URL fetch, or generic cloud API calls.
- Owner approval is required for every Class B operation and bound to the exact immutable plan.
- Approval replay, expiry, parameter substitution, and cross-environment attempts are rejected.
- Secrets never appear in tool output, logs, browser bundles, or repository content.
- Audit records are append-only and contain actor, request, action, environment, target, plan digest, approval reference, timestamps, result, and artifact references.
- Production mutations remain blocked until backup/restore gates are evidenced.
- No production schema or runtime change is made as part of Phases 0–3.

## Open integration constraint

ChatGPT custom MCP availability and write-action support depend on the user's ChatGPT plan, workspace policy, and client surface. Building the bridge does not itself grant ChatGPT additional tools. Confirm that the account can connect a custom remote MCP server with write actions before relying on it as the operator interface; otherwise use a supported secured operator client while preserving the same API and approval model.
