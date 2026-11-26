# Automatic Farm Environmental Assessment

## Product intent

After a farmer confirms a farm boundary and primary location, SARINA should assemble a professional environmental baseline with minimal farmer effort. The baseline is reusable for that farm and improves over time as trustworthy, consented and reviewed evidence becomes available from the farm and its surrounding region.

This capability is an environmental data product, not a farmer questionnaire and not an automatic agronomic prescription engine.

## Non-negotiable evidence rules

1. Every value carries its source, source type, observation or validity time, spatial resolution, unit, retrieval time, quality and uncertainty where available.
2. Distinguish farm measurements, laboratory results, farmer reports, official observations, remote-sensing estimates, gridded model estimates and SARINA inferences.
3. Never promote a regional estimate to a farm-level measurement.
4. Missing, unknown and not-measured values remain explicit; they are never silently filled with zero or a guessed value.
5. Neighbouring farm evidence is used only as a regional prior or benchmark when geography, season, crop, soil/water context and methods are sufficiently comparable.
6. Personal or farm-identifiable data are not pooled for regional learning by default. Require purpose-specific farmer consent, minimization/anonymization, quality checks and human review before shared use.
7. Conflicting or stale evidence must be retained as such and surfaced; do not silently overwrite historical values.
8. Environmental assessment does not itself authorize fertilizer/pesticide rates, irrigation actuation or other physical actions. Qualified specialist review remains required for high-impact decisions.

## Domains

### Location and terrain
- Confirmed boundary, centroid, coordinate precision and capture method
- Elevation, slope, aspect, terrain position and drainage/topographic context
- Spatial resolution and date/version of the elevation/terrain source

### Soil
- Soil class/texture, clay/sand/silt, pH, organic carbon/matter, carbonate, CEC and other supported properties
- Depth intervals and model uncertainty for gridded estimates
- Farm-specific laboratory tests, sampling depth, method, lab, date and report reference
- Explicit distinction between map/model predictions and measured samples

### Water
- Water source and seasonal availability from farmer/official records
- Laboratory water quality: EC, pH, TDS, SAR, major ions, bicarbonate and boron when available
- Water quantity, delivery reliability and irrigation infrastructure
- No quality classification without the required measured parameters

### Climate and weather
- Long-term climatology and seasonal normals, not only a short forecast
- Historical extremes and heat/cold stress, rainfall, humidity, wind, radiation
- Reference evapotranspiration and crop water-demand context
- Current conditions and forecasts clearly separated from historical observations
- Station/model identity, spatial representativeness and temporal coverage

### Remote sensing and land cover
- Vegetation/land-cover trends, crop/cover change and surface-water signals where suitable
- Satellite acquisition date, cloud/quality mask, spatial resolution and processing method
- No unsupported crop identification or farm-level soil claims from imagery alone

## Existing SARINA foundations to reuse

- `farm-land-context`: authenticated farm-scoped land, soil-test, water-test, farmer-observation and SoilGrids context.
- `farm-weather-context`: authenticated Open-Meteo current conditions and seven-day forecast; stores provider records in `weather_records`.
- `sarina-central-intelligence`: existing orchestrator already consumes land and weather contexts with the caller JWT.
- `regional_data_sources` and `regional_datasets`: existing source catalog and regional dataset storage.
- `regional_data_transfer_consents` and regional sync contracts: consent-governed regional exchange foundation.
- `SAI` evidence contract and evidence assembler: provenance, quality, review and missing-data handling.

Do not create parallel orchestration, regional sync, evidence or benchmark systems.

## Delivery stages

### Stage 1 — farmer-facing first assessment
- Expose the existing land and weather context services in the farmer farm workspace.
- Verify exact farm ID and caller-scoped response before rendering.
- Show source status, available farm tests, location confirmation, current weather and short forecast.
- Clearly label provider/model estimates and expose missing-data limitations.
- Do not claim that this stage is a complete climate, terrain or water-quality assessment.

### Stage 2 — persistent, versioned environmental baseline
- [Implemented in this feature branch] Add `farm_environmental_assessments` as an append-only snapshot ledger with per-farm versions, assessment status, source manifest, evidence payload, quality summary and missing domains.
- [Implemented in this feature branch] Add farmer-owned read/insert RLS and read access through the existing active farm-expert contract; no client update/delete policy is provided.
- [Implemented in this feature branch] Persist each successful refresh as a new immutable version and reload the latest snapshot plus recent version history.
- Track assessment status, domains completed/missing, confidence and refresh timestamps.
- Reuse existing farm and regional structures where they fit; migration remains feature-branch-only until explicitly approved.
- Refresh on meaningful changes, source updates or explicit user request; do not repeatedly re-run expensive collection on every page view.

