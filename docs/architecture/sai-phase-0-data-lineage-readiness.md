# SAI Phase 0 — Data Lineage & Readiness Audit

**Status:** Initial repository/schema audit completed; implementation planning only  
**Date:** 2026-11-25  
**Target branch:** `feature/farmer-portal-foundation`  
**Production changes:** None. No migration, RLS policy, Edge Function, deployment, secret, or provider setting was changed.

## 1. Executive finding

SARINA already contains much of the domain foundation needed for SARINA Agricultural Intelligence (SAI). The first implementation should connect and govern existing records rather than create a second farm-history system.

The existing productivity domain is especially relevant: baselines, measurements, contextual observations, improvement plans/actions, outcome reviews, candidate signals, and knowledge candidates are already represented in the schema. Farm soil/water tests, irrigation events, crop cycles, observations, recommendations, recommendation actions, and specialist case records provide additional evidence sources.

This is a schema-level readiness finding, not proof that the end-to-end workflow is complete or populated with real farm evidence. The current inspected project returned zero rows for the principal operational farm and productivity tables; the metric definition/rule tables contain seeded definitions. Actual data volume and quality must be rechecked before any retrieval quality claim.

## 2. Existing data source map

| Domain | Existing source | SAI use | Important limitation |
|---|---|---|---|
| Farm identity and ownership | `farms`, `farm_fields`, `users` | Tenant boundary, farm/field scope | Must use canonical owner and authorization helpers; never infer ownership |
| Crop and season | `crop_cycles` | Crop, variety, dates, cycle scope | Growth stage and production system may need additional structured capture |
| Soil | `soil_tests` | Texture, pH, EC, organic matter, nutrients, carbonate | Sampling depth, method, lab/source quality must travel with values |
| Water | `water_tests` | Source, EC/TDS, ions, SAR, boron | Sample date and method are essential; do not treat missing values as zero |
| Irrigation | `irrigation_events` | Method, source, timing, volume, duration | Event completeness and units need validation |
| Field observations | `farm_observations` | Symptoms, severity, images, timestamp | Reports are observations, not verified diagnoses |
| AI interaction | `ai_conversations`, `ai_messages`, `ai_analysis_runs` | Discovery of questions, analyses and provenance pointers | Raw model output is untrusted and must not become approved knowledge |
| Recommendations | `farm_recommendations`, `recommendation_actions` | Proposed advice and farmer action/adoption trail | Recommendation, action taken and outcome must remain distinct |
| Productivity | `farm_productivity_metric_definitions`, `farm_productivity_measurements`, `farm_productivity_baselines`, `farm_productivity_benchmarks` | Comparable measurements and baselines | Unit, period, field/cycle, method and source must match |
| Improvement workflow | `farm_improvement_plans`, `farm_improvement_actions` | Intervention plan, actual status, cost and outcome notes | Planned actions are not evidence that an action occurred |
| Outcome evaluation | `farm_productivity_outcome_reviews`, `farm_productivity_candidate_signals` | Review result, attribution, evidence quality and follow-up | Existing evaluator explicitly warns that observed change is not causal proof |
| Context history | `farm_productivity_context_observations` | Climate, water, inputs, soil, crop-health and management context | Context analysis is descriptive; missing context is not absence |
| Knowledge intake | `farm_productivity_knowledge_candidates` | Candidate contributions for later governance | Approval requires anonymization and farmer consent; expert consent is required for expert-led/joint contributions |
| Specialist workflow | `expert_requests`, `expert_consultation_messages`, `expert_case_notes`, `expert_case_conversation_facts`, `expert_recommendation_actions` | Human diagnosis, reviewed facts and interventions | Human case history must remain distinct from AI assistant messages; reviewer/status/provenance matter |

## 3. Existing governance and safety controls

The inspected migrations establish several useful controls:

- Productivity outcome reviews and candidate signals are admin-governed, with farmer/authority read paths where explicitly allowed.
- The knowledge-candidate table has states including candidate, in_review, approved, rejected and restricted.
- An approved knowledge candidate requires farmer consent and anonymization; expert-led or joint contributions additionally require expert consent.
- Productivity evaluation uses comparable scope and units and filters low-quality measurements. Its own evidence notes explicitly reject causal attribution from metric movement alone.
- Context analysis records missing domains and explicitly states that co-occurrence does not establish causality.
- Specialist cases have participant/assigned-expert access policies and distinct review state.

These controls are foundations, not a complete SAI governance layer. Before implementation, verify every relevant RLS policy, grants, role helper, storage-object policy and Edge Function authorization path in the target branch and live project.

## 4. Data lineage — proposed canonical flow

