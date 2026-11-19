# SARINA Farm Productivity Impact, Recognition & Regional Oversight

## Purpose
Turn longitudinal farm productivity measurements into a responsible improvement and support loop: identify meaningful progress, recognize farmers, learn from repeatable methods, and route stagnation or decline to practical support.

## Outcome lanes
Each reviewed farm outcome belongs to one of four lanes:
1. **Breakthrough** — meaningful, evidence-supported improvement; prepare farmer recognition subject to review and consent.
2. **Limited progress / stalled** — revisit the plan, constraints, adoption and missing data; offer a revised support plan.
3. **Decline** — raise a high/urgent follow-up case and prioritize human review or a field visit.
4. **Insufficient evidence** — do not infer success or failure; collect missing comparable measurements first.

Classification is a reviewed outcome, not a raw model guess. Compare only compatible units, crop cycles, production systems, periods and metric directions. Adjust for season, weather, area, input intensity and confounders where possible. Show evidence quality, uncertainty and missing information. Missing data are not zero; correlation is not causation.

## Contribution and attribution governance
Record who materially contributed: SARINA-led, expert-led, joint, farmer-led, external, or unclear. Link expert-led and joint results to the existing expert impact record where available. Existing expert impact assessments remain the source of record for expert contribution. SARINA must not rebrand an expert's method or intellectual contribution as its own. Attribution confidence is separate from outcome size.

## Learning from successful farms
A breakthrough may become an internal knowledge candidate, but it is not automatically published or used as a prescriptive template. Review repeatability, evidence quality, crop/climate/soil/water context, confounders, transferability, privacy and anonymization. Explicit farmer consent is required; expert consent is also required for expert-led or joint contributions. Preserve source attribution and conditions of applicability. Present a contextual case, not a universal guarantee.

## Owner workbench
The central SARINA owner workbench presents four queues: breakthrough farms awaiting recognition/knowledge review; limited-progress farms requiring a revised plan; declining farms requiring urgent follow-up; and farms with insufficient evidence requiring data collection. Each case should show baseline, follow-up period, comparable metric deltas, evidence quality, attribution, expert involvement, priority and status. Use the existing farmer_recognition_awards workflow for formal recognition.

## Agricultural authority partnership model
Offer an optional, farmer-controlled regional oversight program to the Ministry of Agriculture Jihad and relevant provincial/county offices:
- Verify each authority account and grant only an explicitly approved geographic scope plus a dedicated capability.
- Require separate, revocable farmer consent for each farm and access level (summary or follow-up).
- Show only consented farms within the authority's approved scope; no default nationwide or cross-region visibility.
- Let authorities acknowledge a case, schedule a field visit, record a recognition visit, or coordinate technical assistance. They cannot edit farmer measurements or SARINA/expert assessments.
- Audit access and follow-up. Do not expose raw evidence or contact details in regional overviews by default.

The migration adds consent-gated, scope-gated read foundations. It deliberately grants no authority organization access by default. An approved organization still needs an administrator-issued oversight.productivity.read capability and matching organization_access_scopes.

## Partnership proposal
**Title:** Regional Agricultural Productivity Monitoring and Farmer Support Partnership with SARINA.

**Offer:** a controlled pilot in selected districts, with farmer consent, to identify successful farms for recognition and peer learning, and detect stagnating or declining farms early enough for targeted extension visits and problem-solving.

**Requested support:** nominate a provincial/county liaison and technical reviewers; validate regional indicators and benchmark sources; approve a limited pilot geography and governance protocol; support visits for selected breakthrough and decline cases; coordinate access to official agronomic, climate, water and soil datasets under appropriate licenses; co-design transparent recognition criteria and publish aggregate pilot outcomes.

**Pilot measures:** baseline completeness; share of farms with comparable follow-up data; improving/stagnating/declining distribution; time to first intervention; resolved decline cases; verified recognition cases; farmer satisfaction; and evidence-backed practices accepted for contextual reuse. Publish aggregate results only unless identifiable farm publication is separately consented.

## Implementation status
- Existing baseline, measurement, improvement-plan and expert-impact structures are reused.
- Outcome review, authority consent and internal knowledge-candidate tables are introduced by migration.
- Authority access is both consent-gated and geographic-scope-gated; it is not enabled automatically.
- The current workbench is a central-admin triage interface. A dedicated authority interface and farmer consent controls remain separate release steps.
- No outcome, recognition, knowledge item or authority permission is fabricated or seeded.


## Automated preliminary evaluation engine (2026-11-19)

- Added `farm_productivity_metric_evaluation_rules` to make metric direction explicit and reviewable. Initial enabled indicators are marketable yield, gross revenue, soil organic matter and marketable loss rate. Water applied, input cost, labor hours and soil EC are intentionally not direction-scored because their interpretation depends on yield, context, depth, crop or economic structure.
- Added `farm_productivity_candidate_signals` as a separate queue from reviewed outcome records. The engine never inserts a final breakthrough/limited-progress/decline classification and never assigns credit to SARINA or an expert.
- Added admin-only RPC `run_farm_productivity_evaluation`. It compares only confirmed baselines with later measurements for the same farm, field and crop-cycle scope, exact unit match, and medium/high data quality; confidence below 0.60 is excluded when confidence is supplied.
- The engine records compatible metric deltas and source metadata. A zero baseline produces an absolute delta without a percentage. No arbitrary universal percentage threshold is used.
- Candidate signals are directional hints (positive, negative, mixed, insufficient evidence), not statistical significance or causal impact. Season, weather, input intensity and other confounders are not yet adjusted. A human reviewer must decide the four official outcome lanes and contribution attribution.
- The central oversight workbench can run the evaluation, view pending signals and link a selected signal to a human-reviewed outcome record. No candidate is automatically recognized, published, or shared with an authority.
- The current runner is manually invoked by an authenticated SARINA administrator; automatic scheduled evaluation is not enabled yet. The current project has no farm measurement records, so no real farm outcome can be evaluated until farmers provide comparable baseline and follow-up data.
