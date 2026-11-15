# SARINA Farmer Workspace

A lightweight, responsive, installable farmer-first web app connected to the SARINA Supabase project.

## Current slice
- Email/password sign-up and sign-in with Supabase Auth.
- Creates/updates the matching row in `public.users` using `auth_user_id`.
- Lists the signed-in farmer's farms and creates a farm record.
- Stores farmer-confirmed farm coordinates in the existing `farm_locations` table.
- Retrieves farm-specific current weather and a 7-day forecast from Open-Meteo through the authenticated `farm-weather-context` Supabase Edge Function.
- The Edge Function verifies the signed-in farmer's access to the farm and its confirmed coordinates before fetching weather; it stores the current model estimate and daily forecasts in the existing `weather_records` table.
- Returns a normalized, timestamped analysis context with explicit model-data provenance, separate from local sensor observations. Weather alone never determines fertilizer or chemical rates.
- The browser invokes the Edge Function with the active Supabase session; the service-role key remains server-side. The service worker never caches authenticated function responses.
- Persian-first UI with English toggle; mobile-responsive PWA shell.
- Uses only the Supabase publishable key in the browser. Never put a service-role/secret key in this app.
- Service worker caches only same-origin static app assets; authenticated Supabase/API responses are never cached.

## Run locally
Serve this directory from a local static web server (ES modules and service workers do not work reliably from `file://`). For example: `python -m http.server 8000` from this directory.

## Database
Migrations `database/migrations/005_farmer_portal_auth_rls.sql` and `006_farmer_portal_least_privilege_grants.sql` link Auth identities to existing app users and apply owner-scoped access. They have already been applied to the connected SARINA Supabase project and verified.

## Deployment
The repository root contains a redirect to `/app/`, so the existing root Vercel deployment can serve this app without changing the Vercel project root setting. Configure the deployed app URL in Supabase Auth redirect/site URL settings before enabling production sign-ups.

## Release scope
This is the first usable farmer portal slice, not the complete product. Farm location/map, crop cycles, soil/water records, AI advisory and offline data sync are follow-on tasks.

## Farm weather pipeline
- Endpoint: `POST /functions/v1/farm-weather-context` (JWT required; body: `{ "farm_id": "<uuid>" }`).
- Reads the farm and primary location under the caller's RLS permissions, retrieves Open-Meteo current conditions plus a 7-day forecast, and persists model estimates as `weather_records.data_kind = 'forecast'`.
- Returns the normalized context for the farm analysis layer. Any future agricultural analysis request must carry this exact farm-scoped context; it must not substitute device location or another farm's weather.
- Open-Meteo attribution: [Weather data by Open-Meteo.com](https://open-meteo.com/).

## Farmer-first soil and land profile (first capture slice)
- Each farm card now offers a short, bilingual, choice-based soil/land questionnaire with an explicit “I don't know” option.
- Answers are stored as a timestamped `farm_observations.observation_type = 'soil_condition'` record under the existing owner-scoped RLS policy. The description carries the versioned `SARINA_FARM_PROFILE_V1` payload and is explicitly labelled as a farmer self-report, not a laboratory result or map-derived measurement.
- Captures soil feel/texture, visible lime and salinity signs, post-irrigation water retention, slope, irrigation source, and irrigation method. No new tables or schema migrations are introduced.
- Experimental ISRIC SoilGrids 2.0 point adapter is now called by the farm-land-context endpoint when primary farm coordinates exist. It requests pH, clay, sand, silt, organic carbon, CEC and total nitrogen for four depth intervals. The response is marked as a modelled regional 250 m pixel, never as a laboratory measurement. The adapter times out safely and reports provider unavailability without fabricating values.

## Farm land context endpoint
- Endpoint: `POST /functions/v1/farm-land-context` (JWT required; body: `{ "farm_id": "<uuid>" }`).
- Reads farm, confirmed primary location, fields, farmer soil/land observations, soil and water test records, and stored weather records using the caller's JWT and existing owner-scoped RLS policies.
- Returns a versioned `SARINA_FARM_LAND_CONTEXT_V1` payload with explicit provenance and data-quality counts. SoilGrids REST v2.0 is used experimentally; because ISRIC currently reports the REST service paused, `provider_unavailable` is a valid result, not a workflow failure. ISRIC WCS is the planned fallback path if REST remains unavailable. Missing values stay missing.
- Uses the publishable/anon key only and does not use service-role access.

## SIACP farm-context gate
- Farm-scoped SIACP requests now require a fresh `SARINA_FARM_LAND_CONTEXT_V1` payload for the same `farm_id`, in addition to the existing weather-context requirement.
- The bridge rejects missing, mismatched, stale, or provenance-incomplete land context. It remains a validation-only bridge and does not invoke a model or authorize physical actions.

## SoilGrids experimental provider adapter
- Provider: ISRIC SoilGrids 2.0, CC BY 4.0, modelled global soil maps at 250 m pixel resolution.
- Properties requested: pH in water, clay, sand, silt, soil organic carbon, cation exchange capacity, and total nitrogen; depths 0–5, 5–15, 15–30, and 30–60 cm; mean prediction.
- Current access path: REST API v2.0 point query. ISRIC's official status page currently says this REST API is temporarily paused; the function records a timeout/provider error and preserves the rest of the farm context. It does not replace missing values with guesses.
- Planned fallback: ISRIC WCS (recommended by the provider for stable spatial subsets) or WebDAV raster ingestion. Provider adapters remain replaceable without changing the farmer questionnaire or SIACP context contract.
- Official access docs: https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html and https://docs.isric.org/globaldata/soilgrids/wcs.html.

## Farmer crop groups and planting layout
- Each farm card now includes a separate bilingual form for recording one crop group at a time, so mixed orchards and intercropping can be represented without blending species or cultivars.
- Captures plant/tree name, cultivar or product type, count, approximate age, within-row spacing, between-row spacing, planting pattern, position relative to ridge/furrow (ridge top, inside furrow, furrow edge, offset from furrow, or flat ground), and optional distance from the furrow edge.
- Records are saved as timestamped `farm_observations.observation_type = 'crop_layout'` with the versioned `SARINA_CROP_LAYOUT_V1` payload and farmer-self-report provenance. No new table or schema migration is required.
- The farm-land-context endpoint now returns these separately under `crop_groups` and includes `crop_group_count` in data quality metadata, while preserving the existing `SARINA_FARM_LAND_CONTEXT_V1` contract.
- Counts and distances are farmer-reported until independently verified. Unknown values remain blank/unknown and are not inferred.

## Farm ponds and water assets
- Each pond or reservoir is captured as an independent farm asset through a bilingual farmer-first form; multiple ponds can be recorded separately.
- Captures structure type, current use, condition, water source and availability, dimensions/capacity, transfer method, aquaculture stock presence, water-test status and optional EC/pH/TDS, fertigation equipment, and future development interest.
- Records use farm_observations observation_type pond_asset and versioned SARINA_POND_ASSET_V1 payloads. Existing owner-scoped RLS is retained; no new table is introduced.
- farm-land-context returns pond assets separately as pond_assets with provenance and count metadata. Farmer-entered values remain self-reported, not verified water tests.
- Safety boundary: storage ponds are not assumed to be fertilizer-mixing tanks. Direct fertilizer addition to storage ponds is discouraged; fertigation recommendations require water/fertilizer compatibility checks and suitable separate mixing/injection equipment. Livestock or aquaculture suitability is never inferred from irrigation suitability.
