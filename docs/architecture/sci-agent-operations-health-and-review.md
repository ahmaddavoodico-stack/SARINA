# SCI Agent Operations, Health and Review Policy

**Status:** Runtime telemetry schema and Edge Functions are deployed; the SCI fleet view is in the production frontend. Live Manus heartbeat and report ingestion are still awaiting the next authenticated Manus MCP calls.
**Date:** 2026-11-26
**Authority:** SARINA Central Intelligence (SCI)

## 1. Operating principle

SCI is SARINA's single command center. This document does not introduce a second orchestrator or a parallel agent-control center.

The farmer remains the decision-maker for their farm. SCI manages the agent fleet, task routing, execution policy, quality gates, evidence reconciliation, and concise operational reporting. Human attention is reserved for exceptions and consequential decisions; it is not a prerequisite for every routine agent task.

## 2. Logical specialist vs execution adapter

Keep these concepts separate:

- **Specialist role:** the capability SARINA needs, such as `market_intelligence_specialist`.
- **Execution adapter:** the approved tool or runtime used to perform that work, such as Manus, an internal deterministic workflow, a self-hosted model, or a qualified human expert.
- **Agent instance:** a concrete configured runtime with its own identity, health signals, permissions, quotas, and audit trail.

Manus is the first external research execution adapter for the Market Intelligence specialist role. It is not a second command center, does not own the market domain, does not own SARINA data, and cannot set its own permissions or promote its own findings into trusted knowledge.

This separation allows SARINA to replace or supplement Manus later without changing the Market Intelligence domain contract.

## 3. Two independent state dimensions

Do not collapse lifecycle, availability, and health into one boolean.

### Lifecycle / administrative state

- `registered`: known to SCI; not dispatchable.
- `enabled`: approved for eligible work, subject to health and policy gates.
- `paused`: temporarily excluded from new assignments.
- `disabled`: administratively unavailable.
- `deprecated`: retained for history; no new assignments.

### Runtime / operational state

- `ready`: capability check passed, recent authenticated heartbeat exists, no active blocker, and capacity is available.
- `busy`: a valid task is running; the agent may still be healthy and responsive.
- `responding`: authenticated communication works, but readiness/capacity has not been established.
- `degraded`: responding with a known limitation, repeated errors, quota pressure, or partial capability.
- `offline`: a previously observed runtime missed its configured heartbeat/health window.
- `unknown`: insufficient recent evidence to make a claim about health.

A deployed Edge Function or a successful historical handshake alone must never be displayed as proof that the agent is currently ready. Unknown must not be painted green.

## 4. Health evidence and freshness

Every runtime status must carry its evidence and timestamp:

- last authenticated heartbeat;
- last successful capability probe;
- last successful task completion;
- last error and error category;
- current task count and available capacity, when known;
- quota/cost state, when supplied by the provider;
- adapter version and supported capabilities;
- status source and freshness window.

Heartbeat freshness is adapter-specific and configurable. A long-running research job must report progress/heartbeat independently of task completion. If an adapter cannot provide heartbeats, SCI may show `responding` or `unknown`, but must not claim `ready`.

The Manus MCP gateway should record successful authenticated tool activity. A dedicated status/heartbeat tool is a future integration step; it must not be simulated by a dashboard constant or by merely observing that the Edge Function is ACTIVE.

## 5. Human attention policy: exception-based, not universal review

Routine work should complete through SCI's automated quality gates. A human should not be asked to read every mission or every specialist report.

### Automatic processing is allowed when all conditions pass

- the task is read-only and within the adapter's declared capability;
- the requested data scope is authorized and minimal;
- output schema and completeness checks pass;
- evidence is traceable and sources meet the domain's minimum quality policy;
- confidence and uncertainty are explicit;
- no material conflict, unresolved high-impact gap, or safety trigger is detected;
- the action is reversible or has no external side effect;
- the result is not being promoted to trusted long-term knowledge without the separate SAI acceptance process.

SCI may summarize and use a passing result for internal analysis or a routine farmer-facing explanation within the approved domain policy. The result must retain provenance, confidence, limitations, and its automated quality disposition.

### Escalate to a human only for defined exceptions

- critical/high-risk or consequential decisions;
- conflicting evidence or material disagreement between specialists;
- low confidence, missing essential inputs, or failed quality checks;
- legal/regulatory ambiguity or an unverified mandatory requirement;
- requests to contact a buyer/company, publish externally, change production data, purchase, pay, or make a commercial commitment;
- safety-sensitive agronomic instructions such as pesticide dosing, chemical application, fertilizer rates requiring diagnosis, or irrigation actuation;
- privacy/consent boundary violations;
- proposed promotion of new knowledge into SARINA Agricultural Intelligence (SAI), which requires its own evidence review and approval policy;
- repeated failures, quota exhaustion, or degraded provider behavior requiring an operational decision.

Human review is an exception queue with a reason code and concise decision packet, not a mirror of every agent task.

## 6. Command-center overview

