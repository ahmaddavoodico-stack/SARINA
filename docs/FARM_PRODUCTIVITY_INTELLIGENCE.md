# SARINA Farm Productivity Intelligence

**Status:** Farm boundary capture plus the first usable productivity intelligence workspace and its owner-scoped database model are implemented on `feature/farm-productivity-system`. Both productivity migrations are applied and verified in the linked Supabase project. The module is not yet merged to `main`.

## Mission

Turn farm records into measurable, evidence-aware improvement. The module must answer four questions:

1. What is the farm's current condition and productivity baseline?
2. How does it compare with genuinely comparable farms and credible regional references?
3. Which practical improvement plan should SARINA and, where useful, a qualified expert recommend?
4. What changed after the plan, and how much improvement is supported by the evidence?

Recommendations are not outcomes. SARINA must record implementation, measure outcomes over time, and distinguish observed change from improvement attributable to an intervention.

## Bounded module responsibilities

The module is a first-class domain capability, integrated with (not a replacement for) the Farmer Farm Record.

- **Baseline Assessment:** build a dated snapshot from farm, field, crop-cycle, soil, water, irrigation, activity, observation, weather and harvest/economic records. Record missing dimensions explicitly.
- **Regional Benchmarking:** compare only after matching crop, variety where relevant, production system, season, climate, soil, water constraints, scale and management context. Preserve source, period, geographic resolution, sample size, methodology, license, quality and uncertainty.
- **Improvement Planning:** create prioritized, time-bound actions linked to the baseline and supporting evidence. Track SARINA-generated suggestions, farmer decisions, expert review, actual execution, cost and deviations.
- **Impact Monitoring:** capture repeated measurements using stable metric definitions and comparable periods. Show before/after deltas, resource efficiency, uncertainty and attribution confidence.

## Existing SARINA foundations to reuse

The inspected Supabase project already contains:

- `farms`, `farm_fields`, `farm_locations`
- `crop_cycles`, `crop_activities`, `irrigation_events`
- `soil_tests`, `water_tests`, `farm_observations`, `weather_records`
- `farm_recommendations`, `recommendation_actions`
- `regional_data_sources`, `regional_datasets`
- expert impact and assessment tables

Do not create duplicate farm, recommendation, regional-source or expert-impact systems. Extend the current domain model only after inspecting exact constraints, grants, policies, deployed migrations and application usage.

### Current verified gaps

- `farm_locations` stores a point (latitude/longitude), not the surveyed boundary of a field.
- `farm_fields` currently stores a name, area, unit and optional soil description; no polygon boundary was found.
- The current farmer form accepts manually typed coordinates; browser GPS and map-based polygon capture were not found in the inspected component.
- A dedicated productivity data model now exists: metric definitions, dated measurements, versioned baseline snapshots, curated benchmarks, improvement plans and trackable actions. The six tables are protected by RLS.
- The current farm recommendation table is farmer-readable; action execution and expert workflows need a deliberate authorization review before extension.

## Domain model and implementation status

1. **Field geometry:** add a validated Polygon/MultiPolygon boundary to the existing `farm_fields` concept, with SRID 4326, geometry validity checks, server-computed geodesic area/perimeter, boundary capture method, GPS accuracy, confirmation status and capture timestamp. Preserve existing manually entered areas as legacy/unverified until reconciled. One farm may contain multiple fields.
2. **Baseline snapshots:** immutable, versioned records tied to farm/field/crop cycle and a measurement period. Store metric code, value, unit, source/provenance, quality, confidence, calculation method and source record references. Do not silently fill missing values.
3. **Benchmark references:** curated regional benchmark records with crop/system/season and environmental matching dimensions, geographic coverage/resolution, source/license, effective dates, sample size, statistic type (e.g. median or percentile), quality and uncertainty. Keep benchmark data distinct from an individual farm's observations.
4. **Improvement plans:** use existing `farm_recommendations` where its lifecycle fits; add structured plan/action tracking only where existing `recommendation_actions` cannot safely represent the needed state. Link each plan to baseline version, target metric, time horizon, evidence and optional expert review.
5. **Outcome measurements:** repeated, dated metric observations with units, field/crop-cycle scope, source type (farmer report, instrument, lab, verified harvest/financial record, remote estimate), evidence reference, quality/confidence and reviewer status.
6. **Impact evaluation:** calculate absolute and percentage change only for compatible metrics and comparable periods. Where feasible, adjust for area, season, weather and resource inputs. Attribute effects to an intervention only when evidence supports it; otherwise label them as observed association or unadjusted change.

