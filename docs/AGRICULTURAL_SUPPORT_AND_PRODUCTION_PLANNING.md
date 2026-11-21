# SARINA Agricultural Support, Production Planning & Regional Forecasting

**Status:** Approved product direction; architecture and data design only. No schema, policy, production data, UI, RPC, Edge Function, or deployment change is made by this document.
**Design branch:** `design/agricultural-support-production-planning`
**Scope:** Extend the existing farm-productivity and organizational foundations. Do not create a parallel farm, crop, productivity, organization, or document system.

## 1. Executive decision

Add a first-class organizational capability named **Agricultural Support & Production Planning** (`agricultural_support`) to SARINA.

It connects five activities:

1. Register a verified public support program and its published eligibility, purpose, conditions, and delivery rules.
2. Record the support actually allocated to a specific farmer, farm, field, and crop cycle.
3. Record utilization, implementation, return, transfer, and other permitted dispositions with evidence.
4. Set a transparent, context-adjusted production expectation and monitor crop progress and actual harvest.
5. Aggregate validated farm-level observations into county/provincial production forecasts and evaluate support effectiveness.

The capability is a decision-support and traceability layer. It does not replace the authority's grant/benefit system, CRM, legal process, inspection powers, procurement process, or final decisions.

## 2. Live architecture audit — findings and boundaries

The linked Supabase project is healthy (Postgres 17) and currently hosted in `ap-northeast-2`. The inspected public schema contains 149 tables. RLS is enabled on the application tables inspected; `spatial_ref_sys` is a pre-existing extension/system exception and is outside this module.

### Existing foundations to reuse

- Farm identity and ownership: `farms`, `farm_fields`, `farm_locations`.
- Crop and season context: `crop_catalog`, `crop_varieties`, `crop_cycles`.
- Agronomic context: `soil_tests`, `water_tests`, `irrigation_events`, `crop_activities`, `farm_observations`, `weather_records`.
- Productivity: `farm_productivity_metric_definitions`, `farm_productivity_measurements`, `farm_productivity_baselines`, `farm_productivity_benchmarks`, `farm_improvement_plans`, `farm_improvement_actions`.
- Reviewed outcomes and learning: `farm_productivity_outcome_reviews`, `farm_productivity_context_observations`, `farm_productivity_candidate_signals`, `farm_productivity_knowledge_candidates`.
- Organization and governance: `organizations`, `organization_members`, `organization_capabilities`, `organization_access_scopes`, `organization_audit_events`, `organization_services`.
- Farmer documents and regional autonomy: `farm_documents`, `deployment_regions`, `regional_data_transfer_consents`, `regional_sync_outbox`, `regional_sync_inbox`, `regional_sync_projections`, `regional_sync_audit_events`.

The existing productivity model already supports dated, sourced, unit-aware measurements; versioned baselines; curated benchmarks; improvement plans/actions; evidence quality; confidence; contextual observations; and human-reviewed outcome lanes. The authority oversight foundation already requires a verified organization, a separately enabled `oversight.productivity.read` capability, matching organization scope, and an active farmer-controlled consent before exposing individual farm productivity outcomes.

### Confirmed gap

The inspected live schema has no dedicated domain record for:
- a public support program and its versioned terms;
- an individual support allocation/delivery to a farm/crop cycle;
- evidence-backed utilization or permitted disposition of that allocation;
- a support-linked production target/expectation;
- a structured human review of a support-condition discrepancy;
- a versioned county/provincial production forecast and its aggregation lineage.

Do not overload `organization_services` or `institutional_service_requests` as grant ledgers. They describe institutional services and requests, not the financial/material lifecycle of a support allocation.

### Deployment and source-control boundary

The live Supabase project is a hosted international-region project, not yet the planned independent Iranian regional deployment. The existing regional tables are a useful foundation, not proof that domestic failover and production synchronization are operational. Keep farmer-identifiable support records in their authoritative home region; publish only approved aggregate projections across regions.

The repository's GitHub default branch currently points to `feature/farmer-portal-foundation`, while the recent integrated product documentation and UI are on `main`. New work must branch from the verified current `main` head, not from the stale default branch. The live Supabase migration history is ahead of the small migration set on the default branch; do not use that branch as the source of truth for schema changes.

## 3. Domain boundaries and data ownership

