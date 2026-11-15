# SARINA Farmer Workspace

A lightweight, responsive, installable farmer-first web app connected to the SARINA Supabase project.

## Current slice
- Email/password sign-up and sign-in with Supabase Auth.
- Creates/updates the matching row in `public.users` using `auth_user_id`.
- Lists the signed-in farmer's farms and creates a farm record.
- Persian-first UI with English toggle; mobile-responsive and PWA shell.
- Uses only the Supabase publishable key in the browser. Never put a service-role/secret key in this app.

## Run
Serve this directory from a local static web server (ES modules and service workers do not work reliably from file://). For example: `python -m http.server 8000` from this directory.

The database migration `database/migrations/005_farmer_portal_auth_rls.sql` links Auth identities to existing app users and applies owner-scoped RLS. Apply it before using the app.

## Important
- Supabase Auth email confirmation settings determine whether a new user can enter immediately or must confirm email first.
- Configure the deployed app URL in Supabase Auth redirect/site URL settings before production deployment.
- This is the first farmer portal slice, not a production launch: map selection, crop cycles, soil/water records, AI advice and offline data sync are follow-on work.
