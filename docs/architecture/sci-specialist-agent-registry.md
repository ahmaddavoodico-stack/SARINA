# SCI Specialist Agent Registry

**Status:** Approved implementation direction; registry inventory and contract specification  
**Date:** 2026-11-26  
**Scope:** Organize specialist agents inside the existing SARINA Central Intelligence (SCI)  
**Implementation note:** This document defines the registry contract and initial inventory. It does not claim that listed specialist agents are executable or enabled.

## 1. Purpose and ownership

SCI remains SARINA's single command center and the sole owner of task intake, intent classification, routing policy, permissions, consent, risk gates, task lifecycle, result aggregation, and the farmer-facing response.

The specialist registry is a capability directory used by SCI. It is not a second orchestrator, a collection of independent autonomous services, or a source of farmer/domain truth. Specialist agents do not own canonical farm records, make final policy decisions, or authorize consequential actions.

The existing deterministic, model-free routing pass remains the first routing layer. Provider selection and invocation remain separate from agent identity: an agent describes *what work is needed*; an adapter describes *which approved execution tool may assist*.

## 2. Initial specialist inventory

The following are logical specialist roles. They may later be implemented by deterministic internal logic, approved retrieval, a self-hosted model, a reviewed external provider adapter, a human specialist, or a combination. Their registration does not imply runtime availability.

| Agent ID | Specialist domain | Primary responsibility | Typical inputs | Expected output |
|---|---|---|---|---|
| `soil_water_specialist` | Soil and water | Soil properties, salinity, alkalinity, drainage, irrigation-water quality | Farm/plot context, soil and water tests, observations | Evidence-backed soil/water assessment, missing tests, constraints |
| `irrigation_specialist` | Irrigation | Crop water demand, irrigation scheduling and method assessment | Crop/stage, weather, soil, water source, irrigation history | Advisory schedule/options, assumptions, water-risk flags |
| `plant_nutrition_specialist` | Plant nutrition | Nutrient diagnosis and fertilizer planning | Crop/stage, soil/leaf tests, water, prior inputs | Nutrient assessment, information gaps, reviewed calculation inputs |
| `plant_health_specialist` | Plant health | Pest, disease, disorder and symptom triage | Symptoms, images, crop/stage, field conditions, history | Differential possibilities, risk flags, evidence and escalation needs |
| `climate_specialist` | Climate | Weather context, heat/cold stress and climate adaptation | Farm location, forecast/history, crop/stage, field observations | Climate risk summary, time horizon, adaptation options |
| `agricultural_knowledge_specialist` | Agricultural knowledge | Retrieve and organize approved agricultural knowledge and research | Question, crop/context, approved knowledge and source references | Source-linked evidence summary, applicability and limitations |
| `market_intelligence_specialist` | Market intelligence | Demand, prices, trends, competitors, target-market and buyer research | Product/specification, origin, target markets, time window | Dated market findings, source quality, opportunities and unknowns |
| `trade_export_specialist` | Trade and export | Import/export rules, standards, certificates, labeling and export readiness | Product, origin/destination, HS-code candidates, shipment context | Requirement matrix, official sources, compliance gaps and caveats |
| `finance_economics_specialist` | Finance and agricultural economics | Cost, margin, investment and scenario analysis | Verified costs, quantities, prices, assumptions and time horizon | Transparent calculations, scenarios, sensitivity and uncertainty |
| `logistics_supply_chain_specialist` | Logistics and supply chain | Storage, packaging, transport, cold chain and delivery feasibility | Product, quantity, quality, route, timing and handling needs | Logistics options, constraints, cost inputs and operational risks |

Existing general-purpose roles such as conversation coordination, broad agronomy triage, crop diagnostics, knowledge research, marketplace assistance, specialist handoff, and account support remain in place during migration. Their responsibilities must be mapped deliberately to the specialist roles; do not silently remove or rename existing IDs while callers and tests may depend on them.

## 3. Standard agent definition contract

Every registry entry must provide the following fields:

- **Identity:** stable ID, display name, domain, version, lifecycle state.
- **Purpose:** concise mission statement and explicit responsibility boundary.
- **Capabilities:** machine-readable capability identifiers, not free-form descriptions alone.
- **Inputs:** required and optional context, accepted modalities, data classification and source expectations.
- **Outputs:** typed output contract, evidence references, uncertainty, missing information, limitations and escalation reason.
- **Risk:** default risk tier, high-consequence conditions, human-review requirements and prohibited actions.
- **Access:** least-privilege data scopes and typed tools the agent may request; no unrestricted database or credential access.
- **Execution:** supported execution modes, approved adapter requirements, timeout/concurrency limits and retry policy.
- **Economics:** free/self-hosted preference, quota and budget limits, and safe behavior when limits are reached.
- **Fallback:** internal retrieval/rules, human handoff, clarification, or safe deferral. Fallback must not silently reduce safety or evidence quality.
- **Governance:** owner, review status, version, audit requirements and deprecation conditions.