```text
Farmer / Farm Operations ─┐
Specialist case + review ─┼─> Existing domain records
AI analysis (untrusted) ──┘          |
                                    v
                          SAI evidence assembler
                                    |
                         normalize + validate context
                                    |
                         case / outcome reconstruction
                                    |
                           candidate knowledge unit
                                    |
                      consent + anonymization + review
                                    |
                        approved, versioned knowledge
                                    |
                       read-only retrieval for SCI
                                    |
                    outcome follow-up and re-evaluation
```

The source records remain canonical. SAI should store references and versioned derived artifacts, not duplicate all farmer records into a second database.

## 5. Identified gaps to resolve

1. **Canonical intervention linkage:** verify that every recommendation, farmer action, expert action, input application and follow-up can be connected to the same farm/field/crop-cycle and time window. Existing links are partial and distributed across multiple tables.
2. **Case reconstruction contract:** define a stable evidence envelope with source IDs, source type, timestamps, units, confidence/quality and access scope.
3. **Crop-stage/context coverage:** confirm structured coverage for growth stage, cultivar, production system, weather period, management practices and sampling depth. Do not infer missing values.
4. **Outcome attribution:** preserve farmer-reported, measured, laboratory, official, remote-estimate, modelled and inferred sources as distinct categories. Correlation must not be described as treatment effect.
5. **Knowledge governance:** formalize reviewer authority, review rationale, immutable versions, expiry/revalidation and contradiction handling. Existing candidate status alone is not the full versioned knowledge repository.
6. **Privacy and consent:** verify the intended purpose, farmer consent, expert consent, anonymization quality, revocation behavior, retention and cross-farm aggregation policy.
7. **RLS and service access:** perform a policy-by-policy audit for all source tables and any future SAI tables. RLS enabled alone does not prove safe access.
8. **Data readiness:** the live schema inspection showed no operational records in the principal farm/productivity tables at audit time. Validate real data and representative complete cases before setting retrieval thresholds.
9. **AI transcript boundary:** AI messages and model outputs may help locate evidence, but only verified facts and reviewed conclusions may be promoted.
10. **Operational observability:** add audit records for which evidence was assembled, excluded, retrieved, shown and relied upon by a response.

## 6. Minimal integration proposal

### Reuse now
- Use existing farm, field, crop-cycle, soil, water, irrigation, observation and productivity records as source-of-truth data.
- Use existing recommendation and improvement workflows to reconstruct proposed vs. performed actions.
- Use existing outcome review and knowledge-candidate governance as the initial human review intake, subject to the gap fixes below.
- Use specialist reviewed facts and recommendations as separate evidence sources.

### Add only after contract and RLS review
- A typed, versioned SAI case/evidence envelope (initially application-level JSON schema and tests; no new production table required).
- A read-only evidence assembler that returns only records authorized for the requesting farmer/specialist/admin.
- A candidate validator that checks completeness, units, provenance, consent and risk before a case can enter the review queue.
- Retrieval audit events and immutable knowledge-version records, if no existing equivalent is found during the full schema/policy audit.

### Explicitly do not do in Phase 0
- No new vector database or embeddings requirement.
- No foundation-model training or fine-tuning.
- No automatic promotion of AI output.
- No cross-farm training/aggregation without valid consent and anonymization.
- No direct database access for external AI providers.
- No production schema changes, RLS changes or deployments.

## 7. Phase 0 exit criteria

Phase 0 is considered complete only when:

- [ ] Every source table and relevant foreign-key path is mapped and reviewed.
- [ ] RLS policies and grants are inspected for all source tables, including indirect joins and storage references.
- [ ] A representative case can be reconstructed from baseline/context through intervention, follow-up and outcome with provenance.
- [ ] Data quality rules exist for units, dates, crop/field scope, source type and missing values.
- [ ] Farmer and expert consent, anonymization and revocation behavior are verified.
- [ ] The canonical SAI evidence contract is versioned and covered by tests.
- [ ] No duplicate source-of-truth table is introduced.
- [ ] Security and privacy review approves the read-only integration design.

## 8. Next engineering sequence

1. Complete the table/foreign-key/RLS/grant inventory for all source domains.
2. Publish and test the canonical case/evidence contract.
3. Build a read-only evidence assembler behind authenticated, least-privilege server-side access.
4. Create a small, consented, expert-reviewed evaluation set.
5. Measure reconstruction completeness and retrieval precision before exposing any SAI-derived advice.

**Current conclusion:** SARINA has a substantial data foundation for SAI, but it is not yet an operational knowledge engine. The safest next step is a read-only, provenance-preserving integration layer followed by measured expert-reviewed retrieval.