| Domain | System of record | This module's role |
|---|---|---|
| Farmer, farm, field, crop cycle | Existing SARINA farm domain | Reference by stable IDs; do not duplicate |
| Support program definition and official terms | Verified authority record in SARINA, sourced from official program documentation | Version, publish, and expose the approved program definition |
| Support allocation and evidence | New support domain records | Track what was actually allocated/delivered, to whom, when, where, and under which terms |
| Productivity observations and harvest measurements | Existing productivity measurement domain | Reuse and extend metric definitions only where a genuine metric gap exists |
| Production expectation | New versioned target/expectation record | Store estimate range, minimum planning threshold, method, assumptions, and approval status |
| Outcome assessment | Existing productivity outcome review plus a support-specific review link | Human review; no automated finding of misconduct |
| Organization hierarchy and access | Existing organization/capability/scope system | Enforce verified identity, capability, scope, and purpose-specific consent |
| Regional forecast | New aggregate forecast domain | Store model runs, inputs, provenance, uncertainty, and aggregate outputs |

An allocation must identify the exact program version and the target farm/field/crop cycle. A farmer may receive several different support items in one season; each must be separately traceable. A program-level budget is not evidence that an individual farmer received support.

## 4. Proposed lifecycle

### A. Program registration and publication

A central SARINA administrator verifies the issuing authority and source documents, then registers:
- program code, official name, issuing body, jurisdiction and valid dates;
- crop/region/season eligibility;
- support type (cash, seed, fertilizer, machinery, irrigation service, insurance, credit, training, or other);
- unit, quantity/value, currency, delivery method and intended use;
- published conditions, evidence requirements, return/transfer/resale restrictions if any, and the official legal/contractual basis;
- program version, source URL/document, verifier and publication status.

Only verified and published program versions may be used for live allocations. The system must preserve the version accepted at allocation time even if program terms later change.

### B. Allocation and farmer acknowledgement

An authorized organization member records the approved allocation and delivery event. The record captures:
- farmer, farm, field (where relevant), crop cycle, program and program version;
- support item, quantity, unit, declared value/currency, approval date, actual delivery date;
- issuer, delivering organization, official reference, delivery method and evidence;
- farmer acknowledgement or a recorded reason why acknowledgement is unavailable;
- the precise conditions applicable to this allocation.

The system must distinguish **approved**, **dispatched**, **delivered**, **partially delivered**, **rejected**, **cancelled**, and **disputed**. An approved allocation is not automatically a delivered benefit.

### C. Utilization and evidence

The farmer can record use through low-friction choices, optional photographs/documents, dates, quantities, and crop/field association. Authorized staff may add inspection observations. Each event records source, actor, timestamp, quantity/unit, evidence references, quality, and review state.

Permitted dispositions are program-specific: used as intended, stored for later use, returned, damaged/expired, transferred with authorization, or another explicitly permitted outcome. A sale or transfer is a discrepancy only if the accepted program terms or applicable law prohibit it. SARINA must never infer a violation merely because a farmer sold a product or because a utilization record is missing.

### D. Production expectation and monitoring

For each eligible crop cycle, SARINA calculates a transparent **expected production range** and, when an approved program rule calls for it, a **minimum planning threshold**. Display:
- low / central / high estimate (with units and denominator);
- threshold, if one is explicitly authorized;
- estimate confidence and evidence completeness;
- calculation method/version, benchmark source and assumptions;
- factors that can materially change the estimate;
- date of last update and next review point.

The minimum threshold is a planning/monitoring reference by default, not a legal obligation or a penalty trigger. It becomes a formal commitment only when a competent authority has supplied an applicable legal/contractual basis, the farmer has been informed, and the relevant authorized workflow records acceptance.

Inputs include planted area and confirmed field boundary where available, crop/variety, planting date and crop stage, production system, soil/water tests, irrigation availability, weather and extreme events, input availability, support type/quantity/delivery date, farm history, comparable regional benchmarks, pest/disease pressure, and farmer/expert observations.

Support must not mechanically translate into a fixed yield increase. A fertilizer allocation, machinery service, seed package, cash grant, or training activity has different mechanisms and time horizons. The model should estimate the effect only where credible evidence exists; otherwise it should show a baseline expectation and list the support as a contextual factor, not claim an attributable uplift.

### E. Harvest and actual production

Use the existing `farm_productivity_measurements` record with crop-cycle/field references for measured yield and production metrics. Each actual figure must preserve source type (farmer report, scale/weigh ticket, buyer receipt, official report, field measurement, remote estimate, or modelled estimate), unit, period, evidence reference, quality and confidence.

