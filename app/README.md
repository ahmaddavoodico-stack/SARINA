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

## Crop production, water regime and irrigation equipment (V2)
- Each crop group now records its own water regime (rainfed, irrigated, mixed), irrigation method, equipment type and optional equipment notes.
- Approximate harvest quantity, explicit unit and reporting period are captured separately, alongside a farmer-reported product-quality grade and optional notes.
- Payload prefix remains SARINA_CROP_LAYOUT_V1 for backward compatibility; the payload schema is SARINA_CROP_LAYOUT_V2. Existing records remain readable.
- Production quantity and quality are self-reported estimates, not verified yield measurements or laboratory grading. Unknown values can remain blank/unknown. Do not compare quantities across groups unless units and reporting periods are compatible.

## Farm operations and role-based learning (V1 foundation)
- Farm cards include farmer-confirmed work plans with task, date, start/end time, assignee, role, priority, instructions and status.
- Tasks use versioned SARINA_FARM_OPERATION_V1 payloads in existing farm_observations rows with observation_type = general. No new table or migration is introduced; existing owner-scoped RLS and authenticated grants are reused.
- Assignment is by entered name only in this first slice; worker accounts, notifications, attendance, payroll and shift management are not included.
- Task status can be changed to in progress, completed or blocked. Plans are farmer-entered, not autonomous AI recommendations.
- Learning tracks introduce farmer, worker and age-appropriate supervised youth education, plus introductory compost/organic fertilizer and productivity guidance. Children must not handle chemicals, composting equipment or machinery.
- Compost guidance is a cautious checklist, not a universal recipe. Feedstock suitability, carbon/nitrogen balance, moisture, aeration, temperature, maturity, salinity and pathogen risks require assessment before farm-specific recipes or application rates.
- Automatic daily/hourly scheduling, weather/crop-stage optimization, reusable SOPs, worker logins, notifications, learning progress and measured productivity analytics remain future phases.
- Provenance: farmer-entered plans remain distinct from sensor, laboratory, provider and model data. The UI states that a saved plan is not an expert-validated instruction. No physical action is triggered.

## SARINA Central Intelligence (SCI) — V1 architecture baseline
- Architecture and request lifecycle: [docs/architecture/SARINA_CENTRAL_INTELLIGENCE_V1.md](../docs/architecture/SARINA_CENTRAL_INTELLIGENCE_V1.md).
- SCI is responsible for request authorization, farm-context assembly, provider-independent routing, SIACP task lifecycle, result validation, evidence/provenance assessment and farmer-safe response composition.
- The first live milestone is deliberately limited to one authenticated farmer request and one registered specialist model.
- The current SIACP bridge is validation-only and does not invoke a model. The architecture document records this explicitly; no live AI dispatch is claimed until the provider registry, authoritative SIACP result/signing contract and server-side provider secret are confirmed.
- SCI remains advisory-only in V1. No irrigation, fertilizer, pesticide, machinery or worker action can be triggered.


## SARINA Central Intelligence — Slice A gateway
- New authenticated endpoint: `POST /functions/v1/sarina-central-intelligence` with `farm_id`, `question`, optional `language` (`fa` or `en`) and optional bounded reference IDs.
- The gateway validates the request, verifies the caller session, and confirms farm access using the caller JWT and existing RLS. It does not accept client-selected provider/model IDs or client-supplied trusted farm context.
- Slice A is intentionally a validation-only intake: it returns `accepted_for_validation` and explicitly reports `model_invoked: false`, `provider_selected: false`, and `physical_action_authorized: false`. Context assembly, SIACP signing and provider dispatch remain disabled until their prerequisites are validated.
- Shared deterministic validators cover request shape, context freshness/farm matching, SIACP TASK_REQUEST structural subset, and TASK_RESULT correlation/recipient/schema checks. Tests: `deno test supabase/functions/_shared/sci-contract.test.ts`.
- Important limitation: the SIACP validator checks the structural subset only; it does not implement cryptographic signature verification or RFC 8785 canonicalization. No full SIACP conformance or live model invocation is claimed.

## SARINA Experts — Human support pilot (V1)
- A separate expert workspace is available from the farmer dashboard. It supports expert profile registration, specialty selection, credential metadata submission, assigned case review, assignment acceptance/decline, text messages, and expert reports.
- Farmers can start a case from an individual farm card by selecting a verified directory expert, describing the issue, and explicitly consenting to share the selected farm context for that case.
- The first pilot is text-only. Credential file uploads, payment, video calls, automated scheduling, field-service dispatch, and the SARINA admin verification dashboard are not enabled.
- Expert profiles remain private by default. Only manually verified profiles explicitly marked `directory` or `public` appear in the farmer's expert selector. The current pilot therefore requires controlled administrative verification before the first expert can receive a farmer case.
- Database migrations: `008_human_expert_support.sql`, `009_expert_specialty_catalog.sql`, `010_expert_case_context_snapshot.sql`, and `011_expert_assignment_acceptance_rls.sql`. The last migration prevents expert messaging and reporting until the assigned expert accepts the case. It reuses the existing expert tables and adds request assignments and expert reports with participant-scoped RLS. The identity helper is SECURITY INVOKER; no service-role key is exposed to the browser.
- Farmer consent is recorded per request. A bounded snapshot of farm, location, fields, soil/water tests, farmer observations, crop groups, pond assets and data-quality provenance is copied into the case after the authenticated farmer context endpoint confirms ownership. Only the selected expert and the farmer can read that snapshot, conversation and report.
- Farmers can review their submitted expert cases, exchange text messages and read submitted expert reports in the farmer workspace. Expert identity is kept distinct from AI-generated recommendations.
- Verification status is not writable through the expert profile UI. Credential documents are not uploaded in this pilot; only metadata is submitted for manual review.
- End-to-end verification still requires authenticated farmer and verified-expert test accounts. Do not treat a successful static deployment as proof that a live case was exchanged.


## Agricultural marketplace (first integrated slice)
- Open the Marketplace workspace from the authenticated role navigation; it is available alongside farmer, expert, livestock and organization workspaces.
- Two storefronts are separated by supply origin: farmer-produced goods and company/supplier agricultural inputs.
- Seller applications are owner-scoped. Company seller profiles require an active membership in the linked SARINA organization. Seller verification is controlled outside the client.
- Verified sellers can publish products; crop-protection and other regulated products additionally require regulatory review.
- Buyers can browse/filter the two catalogs, add fixed-price products to a persistent cart, request quotes for quote-only products, and check out one seller at a time.
- Checkout creates an order, item snapshots and a draft invoice atomically. Unpaid inventory is reserved for 30 minutes and can be released by buyer cancellation or expiry.
- Payment is intentionally not live: no provider/webhook is configured and no client can mark an order paid. Shipment tracking can be recorded only after trusted payment confirmation.
- Full product design and database boundaries: [Agricultural Marketplace](../docs/product/agricultural-marketplace.md).
- The marketplace tables and policies were applied to the connected Supabase project in migrations 019-023. Keep the SQL migration source synchronized in the repository before replaying the database on a new environment.
