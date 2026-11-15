# SARINA Farmer Workspace

A lightweight, responsive, installable farmer-first web app connected to the SARINA Supabase project.

## Current slice
- Email/password sign-up and sign-in with Supabase Auth.
- Creates/updates the matching row in `public.users` using `auth_user_id`.
- Lists the signed-in farmer's farms and creates a farm record.
- Stores farmer-confirmed farm coordinates in the existing `farm_locations` table.
- Retrieves current local model weather and a 7-day forecast from Open-Meteo for located farms, including temperature, apparent temperature, humidity, wind, rainfall and reference evapotranspiration.
- Builds a normalized, timestamped weather context for downstream farm analysis and clearly labels provider model estimates separately from on-farm sensor readings.
- Weather lookups are cached in memory for 15 minutes; no weather API response or authenticated request is cached by the service worker.
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