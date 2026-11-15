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
