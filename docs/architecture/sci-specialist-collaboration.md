# SCI Specialist Collaboration

**Status:** Deterministic planning and aggregation primitives implemented; runtime dispatch is not enabled.  
**Date:** 2026-11-26  
**Owner:** SARINA Central Intelligence (SCI)

> Operational target: human attention is exception-based, not a universal gate. See [SCI Agent Operations, Health and Review Policy](./sci-agent-operations-health-and-review.md). The current planner and aggregator still require human review; this target policy is not yet active in runtime code.

## 1. Authority

SCI remains the only command center and owns task decomposition, subtask identity, data scope, deadlines, policy, approvals, dispatch decisions, lifecycle, aggregation, and the farmer-facing response.

Specialists never invoke one another, create child tasks, expand their own permissions, or publish a farmer-facing answer. The collaboration module is a pure planning/reconciliation layer, not a worker runtime.

## 2. Planning contract

`planSpecialistCollaboration` accepts:
- one parent task identifier;
- the smallest set of explicitly selected specialist domains;
- per-domain context references, rather than one shared context bundle;
- the modalities required by the parent request.

It returns proposed work items with stable proposal keys, parent linkage, a bounded purpose, expected output, per-specialist context references, availability and block reasons.

Current implementation controls:
- maximum four specialists per plan;
- duplicate domains are deduplicated;
- unknown and non-specialist domains are rejected;
- missing per-domain context blocks that work item;
- unsupported modalities block that work item;
- only lifecycle state `enabled` is eligible;
- every item currently requires human review;
- no work item authorizes dispatch or external action.

A proposal key is not a persisted child task ID. Creating durable child tasks, enqueueing, or invoking a worker is outside this module.

## 3. Result contract and reconciliation

A specialist result contains:
- specialist identity and domain;
- terminal execution status;
- findings with a stable topic key and position;
- summary, evidence references, confidence, missing inputs and limitations.

`aggregateSpecialistResults`:
- rejects unexpected agent/domain pairs and duplicate results;
- reports missing and failed specialists;
- preserves each accepted finding and its evidence references;
- detects differing positions for the same topic;
- never averages confidence or invents consensus;
- currently requires human review and never authorizes a farmer-facing response.

A complete aggregate means only that all expected result envelopes were received and reconciled without detected conflict. Aggregation accepts results only when an SCI-controlled execution record is explicitly in the `executing` state and every work item is marked dispatch-authorized. The planner itself never sets those flags. A complete aggregate is not a verified agronomic conclusion or approval to act.

## 4. Current operating state

All ten newly registered specialist agents remain `registered` and disabled. Therefore, real plans generated from the current registry are blocked. The test-only execution fixture exercises aggregation behavior without enabling or dispatching any production agent. It represents a hypothetical SCI-authorized execution state, not a state reached in the current project.

The module is not yet wired into the authenticated Edge Function request path. The existing SCI endpoint has durable task primitives deployed, but no production worker consumes the queue and no real specialist/model/provider is invoked by this collaboration module.

## 5. Safety and privacy

- Context references are supplied separately for each specialist; no automatic broadcast of the full parent context is permitted.
- The planner does not dereference context references or grant database permissions.
- No model/provider selection or invocation occurs.
- No buyer contact, order, payment, chemical/fertilizer instruction, irrigation actuation, or other consequential action is permitted.
- Conflicts, missing inputs, low confidence, and partial failures remain visible for policy-based escalation.
- Only independently reviewed, provenance-backed knowledge may be considered for SARINA Agricultural Intelligence (SAI).

## 6. Verification and next gates

The accompanying Deno test file covers disabled-agent blocking, bounded fan-out, deduplication, per-specialist context scoping, modality checks, missing results, duplicate/unexpected results, and conflict preservation.

Execution of Deno tests has not yet been verified in this environment. Before runtime integration:
1. Run the full SCI Deno test suite and type checks in a supported Deno environment.
2. Connect plan creation to SCI only after an explicit multi-domain intent decision; ambiguity must still request clarification.
3. Add capability-scoped worker adapters, cancellation, timeout, idempotency, audit, and operational pause controls.
4. Implement deterministic output quality gates and exception-based human escalation as specified in the operations policy.
5. Enable one low-risk read-only adapter only after policy, privacy, evidence, and end-to-end acceptance tests.
6. Keep paid-provider dispatch disabled unless separately approved; self-hosted/free paths are preferred and no paid API is a prerequisite.

No agent activation or provider dispatch is part of this milestone.