Do not treat a farmer-entered value as officially verified. Where possible, record both total harvested quantity and normalized yield per hectare; keep gross, marketable, rejected, stored, sold and lost quantities distinct when the evidence supports them. Never double-count multiple sales of the same harvest lot as additional production.

### F. Discrepancy review and fair resolution

A rule may create a **review signal**, not a verdict. Examples:
- recorded delivery with no later utilization evidence where the program requires it;
- quantity mismatch beyond an approved tolerance;
- support assigned to a crop cycle/field different from the authorized one;
- a declared transfer or sale that conflicts with explicit program terms;
- actual output materially below the expectation after accounting for relevant conditions.

Every signal must include the rule/version, facts, source records, uncertainty, missing evidence, and a farmer-friendly explanation. The farmer must be able to provide context and supporting evidence. Review states: open, information requested, farmer responded, field verification requested, under review, resolved/no issue, confirmed program discrepancy, referred to competent authority, or closed. Only an authorized human reviewer may set a final review outcome. SARINA does not impose sanctions, recover benefits, suspend eligibility, or label a farmer as fraudulent.

Before a low-yield signal is escalated, consider drought, heat, flood, water interruption/quality, pest, disease, input delay, crop failure, marketable-grade rejection, field boundary error, force majeure, and data quality. If evidence is insufficient, use `insufficient_evidence` and request measurements rather than assigning blame.

## 5. Proposed logical data model (design only; no migration yet)

The following are proposed new tables. Names are provisional until a schema diff confirms no equivalent object exists on the selected development branch and live database.

1. **`agricultural_support_programs`** — issuing organization, jurisdiction, program code, source, validity dates, publication state, current version pointer.
2. **`agricultural_support_program_versions`** — immutable versioned terms, eligibility, support types, allowed/prohibited dispositions, evidence requirements, legal basis, source documents and approval metadata.
3. **`farm_support_allocations`** — program/version, farmer/farm/field/crop cycle, item, quantity/unit/value, approval and delivery lifecycle, official reference, acknowledgement and responsible organization.
4. **`farm_support_utilization_events`** — allocation, event type, quantity/unit, event date, actor, evidence references, source/quality and review state.
5. **`farm_production_expectations`** — crop cycle, linked support allocation(s), baseline ID, expected low/central/high production, optional minimum planning threshold, units/denominator, methodology version, assumptions, confidence, evidence completeness, validity and approval status.
6. **`farm_support_review_cases`** — allocation/expectation/signal references, reason code, rule version, facts and evidence snapshot, farmer response, review status, reviewer, resolution and audit timestamps.
7. **`regional_production_forecast_runs`** — geographic scope, crop/season, model/method version, input cutoff, generated time, scenario, quality gates and forecast status.
8. **`regional_production_forecast_items`** — forecast run, region, crop/season, planted/harvested area, low/central/high quantity, unit, confidence, contributing farm count, coverage and suppressed-small-cell flag.

Use foreign keys to existing `organizations`, `farms`, `farm_fields`, `crop_cycles`, `farm_productivity_baselines`, `farm_productivity_measurements`, and `farm_documents` where applicable. Store structured numeric values with explicit units and currency codes; do not bury core query dimensions in JSON. JSON is appropriate for versioned assumptions/evidence snapshots, not for ownership, authorization, quantities, or statuses.

Before adding a separate harvest-lot table, test whether existing productivity measurement semantics plus evidence references are sufficient. Prefer one authoritative harvest measurement and link buyer/delivery documents to it, rather than maintaining two conflicting production totals.

## 6. Forecasting methodology

Regional forecasts must be built from deduplicated crop-cycle/field records and calibrated, comparable yield data—not by multiplying an arbitrary average by every registered farm's total area.

At minimum calculate:
- planted area, confirmed/estimated area coverage, and crop-cycle status;
- harvested area versus planted area;
- expected yield distribution by crop, variety where relevant, season, production system and agro-climatic context;
- expected production = eligible area × expected yield, with explicit assumptions;
- low/base/high scenarios and uncertainty interval;
- observed/verified harvest to date and remaining expected production;
- source coverage, last update, sample size, and the share of records with low/unknown quality.

Exclude cancelled or duplicate crop cycles and non-overlapping field areas. Resolve overlapping farm/field polygons and duplicate farmer declarations before aggregation. Do not assume a farm's total area is planted with the same crop. Distinguish registered, intended, planted, failed, harvested and verified-harvested areas.

Forecasts are versioned snapshots, not silently overwritten values. Each run stores model version, input cutoff and data lineage. Recompute on material changes (weather event, verified planted-area update, crop failure, major irrigation disruption, new harvest evidence) and on a defined schedule. Show differences from the prior run and explain the main drivers.

