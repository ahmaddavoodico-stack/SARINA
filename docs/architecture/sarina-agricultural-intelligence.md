# SARINA Agricultural Intelligence (SAI)
## Strategic Architecture and Delivery Blueprint

**Status:** Approved strategic direction; architecture specification  
**Date:** 2026-11-25  
**Scope:** Knowledge accumulation, reuse, validation, and progressive reduction of external AI dependency  
**Implementation status:** Design document only. No runtime capability is claimed by this document.

---

## 1. Strategic objective

SAI is SARINA's internal agricultural knowledge and learning capability. Its purpose is to turn longitudinal farm data, field observations, actions, outcomes, and expert-reviewed cases into reusable, traceable agricultural knowledge.

As SARINA accumulates evidence over multiple growing cycles, recurring and well-understood tasks should increasingly be handled by internal retrieval, rules, statistical methods, and validated decision-support models. External AI providers remain replaceable tools for novel, ambiguous, complex, or language-intensive tasks—not permanent owners of SARINA's agricultural intelligence.

The target is **progressive, evidence-based self-reliance**, not a claim that all agricultural problems can or should be automated.

## 2. Non-negotiable principles

1. **SARINA owns the knowledge.** Providers may process approved task inputs, but they do not own the canonical farm history, knowledge base, policies, or decision record.
2. **Evidence before learning.** A model response, unverified farmer report, or single apparent success must never silently become an authoritative recommendation.
3. **Context matters.** Reuse must account for crop and variety, growth stage, soil, water quality, climate, geography, management history, timing, and relevant uncertainty.
4. **Provenance is mandatory.** Every reusable case or rule must retain its source, timestamps, context, evidence, review status, and version.
5. **Human oversight for consequential decisions.** High-risk agronomic recommendations and actions require qualified review and/or explicit farmer confirmation under SARINA policy.
6. **Provider neutrality.** SAI must work when OpenAI, Claude, Manus, or any other external provider is unavailable.
7. **Privacy and least privilege.** Use only data authorized for the task; isolate farm/customer records and enforce role-based access.
8. **No automatic promotion from raw model output.** External AI can propose hypotheses or summaries, but cannot directly publish trusted knowledge.

## 3. Conceptual architecture

```text
Farmer / Specialist / Farm Operations
                |
       SARINA Core + SCI
                |
       SAI Knowledge Gateway
                |
  +-------------+------------------+
  |             |                  |
Farm & Case   Validated          Knowledge
History       Knowledge          Governance
  |             |                  |
  +------ Evidence & Context ------+
                |
     Retrieval / Similarity / Rules
                |
       Internal Decision Support
                |
     Confidence & Risk Assessment
          /             \
  Known, safe case     Novel / uncertain /
  with evidence        high-risk case
        |                    |
 Internal response     SCI Task Router
                             |
                   Approved external tools
                   (Manus / Claude / OpenAI /
                    local models / specialists)
                             |
                   Proposed analysis only
                             |
                  Review + outcome capture
                             |
                    SAI validation pipeline
```

SAI is a knowledge and evidence capability, not a replacement for SCI, the policy engine, task manager, specialist workflow, or provider adapters. SCI remains responsible for task routing and execution controls. SAI supplies grounded internal knowledge and receives validated outcomes.

## 4. Core capabilities

### 4.1 Farm and case history
Maintain structured, time-aware records of:
- Farm location and relevant environmental context
- Crop, cultivar, planting date, growth stage, and production system
- Soil observations and laboratory results
- Irrigation source, water quality, schedule, and applied quantities
- Weather and seasonal conditions
- Inputs and interventions, including product, dose, date, method, and operator where available
- Symptoms, images, diagnoses, specialist assessments, and uncertainty
- Measured outcomes over defined follow-up periods

Records must distinguish measured values, farmer-reported observations, imported datasets, and inferred values.