The registry must validate these fields at startup/test time. Unknown capabilities, duplicate IDs, invalid lifecycle transitions, unsupported modalities, and unregistered execution adapters must fail closed.

## 4. Lifecycle states

Keep registration, routing availability, and actual execution as separate concepts.

1. **registered** — definition exists and passes schema validation; no execution is implied.
2. **simulated** — only a test/simulation adapter may execute; no production side effects.
3. **enabled** — SCI may route eligible tasks to the agent, subject to all task and policy gates.
4. **paused** — new assignments are blocked; existing tasks follow explicit pause/cancel policy.
5. **deprecated** — no new assignments; retained for historical task interpretation until safely retired.

A registered agent must not become enabled merely because its definition exists. Provider credentials or a provider adapter must never be required for deterministic/internal agents.

## 5. Routing and collaboration rules

- SCI owns all routing. Agents cannot directly dispatch other agents or bypass SCI.
- Route only to enabled agents whose capabilities, modalities, data scopes and risk policy match the task.
- One task may be decomposed into specialist subtasks only when SCI records the parent-child relationship, purpose, data scope, deadline, and expected output for each subtask.
- SCI selects the smallest sufficient set of specialists; do not fan out to every agent by default.
- Conflicting findings are preserved and surfaced for reconciliation; do not average contradictions into a false consensus.
- Every result must preserve provenance, confidence/uncertainty, missing inputs, limitations and review status.
- If no eligible agent exists, ask for clarification, hand off to a human, or safely defer.
- Model/provider choice is a separate SCI policy decision. A provider outage or quota limit must not trigger an unapproved or paid fallback.

## 6. Safety and authority boundaries

Specialist agents provide analysis and proposed options, not independent authority.

- No autonomous purchasing, payments, outbound contact, order commitments, account changes, data deletion, chemical application, fertilizer dosing, irrigation actuation, or other consequential action.
- High-risk agronomic recommendations remain subject to qualified specialist review and explicit farmer confirmation as applicable.
- Buyer discovery and market research must not contact buyers or companies unless separately authorized.
- Only reviewed, provenance-backed knowledge may be promoted into SARINA Agricultural Intelligence (SAI). Raw agent/model output is a candidate, never trusted knowledge by default.
- Agents receive only the minimum authorized farm and personal data required for their task.

## 7. Initial rollout sequence

### Step A — Inventory and contract
- Review the existing `AGENT_REGISTRY`, task router, task lifecycle and tests.
- Map existing agent IDs to the specialist inventory without breaking callers.
- Add the standard definition contract and validation tests.
- Register new specialist roles as **registered-only** until implementation and policy gates exist.

### Step B — Deterministic routing
- Add focused routing rules for the specialist domains.
- Keep ambiguous cross-domain requests with the conversation coordinator for clarification.
- Add precedence and negative/ambiguous test cases.
- Keep provider invocation disabled.

### Step C — Controlled collaboration
- Add SCI-owned parent/child task decomposition and result aggregation.
- Preserve evidence and contradictions across specialist outputs.
- Test partial failures, timeout, duplicate requests, cancellation and human-review holds.

### Step D — One-at-a-time execution enablement
- Begin with one low-risk, read-only specialist.
- Prove provider-off operation, least-privilege access, budget enforcement, audit and safe fallback.
- Enable further agents only after independent acceptance tests and operational review.

## 8. Acceptance criteria for the registry milestone

- One authoritative registry exists under SCI; no parallel command center is introduced.
- Every current and new agent has a stable ID, domain, capabilities, modalities, responsibility boundary and lifecycle state.
- Registration does not imply executable/enabled status.
- Existing routing behavior remains covered by regression tests.
- Specialist IDs and domain values are validated by task-envelope validation.
- Ambiguous requests do not fan out automatically.
- Provider dispatch and consequential actions remain disabled by default.
- Registry and contract documentation clearly distinguish implemented, simulated, enabled and planned capabilities.

## 9. Non-goals of this milestone

This milestone does not implement durable queues, production workers, paid-provider activation, autonomous multi-agent execution, database migrations, new farmer-facing controls, or production deployment. Those require separate design, tests and explicit release gates.