For provincial/county dashboards, aggregate by crop, season and official geographic code. Apply minimum group-size/privacy thresholds; suppress or combine small cells where a single farm could be inferred. Share only aggregate projections across regional boundaries unless a separate lawful purpose and consent authorize individual data transfer.

## 7. Support effectiveness evaluation

Evaluate support programs using a transparent outcome framework:
- number of eligible and served farms;
- approved versus actually delivered support;
- utilization evidence completeness;
- planted/harvested area coverage;
- yield and marketable-output changes against comparable baselines;
- water, fertilizer, energy and labor efficiency where measurable;
- cost per additional unit of marketable output, with caveats;
- farmer satisfaction and time-to-delivery;
- distribution by crop, county and farm scale.

Do not claim causality from a simple before/after difference. Where enough comparable observations exist, use matched comparison groups, difference-in-differences or another reviewed method; publish assumptions and confidence. Otherwise label results as descriptive association. Distinguish the total value of support delivered from incremental output plausibly associated with the program.

## 8. Organization workspace and farmer experience

### Farmer workspace
- “حمایت‌های دریافتی من”: program, item, quantity, delivery state, applicable terms and official reference.
- “ثبت نحوه استفاده”: simple selectable event types, quantities, date, optional photo/document and explanation.
- “برنامه تولید مزرعه”: estimate range, optional threshold, assumptions and confidence.
- “ثبت برداشت”: quantity, area, grade, loss, evidence and source.
- “درخواست اصلاح اطلاعات”: dispute delivery, quantity, field assignment or program terms.
- Clear explanation of who can see each record and why; show consent and revoke controls where applicable.

### Authority workspace
- Program registry and version approval.
- Allocation and delivery register.
- Pending utilization/evidence queue.
- Production expectation and forecast dashboard.
- Review queue with priority and waiting time.
- County/province aggregate forecast and coverage.
- Program effectiveness and delivery-delay analysis.
- Exportable reports with source, period, denominator, confidence and limitations.

The authority dashboard must not become an unrestricted farm dossier. Use existing verified-organization membership/capability/scope controls and add purpose-specific access rules. A county user sees only their approved county scope; provincial users see approved provincial aggregates by default. Identifiable farm follow-up requires a separate farmer-controlled purpose-specific consent and an approved geographic scope. Existing `farm_productivity_authority_consents` must not be silently repurposed as blanket consent for support allocation, compliance review, or unrelated official uses.

## 9. Security, audit and privacy requirements

- RLS on every new table; no public/anon read or write.
- Verify organization membership, enabled capability, active geographic scope, target farm, program authority and purpose at the database boundary—not only in UI.
- Separate capabilities, for example: `support.programs.manage`, `support.allocations.read`, `support.allocations.write`, `support.reviews.manage`, `support.forecasts.read`, `support.reports.export`. Grant only after organization verification and official role validation.
- Farmer writes are restricted to farms they own; organization writes require a specific authorized allocation role and scope.
- A user cannot approve their own allocation, resolve their own discrepancy review, or alter an approved program version without a separately authorized role.
- Append-only audit events for program publication/version changes, allocation approvals/delivery, utilization evidence changes, expectation approval, review decisions, exports and consent changes. Corrections should be compensating events or versioned amendments, not silent edits.
- Use least-privilege grants and explicit column access. Never expose service-role credentials to the browser.
- Any view exposed through the Data API must use `security_invoker` where appropriate and be tested against RLS. Security-definer RPCs require a separate review, fixed search path, explicit authorization and narrowly granted execution.
- Evidence documents reuse private `farm_documents` storage with object-level authorization; do not create public buckets for support proofs.
- Log access and export events; do not include unnecessary personal details in analytics logs.

## 10. Regional autonomy and synchronization

- The farmer's home region remains authoritative for identifiable farm, allocation, utilization and review records.
- Do not synchronously depend on the international region for domestic farmer workflows.
- Regional sync carries only explicitly approved, versioned aggregate events/projections by default. Individual farm data is not synchronized merely because an authority dashboard exists.
- Use existing outbox/inbox, idempotency, schema-version, consent and audit foundations. Define a new aggregate type only after its payload classification and cross-region purpose are approved.
- During international connectivity loss, domestic allocation recording and farmer evidence capture should continue in the domestic deployment; aggregate publication can be delayed and replayed safely.
- The current hosted Supabase project in `ap-northeast-2` is a development/international foundation, not proof of Iranian regional autonomy. A domestic production deployment, backup/restore exercise, secret management, monitoring, DNS and failover remain separate release gates.