### 4.2 Validated knowledge repository
Store reusable knowledge units such as:
- Reviewed case studies
- Context-bounded recommendations
- Agronomic rules and decision tables
- Treatment/outcome evidence
- Known failure modes and contraindications
- Specialist-reviewed FAQs and operational procedures

Each knowledge unit should include:
- Unique ID and version
- Crop/problem and applicability conditions
- Required context and exclusions
- Evidence references and provenance
- Review state: draft, pending review, approved, deprecated, or rejected
- Reviewer/authority and review timestamp where applicable
- Confidence/evidence grade and known limitations
- Validity period and re-evaluation trigger

### 4.3 Similarity and retrieval
Retrieve comparable cases using structured filters first (crop, stage, soil, water, climate, geography, intervention, and time), then semantic similarity where useful. Similarity must not be presented as proof of equivalence. The system must expose key differences between the current farm and retrieved cases.

### 4.4 Internal decision support
For sufficiently understood tasks, prefer deterministic rules, validated lookup tables, calculators, statistical baselines, and locally hosted models where appropriate. Return the supporting evidence, applicability conditions, confidence, and escalation reason—not just an answer.

### 4.5 Outcome and learning pipeline
Capture whether the farmer followed a recommendation, what was actually applied, deviations, follow-up measurements, and outcomes. Separate correlation from causation. Failed and inconclusive cases are valuable evidence and must not be discarded.

### 4.6 Expert review and knowledge governance
Provide a review queue for specialists to validate, correct, qualify, reject, or retire proposed knowledge. Preserve prior versions and audit every promotion or change.

## 5. Knowledge lifecycle

1. **Capture:** ingest authorized farm data, observations, interventions, and outcomes.
2. **Normalize:** standardize units, dates, crop terminology, locations, and source types while preserving original values.
3. **Contextualize:** attach relevant soil, water, climate, crop-stage, and management context.
4. **Detect:** identify recurring patterns and candidate similar cases.
5. **Propose:** create a candidate rule, case summary, or hypothesis with evidence links.
6. **Validate:** run data-quality checks, contradiction checks, sample-size checks, and specialist review according to risk.
7. **Publish:** promote only approved, versioned knowledge into the trusted repository.
8. **Apply:** retrieve knowledge with applicability checks, confidence and risk gates.
9. **Observe:** capture adoption, deviations, and measured results.
10. **Re-evaluate:** monitor drift, contradictory evidence, and expiry; revise or deprecate knowledge with an audit trail.

## 6. Internal-versus-external routing policy

| Task class | Preferred route | External AI use |
|---|---|---|
| Repeated, validated, low-risk FAQ or workflow | Internal retrieval/rules | Normally unnecessary |
| Standard calculation with known inputs | Deterministic internal calculator | Not needed |
| Similar historical case with strong context match | SAI retrieval + evidence | Optional summarization only |
| New or poorly documented problem | Specialist + SCI; approved model assistance | May be useful |
| Complex research or market investigation | Appropriate specialist workflow / Manus | As authorized |
| Conflicting evidence or high-risk agronomic decision | Human expert review | Supporting opinion only |
| Provider outage or budget threshold reached | Internal capability or safe deferral | Switch only to an approved equivalent |

Fallback must not silently lower safety or quality. If no equivalent route exists, SARINA should explain the limitation and defer or escalate the task.

## 7. Trust, confidence, and safety gates

- Confidence must be calibrated against observed outcomes, not generated by a language model alone.
- Retrieval similarity, evidence quality, model confidence, and decision risk are separate signals.
- A high similarity score cannot override a missing critical field or a contraindication.
- Recommendations must state when the evidence does not cover the user's conditions.
- High-risk recommendations must follow specialist review and explicit confirmation policies.
- No autonomous purchasing, chemical application, irrigation actuation, or other consequential field action is authorized by SAI alone.
- Contradictory evidence should trigger review, not automatic averaging into a new rule.

## 8. Suggested logical data domains

These are conceptual domains, not a committed database schema or migration:

