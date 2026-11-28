# SARINA Environmental Dossier Integration

**Branch:** `feature/environmental-dossier-integration`
**Base:** `main`
**Status:** Architecture baseline; no production schema, function, secret, or deployment changes in this step.

## Goal

Create one authoritative, versioned environmental dossier per authorized farm. Existing weather, land/soil-water, historical-climate, spatial/satellite, and regional-data capabilities must feed this dossier through the existing SARINA central architecture. The dossier becomes the shared evidence source for the farmer workspace, SARINA conversation, central intelligence, and specialist preparation.

Do not create a parallel AI/orchestration service. `sarina-central-intelligence` remains the orchestration authority.

## Existing building blocks to reuse

- `farm-weather-context`: current weather and forecast; existing persistence path to `weather_records`.
- `farm-land-context`: farm land, farmer reports, soil/water tests, and regional context.
- `farm-historical-climate-context`: historical climate baseline (external provider credentials/licensing and persistence still need verification).
- `farm-spatial-context`: Sentinel-2 / Copernicus DEM-derived spatial evidence (credentials, polygon support, and caller integration need verification).
- `sarina-regional-sync`: regional source/dataset ingestion foundation; source governance and execution state need verification.
- `farm_environmental_assessments`: append-only versioned snapshot table already present in the database; migration-history drift must be reconciled before changing schema.
- `sarina-central-intelligence`: authenticated central orchestration and current weather/land fan-in.
- `sarina-siacp-bridge`: downstream specialist protocol boundary; keep it subordinate to central policy and authorization.

## Target flow

1. Authenticate the caller and resolve a farm only after verifying ownership or explicitly authorized case/specialist access. Never trust a client-supplied `farm_id` without checking access.
2. Resolve the farm's approved location and actual field geometries. Use field polygons where available; do not silently substitute a centroid buffer for parcel-level spatial analysis.
3. Load the latest valid dossier snapshot. Apply per-domain TTL/cache rules and determine which domains are missing or stale.
4. Refresh eligible domains using existing context functions/adapters with bounded concurrency and timeouts:
   - current weather / forecast;
   - soil and water evidence (lab measurements distinct from farmer observations and regional estimates);
   - historical climate;
   - spatial / satellite evidence;
   - approved regional datasets.
5. Treat provider failure as a domain-level partial failure, not a reason to erase valid evidence from other domains.
6. Normalize evidence and persist an immutable snapshot to `farm_environmental_assessments`, with a monotonically increasing per-farm version.
7. Return a compact manifest and evidence references to callers. SARINA chat and specialist agents receive only the minimum necessary context and preserve provenance.
8. On every response, state which domains are verified, estimated, stale, unavailable, or require farmer/lab input. Never represent modeled/regional values as on-farm laboratory measurements.

## Evidence contract

Each evidence item / source manifest entry should preserve, where available:

- `domain`: weather, soil, water, historical_climate, spatial, regional;
- `provider` and `source_name`;
- `evidence_class`: on_farm_measurement, farmer_observation, official_record, remote_sensing, model_estimate, regional_reference, system_fact;
- `retrieved_at`, `observed_period`, and `valid_until`;
- `geometry_scope` / field reference and spatial resolution;
- `unit`, method, quality status, confidence / uncertainty;
- source URL, license / usage constraints, and limitations;
- provider/schema version and correlation/request ID.

Missing metadata must remain null/unknown rather than be invented.

## Authorization and security invariants

- Verify the JWT with Supabase Auth and resolve the farm against the caller's permitted farm/case scope.
- Context functions should continue receiving the caller JWT where their RLS model supports it. Do not forward a service-role credential to the browser or use it to bypass a farmer's row-level authorization.
- Any privileged snapshot write must occur server-side after the authorization decision; enforce farm scope again at the write boundary.
- Specialist access is limited to the exact assigned/consented case and farm scope.
- Never trust user-editable JWT metadata for role authorization.
- Keep provider secrets server-side. Check only whether required secret names are configured; never expose values.
- Apply request idempotency, per-farm refresh locks, provider timeouts, bounded retries, cache TTLs, and budget ceilings.
- Provider outputs are untrusted evidence. They cannot authorize physical actions, diagnosis, fertilizer/pesticide prescriptions, or irrigation actuation.

## Source readiness and fallbacks

- SoilGrids adapter is not considered usable until a live availability check and license/terms review pass. If unavailable, mark the soil domain incomplete and request an accredited soil test or an approved regional source.
- Historical climate data must retain the actual observation period, resolution, provider and commercial-use status.
- Copernicus analysis must use the actual farm/field geometry where supplied, and disclose resolution and cloud/coverage limitations.
- Regional data may be ingested only with documented provenance, license, geography, effective dates, units, sample size / statistic type where relevant, and quality review.
- No source should be seeded or labeled as authoritative merely because an adapter exists in code.