## 11. Phased implementation plan

**Phase 0 — Governance and data contract**
- Confirm which authority and official programs are in scope.
- Obtain official program terms, eligibility, delivery evidence, geographic jurisdiction, legal basis and retention rules.
- Define official geographic codes and crop/season identifiers.
- Agree what constitutes delivery, utilization evidence, prohibited transfer/resale and formal production commitment.
- Approve farmer notices, consent wording, dispute route and human review authority.

**Phase 1 — Support registry and allocation ledger**
- Add program/version and allocation records.
- Add narrow RLS, grants, audit events and automated negative tests.
- Implement central-admin program registry and authorized allocation workflow.
- Keep utilization and production targets read-only/not yet enabled until Phase 1 security tests pass.

**Phase 2 — Farmer evidence and utilization**
- Add farmer-friendly utilization records and private document evidence.
- Add correction/dispute request flow and organization review queue.
- Test ownership, scope, consent revocation, evidence access and audit integrity.

**Phase 3 — Production expectations**
- Integrate crop-cycle context, productivity baseline, benchmarks and measurements.
- Start with explainable rule-based ranges; do not deploy opaque ML as the first estimator.
- Require expert/authority approval for any threshold presented as a formal program commitment.
- Run a shadow evaluation against historical seasons before displaying live forecasts.

**Phase 4 — County/provincial forecasting**
- Deduplicate planted areas and validate source quality.
- Generate low/base/high forecasts with coverage and uncertainty.
- Start with aggregate read-only dashboards; no farm-level drill-down by default.
- Compare forecast with harvest evidence and record forecast error.

**Phase 5 — Support effectiveness and controlled pilot**
- Evaluate delivery timeliness, utilization and measured outcomes.
- Use comparison methods only when sample size and comparability permit.
- Pilot in one approved county/crop program before expanding to provincial reporting.

## 12. Required acceptance and release gates

1. A program cannot be used unless its issuing authority, source, legal/contractual basis, validity and version are verified.
2. Approved allocation and actual delivery are separate states and separately evidenced.
3. Every allocation links to one farm and, where relevant, a field and crop cycle.
4. Farmers can see applicable terms, acknowledge delivery, add evidence, and request correction.
5. No discrepancy is automatically classified as fraud or misuse.
6. The farmer can provide a response before a human review is finalized.
7. Low-yield reviews account for adverse weather, water, pest/disease, crop failure, and evidence quality.
8. Expected production displays a range, method, assumptions, confidence and date; missing inputs reduce confidence rather than becoming zero.
9. A formal minimum threshold is never displayed as a legal obligation without an approved basis and recorded acceptance.
10. County/provincial forecasts prevent area double-counting and expose source coverage, sample size and uncertainty.
11. Aggregate outputs suppress small cells and do not expose identifiable farms by inference.
12. RLS tests cover owner, unauthorized farmer, verified organization in-scope, verified organization out-of-scope, unverified organization, revoked consent, expired membership, and central administrator.
13. A user cannot self-approve an allocation or finalize a review they created.
14. Cross-region synchronization contains only approved payload categories and is idempotent.
15. Backup/restore and isolated migration testing pass before any production schema change.

## 13. Explicit non-goals and prohibitions

- No automated accusation, fraud score, punishment, blacklisting or benefit suspension.
- No presumption that support caused a fixed production increase.
- No blanket authority access to all farmer files.
- No use of forecast targets as legal commitments without formal authority and farmer notice/acceptance.
- No duplicate farm/crop/productivity/organization/document databases.
- No fabricated official program terms, yield benchmarks, geographic boundaries or crop area.
- No production migration or data write as part of this design document.

## 14. Pilot recommendation

Use the already selected Khuzestan / Abadan pilot boundary as a **candidate product pilot**, subject to formal confirmation of the participating authority, official crop/program data, geographic codes and responsible reviewers. Begin with one crop and one support program whose terms and delivery evidence can be verified. The first pilot should be read-only for aggregate forecasting after the allocation ledger and farmer evidence flows pass security tests.

**Success measures:** allocation-to-delivery traceability; evidence completeness; time from allocation to acknowledgement; share of crop cycles with a defensible expectation; forecast error by crop/season; discrepancy resolution time; farmer correction rate; support delivery timeliness; and measurable, appropriately qualified productivity outcomes.