- `farm_context`: farm, plot, crop cycle, environmental context
- `observations`: symptoms, measurements, images, source and timestamp
- `interventions`: action, input, quantity, method, date, operator
- `outcomes`: follow-up measures, yield/quality where available, deviations
- `knowledge_cases`: normalized, reusable case records
- `knowledge_units`: rules, recommendations, evidence summaries, limitations
- `knowledge_evidence`: links from knowledge to source records and studies
- `knowledge_reviews`: expert decisions, rationale, reviewer and timestamps
- `knowledge_versions`: immutable version history and deprecation events
- `retrieval_audit`: retrieved knowledge, context match, exclusions and final use
- `learning_candidates`: unapproved patterns awaiting validation

Any physical schema must later be designed against existing SARINA tables, tenancy boundaries, RLS policies, retention rules, and data-quality constraints. This document does not authorize a database migration.

## 9. Success measures

Measure progress by task category, not by a single global automation percentage:
- Share of recurring tasks resolved using approved internal knowledge
- External provider calls and cost per completed task
- Resolution quality and specialist override rate
- Outcome success rate with follow-up completeness
- Rate of incorrect matches and unsafe applicability
- Time from candidate discovery to expert validation
- Coverage across crops, regions, seasons, and farm conditions
- Provider-outage resilience and safe deferral rate

A reduction in API calls is only a success if quality, safety, and farmer outcomes remain stable or improve.

## 10. Phased delivery plan

### Phase 0 — Inventory and data foundations
Map existing farm, conversation, specialist, intervention, and outcome data. Identify missing links, duplicate concepts, access boundaries, and data-quality gaps. Do not create a parallel source of truth.

**Exit criteria:** reviewed data map, ownership boundaries, source-of-truth decisions, and privacy/RLS gap list.

### Phase 1 — Evidence-backed case history
Define canonical case and outcome contracts; connect existing records through controlled read paths; add provenance and audit requirements.

**Exit criteria:** representative cases can be reconstructed with context, intervention, follow-up, and source provenance.

### Phase 2 — Read-only knowledge retrieval
Build structured filters and case retrieval; show match reasons and differences; keep suggestions advisory and read-only.

**Exit criteria:** evaluated retrieval quality on a reviewed test set; no autonomous knowledge promotion.

### Phase 3 — Expert-reviewed knowledge publishing
Introduce candidate queues, review states, versioning, contradiction handling, and deprecation.

**Exit criteria:** only authorized reviewers can publish; every published unit is traceable and reversible.

### Phase 4 — Internal decision support
Add deterministic calculators, validated rules, and low-risk workflows. Route uncertain or high-risk cases to specialists.

**Exit criteria:** per-task acceptance tests demonstrate safe applicability, calibrated escalation, and measurable quality.

### Phase 5 — Progressive provider independence
Integrate SAI with SCI routing and provider management. Prefer internal paths for eligible tasks; use external providers only when justified by task, quality, availability, and approved budgets.

**Exit criteria:** provider outage and budget-exhaustion tests prove that internal tasks continue and unsupported tasks safely defer.

## 11. First implementation task

The first engineering task is an **SAI readiness and data-lineage inventory**, not model training and not a new database migration. Inspect current SARINA schemas, RLS, farmer records, specialist cases, chat references, and any existing knowledge or analytics modules. Produce a gap report and a minimal integration proposal before changing production data structures.

## 12. Explicit non-goals

- Training a foundation model as the first step
- Treating conversation transcripts as verified agricultural knowledge
- Automatically learning from unreviewed AI answers
- Replacing qualified agronomists
- Promising universal or complete self-sufficiency
- Creating paid provider dependencies
- Making database, deployment, or production changes through this design document

---

**Strategic outcome:** SARINA should become progressively more capable from its own verified agricultural experience, while retaining the ability to consult, compare, replace, or completely disconnect external AI providers without losing its core knowledge or operational control.