### Stage 3 — expanded spatial and historical sources
- [Implemented in this feature branch] Add a caller-JWT-scoped historical climate adapter using the Open-Meteo Historical Weather API with ERA5-Land, a fixed 1991–2020 reference window, monthly temperature/rainfall summaries, annual rainfall, heat-day counts (daily maximum >=40°C and >=45°C), and historical maximum daily temperature.
- [Implemented in this feature branch] Persist the climate evidence and provider provenance in the existing versioned farm assessment snapshot; display the coverage period, approximate grid resolution, and limitations to the farmer.
- [Implemented in this feature branch] Gate provider requests behind an operator-configured commercial entitlement flag and server-side customer API key. The free Open-Meteo API is restricted to non-commercial use; SARINA must not call it for commercial workloads without the appropriate provider entitlement.
- [Implemented in this feature branch] Add a caller-JWT-scoped spatial context adapter using Copernicus DEM GLO-90 through the Copernicus Data Space Sentinel Hub Process API. It computes regional elevation summaries and Horn-neighbourhood slope estimates from the returned DEM raster at its 90 m native scale. This is a digital surface model and is not parcel survey data.
- [Implemented in this feature branch] Add Sentinel-2 L2A 30-day NDVI statistics over a bounded area around the confirmed farm point, with SCL cloud/shadow/snow/water masking and 10 m analysis resolution. Add public STAC catalogue discovery for recent scenes with cloud metadata.
- [Important geometry limitation] The current farm registration schema exposes a primary point but not a validated parcel polygon. Until a farm boundary is captured, spatial and satellite calculations use an approximately 1 km centroid-buffer proxy and must never be presented as parcel-only measurements.
- [Still pending] Replace the centroid buffer with verified farm/field polygons when boundary capture is available; then calculate within-parcel summaries and add further vegetation/land-cover classifications only after validation.
- Validate source coverage, licenses, update cadence, coordinate precision and geographic suitability before enabling each adapter.
- Prefer open, low-cost sources and cache results by spatial cell and time window to reduce repeated external requests.
- Add provider circuit breakers, bounded timeouts, retries and explicit unavailable states.

### Stage 4 — regional knowledge enrichment
- Aggregate only consented, minimized and reviewed farm evidence.
- Use regional datasets as contextual priors/benchmarks, not substitutes for an individual farm's tests.
- Apply minimum sample thresholds, outlier/conflict handling, comparable methods/units, spatial and temporal decay, and versioned calculations.
- Keep private raw farm records separate from anonymized regional aggregates.
- Feed approved, reusable knowledge into SAI with provenance and human review.

### Stage 5 — expert workflow
- Present an environmental dossier with evidence categories, confidence, map coverage, gaps and recommended confirmatory tests.
- Specialists can validate, annotate or reject evidence; every change is audited.
- Any agronomic recommendation must cite the evidence and state uncertainty and required confirmation.

## Current implementation in this branch

The first farmer-facing panel invokes the existing `farm-land-context` and `farm-weather-context` Edge Functions through the authenticated Supabase client. It verifies the returned farm ID, displays existing soil/water test counts, the SoilGrids provider state, current model weather and seven-day forecast, and explains the difference between model data and farm measurements.

This branch now persists append-only, versioned snapshots of the current land and weather context, source manifest, quality summary and known gaps. It also includes a historical climate adapter for the 1991–2020 ERA5-Land reference period, gated by a valid commercial-use entitlement and customer API key. The new `farm-spatial-context` adapter adds Copernicus DEM GLO-90 regional elevation/slope estimates and Sentinel-2 L2A NDVI statistics, with a public STAC catalogue lookup for recent scene metadata. Spatial processing uses the primary farm coordinate and an approximately 1 km buffer because a validated parcel polygon is not currently available in the registration schema. DEM and NDVI processing remain disabled until the operator configures a Copernicus Data Space OAuth client ID and secret as server-side secrets. When disabled or unavailable, the assessment records explicit missing statuses rather than substituting data. Regional peer aggregation remains later work and must not be represented as completed. The migration has not been applied to Production.