## Metric framework

Metric definitions must be versioned and crop-aware. Initial families:

- Production: marketable yield per hectare, quality grade, loss rate, harvest stability.
- Resource efficiency: water per unit of marketable yield, fertilizer/nutrient input per unit yield, energy/fuel per unit yield.
- Economics: gross margin per hectare, input cost per unit yield, labor cost, net return.
- Soil and sustainability: soil organic matter trend, salinity trend, water-use efficiency and other indicators only where a valid measurement method exists.

Never compare unlike units, different crop cycles, incompatible harvest windows or incomparable production systems. Report denominator, period and method beside every KPI.

## Data quality and fairness rules

- Use the best available information, including estimates, but label it as such.
- Distinguish farmer-reported, measured, laboratory, official, remote-sensing/modelled and inferred values.
- Preserve source, timestamp, spatial resolution, validity period and confidence/quality metadata.
- A regional model pixel is not a farm-level laboratory measurement.
- Benchmark coverage and sample size must be visible; do not manufacture a ranking when comparable data are insufficient.
- Missing data reduce confidence; they are not zero.
- Treat the 80% information-sufficiency concept as an operational starting threshold, never as an accuracy guarantee.
- Show both absolute and relative change, with uncertainty and limitations.
- Keep a human expert review path for high-risk or high-cost recommendations.

## First implementation sequence

### Phase 1 — Farm location and field boundary (first user-facing milestone)

**Implementation status:** Leaflet map, permission-based device GPS, manual boundary vertex capture, vertex removal/undo, client-side area/perimeter preview, farmer confirmation, farm/field save flow, and PostGIS persistence are implemented. The additive migration is applied and verified in the linked Supabase project. Farm and field tables were empty at application time. Real-device GPS/touch testing and end-to-end owner-RLS persistence testing remain release gates.

1. Ask permission before accessing device location.
2. Provide a clear “My location” action and show the reported GPS accuracy.
3. Let the farmer place/edit boundary vertices on a map; support undo, vertex deletion, cancel, save draft and explicit confirmation.
4. Validate polygon closure, minimum vertices, self-intersection and plausible area.
5. Calculate area/perimeter from the polygon using geodesic methods; distinguish calculated area from a manually entered estimate.
6. Support multiple fields per farm and retain the existing point location as the farm's representative point.
7. Save only after farmer confirmation; preserve provenance and accuracy metadata.

### Phase 2 — Baseline MVP

**Implementation status:** The farmer workspace now records dated metrics with units, provenance, quality and optional confidence; creates versioned baseline snapshots; calculates completeness against core indicators; and explicitly lists missing metrics. Latest measurements can be compared with the saved baseline only when units match. A farmer can create an improvement plan, add actions and track action status. Remaining work includes richer crop-cycle/field-specific entry, date-range selection, evidence attachments and end-to-end authenticated testing.

- Begin with metrics that have sufficient records; do not block the farmer on unavailable lab or yield data.
- Ask for missing values progressively using selectable options and simple evidence capture.
- Show baseline completeness and provenance, not a fabricated single productivity score.

### Phase 3 — Benchmarks and plans