The existing SCI/admin command center should provide a fleet overview, not a wall of raw agent transcripts.

### Fleet summary

- total registered, enabled, ready, busy, degraded, offline, and unknown runtimes;
- active tasks, queued tasks, completed tasks, failed tasks, and overdue tasks;
- last successful system health evaluation;
- high-priority alerts requiring operator action.

### Per-agent card

- agent and specialist domain;
- execution adapter/provider;
- lifecycle state and runtime state as separate labels;
- health: healthy / degraded / unavailable / unknown;
- readiness and last heartbeat age;
- capability coverage and supported modalities;
- active task count / capacity;
- recent success/failure trend and last successful completion;
- quota/budget state, if available;
- concise blocker or next retry time.

### Human-facing task visibility

By default, the operator sees counts, short summaries, status, and exception reasons. Full reports and task transcripts are available on demand, with access controls and audit logging. The first Manus pilot report is an explicit exception: it must be presented to the project owner for direct quality and usefulness assessment.

## 7. First Manus pilot evaluation

The existing Khuzestan dates → UAE research mission is the first controlled evaluation. Do not start a duplicate mission and do not poll the asynchronous Manus task for status.

When its report is delivered, SARINA should preserve the original report as a private research draft and evaluate it against this rubric:

| Dimension | Weight | What is evaluated |
|---|---:|---|
| Official-source quality and traceability | 25 | Primary authority sources, working URLs, dates, source-to-claim mapping |
| Regulatory accuracy and applicability | 25 | Correct product/origin/destination scope; legal requirements distinguished from buyer preferences |
| Coverage and completeness | 20 | Trade data, permits, food safety, labeling, packaging, logistics, cost components, risks and gaps |
| Evidence discipline | 15 | Verified facts separated from estimates, assumptions, secondary claims and unknowns |
| Practical usefulness | 10 | Clear readiness gaps, next steps and decision-relevant synthesis |
| Governance compliance | 5 | No invented buyers/prices, external contact, publication or unauthorized actions |

Score each dimension only after inspecting the report. If evidence is absent, mark it not demonstrated rather than awarding assumed points. Report total score, critical defects, unsupported claims, omitted requirements, time-to-completion (from reliable timestamps), and any observed quota/cost data. Do not invent model cost, token usage, or performance statistics.

The first report is reviewed by the project owner. This is a one-time pilot evaluation gate, not the permanent rule for every future mission.

## 8. Manus operating boundary

- Manus performs research tasks only when assigned through an approved SARINA mission contract.
- It receives only the minimum task-specific context needed.
- It may save a structured result as a private `pending_review` draft through the SARINA MCP gateway.
- It cannot read farmer identities, farm records, private conversations, orders, payments, or active catalog data.
- It cannot contact buyers/companies, publish externally, modify prices/inventory/products, or make commitments.
- Manus output is untrusted input until SCI validates its structure, source references, scope, consistency, and uncertainty.
- A successful save/read proves draft transport, not factual correctness or agent performance.

## 9. Current implementation facts and gaps

As of this document's date:

- SCI remains the existing command center.
- The durable task database and queue primitives exist, but no production worker consumes the queue.
- The ten new specialist roles remain registered-only and disabled.
- The Manus MCP Edge Function is deployed and has previously passed a connection check; its database draft store was reported ready.
- The Manus MCP gateway currently exposes connection/capability checks and private draft save/list/get operations.
- The first research task exists in Manus, but its report save/read round-trip and factual quality have not yet been accepted.
- The current collaboration planner/aggregator still hard-requires human review. Exception-based automated review is a target policy and must not be represented as already running.
- The Manus MCP direction is currently Manus → SARINA. A secure SCI → Manus mission-dispatch mechanism has not yet been demonstrated. Until that exists, manually initiated Manus missions must be linked to SCI task records explicitly and must not be described as SCI-dispatched.

## 10. Implementation sequence and acceptance gates

1. **Contract and truthful status:** update integration docs and define lifecycle/health/review states without enabling any new agent.
2. **Runtime telemetry:** add a private SCI agent-runtime registry, authenticated heartbeat/capability reports, bounded freshness, and append-only health events. Do not expose provider credentials.
3. **Command-center view:** extend the existing admin/SCI console with fleet health, task counts, alerts, and drill-down; no parallel command center and no fabricated status.
4. **Manus result lifecycle:** link the existing pilot mission to an SCI task, ingest its private draft, validate report structure/evidence, and produce the first owner-visible evaluation.
5. **Exception-based review engine:** implement deterministic quality gates and escalation reasons; keep high-risk/legal/commercial/SAI promotion gates intact.
6. **Controlled dispatch:** only after the provider direction, authentication, idempotency, quotas, cancellation, retries, audit, and end-to-end tests are proven, allow SCI to dispatch to Manus.
7. **One adapter at a time:** do not mark an agent ready or enable a specialist until live health, capability, permission, failure and recovery tests pass.

No agent should be marked ready, no blanket human-review gate should be removed, and no worker/provider dispatch should be activated merely because this policy document exists.