## Delivery sequence

### Step 1 — Architecture and integration contract (this change)
- Establish an isolated feature branch.
- Record the canonical dossier contract, trust boundaries, existing building blocks, and staged acceptance criteria.
- No production database or deployment changes.

### Step 2 — Schema and persistence reconciliation
- Compare the existing assessment table against the repository migration and production migration history.
- Produce a non-destructive migration plan for missing provenance fields, refresh/cache metadata, and safe snapshot writes.
- Confirm RLS and grants with security advisors before any release.

### Step 3 — Central dossier builder
- Implement a single server-side build/refresh path under the existing central architecture.
- Reuse existing context functions/adapters; add missing adapters only where a real source and license are confirmed.
- Add partial-failure handling, provenance normalization, snapshot versioning, idempotency, and budget/cache controls.

### Step 4 — Caller integration
- Connect authenticated farmer chat to the same dossier retrieval path after resolving an authorized farm server-side.
- Connect SCI requests and specialist evidence preparation to the same snapshot/manifest.
- Preserve a safe no-farm conversation mode with no farm data access.

### Step 5 — Validation and controlled release
- Unit tests for evidence contract, freshness, partial failures, geometry, and versioning.
- Integration tests with synthetic farms and isolated identities for farmer, specialist, and unauthorized cross-farm access.
- Provider readiness tests that do not reveal secrets.
- Verify snapshot persistence, RLS, source manifests, cache/budget behavior, and chat context inclusion.
- No merge to `main`, production migration, or deployment without explicit release approval.


### Step 3 — Read-only central dossier builder (implemented on feature branch)

**Implementation commit(s):** `6895f61d5564adf7bd9e39d00c859729d41fd147`, `09c95193b115bc0e9d382effc9b76c83d800bee1`, `b4c42bdb5f511e81f31c85148c45979225f9b042`

- Added `_shared/environmental-dossier.ts` under the existing `sarina-central-intelligence` function.
- Added the authenticated request mode `mode: "environmental_dossier"`; the central function validates the caller JWT and resolves `farm_id` through the caller-scoped `farms` query before invoking any domain context function.
- The builder concurrently requests the existing weather, land, historical-climate, and spatial context functions using the caller JWT and publishable key. It applies per-call timeouts and preserves independent failures as domain-level outcomes.
- Normalizes a versioned response envelope with `source_manifest`, `quality_summary`, `missing_domains`, provider call outcomes, and explicit safety flags. The response is marked `read_only_not_persisted`; no snapshot is written.
- Handles the current weather function's flat response and the land function's nested `{ ok, context }` response.
- Keeps current weather and forecast data classified as model estimates; farmer reports remain unverified observations; soil/water laboratory-tagged tests are separated from other recorded sources and regional SoilGrids estimates.
- Historical climate status and Copernicus terrain/satellite statuses are preserved as returned by their existing adapters.
- The current spatial adapter still reports a centroid-buffer proxy, not the confirmed farm-field polygon. The dossier records this scope limitation rather than describing the result as parcel-level analysis.
- `sarina-regional-sync` is deliberately not invoked: its current contract is signed inter-region event transport, not a farm-scoped regional dataset query. The dossier marks governed regional datasets as not connected.
- No new Edge Function, database table, migration, provider secret, or parallel orchestration service was created.

**Validation boundary:** repository diff and branch state were checked. A local Deno type-check/test could not be run in this environment because the Deno executable is unavailable. The Vercel commit check was still pending at the time of inspection. This is not a production or end-to-end verification.

**Remaining before persistence/release:** review and test all evidence-class mappings; add unit tests for partial failures and freshness; verify field-polygon support in the spatial adapter; define an approved farm-scoped regional dataset read contract; run owner/specialist/cross-farm authorization tests; reconcile migration history; then separately authorize snapshot persistence and deployment.

## Acceptance criteria

- One farm can produce a traceable versioned dossier with domain-level completeness and missing-domain reasons.
- A provider failure does not discard successful domains or mislabel stale data as current.
- Lab measurements, farmer reports, remote sensing, model estimates, and regional references remain distinguishable.
- The same authorized snapshot/manifest is consumed by farmer chat, central intelligence, and specialist preparation.
- A farmer cannot read another farmer's dossier; a specialist cannot exceed assigned/consented scope.
- Repeated refresh requests are idempotent and respect TTL, provider limits, and the configured budget.
- No model output triggers a physical action or presents uncertain estimates as verified measurements.
- CI and isolated integration evidence are recorded before release.

## Explicitly out of scope for this step

- Production schema mutation or migration application.
- Edge Function deployment or secret changes.
- Frontend deployment.
- Merging to `main`.
- Enabling external providers or spending provider/API budget.