**Implementation status:** Benchmark storage is available with source URL, license, sample size, region, period, units, statistic type and quality metadata. Only published records are visible to authenticated farmers, and publication requires a source URL, license and sample size. No benchmark records have been seeded; peer comparisons remain intentionally unavailable until trustworthy, licensed references are curated. Farmer-created improvement plans and actions are implemented; expert review and SARINA-generated recommendation integration remain future work.

### Phase 4 — Impact monitoring

**Implementation status:** The workspace shows latest measurements, baseline-to-current absolute and relative changes for matching units, measurement history, and completed versus total plan actions. It does not claim causal attribution. Crop-cycle-aware period comparisons, confounder adjustment and evidence-backed expert impact review remain future work.

## Security, release and operational gates

- Keep RLS enabled on all exposed tables. New farm-owned records must use the established ownership chain through `farms.owner_user_id` and `users.auth_user_id = auth.uid()`; do not authorize from user-editable metadata.
- Add SELECT policies before relying on UPDATE; UPDATE policies need both USING and WITH CHECK.
- Public benchmark reads and private farm measurements require different, explicit access policies.
- Do not expose service-role or secret keys in the browser.
- Check Data API exposure and explicit grants for new tables; public-schema tables are no longer automatically exposed by default on current Supabase projects.
- Use PostGIS for field geometry only after confirming the deployed extension schema and supported functions. The inspected project currently has PostGIS in `public`; do not relocate or alter the extension as part of this feature without a dedicated backup and migration plan.
- The field-boundary and productivity migrations were applied to the linked Supabase project. Six productivity tables have RLS enabled, nine explicit policies, owner-scoped write/read access, and same-farm/actor validation triggers. The metric catalog contains eight definitions; there are currently zero farmer measurements, baselines, plans, actions or published benchmarks because no farm records exist.
- Before each schema change, review the live schema, RLS, grants, deployed functions and current Supabase documentation; test the migration and RLS behavior on an isolated target.
- Do not claim a feature is complete until the mobile permission flow, polygon editing, area calculations, RLS, persistence and production build are tested.

## Acceptance criteria

- A farmer can create a farm and add more than one field without typing coordinates.
- GPS access is permission-based and can be declined; manual map placement remains available.
- A field boundary is editable and its area is calculated from the saved polygon.
- Each location/boundary retains capture source, accuracy, confirmation and timestamp.
- Farm owners can read/write only their own farm records; unauthorized users cannot access them.
- Baselines show source, date, metric unit, missing fields and confidence.
- Benchmarks are shown only when comparability and provenance are adequate.
- Plans and actions can be tracked through completion.
- Impact reports distinguish observed change from intervention attribution.
- Existing farmer, authentication, PWA and document workflows continue to work.


## Productivity MVP database and UI (2026-11-19)

- Added six tables: `farm_productivity_metric_definitions`, `farm_productivity_measurements`, `farm_productivity_baselines`, `farm_productivity_benchmarks`, `farm_improvement_plans`, and `farm_improvement_actions`.
- Seeded eight metric definitions across production, resource efficiency, economics and soil; these are definitions only, not assumed farm measurements.
- Added owner-scoped RLS, authenticated grants, same-farm checks for field/crop-cycle/baseline references, and actor identity checks.
- Added the farmer-facing `بهره‌وری مزرعه` workspace with metric capture, provenance/quality/confidence, baseline completeness and missing indicators, target-linked improvement plans, action tracking, baseline/current comparisons for matching units, measurement history, and an honest empty state for unavailable benchmarks.
- Benchmark table is deliberately empty until source, license, region, period, unit and sample size are verified. No fabricated regional averages or rankings are shown.
- The six tables currently contain zero farmer rows; the eight metric definitions are present.


## Verified specialist workspace integration

The specialist workspace exposes supervised farms, recorded productivity measurements, and due/overdue improvement actions through the existing specialist-scoped database views. It is presented as a dedicated tab inside the verified specialist office. Access to this tab is restricted to verified specialists; it does not create parallel farm or productivity records and does not claim autonomous agronomic diagnosis.
