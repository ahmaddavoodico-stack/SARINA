# SARINA

SARINA is an international-ready, farmer-first agricultural platform. The initial web application is a Persian RTL installable PWA, with an architecture intended to expand to additional languages and role-based workspaces.

## Current app foundation

- React + TypeScript + Vite.
- Persian-first, right-to-left responsive farmer workspace.
- Installable PWA shell and offline navigation fallback.
- Supabase Auth using a browser-safe publishable key only.
- First read-only integrations for active organization services and the signed-in farmer's institutional request list.
- Clear empty states while operational data is not yet populated.

## Run locally

1. Install Node.js (LTS) and npm.
2. Copy .env.example to .env.local.
3. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY from the Supabase project.
4. Install dependencies and run:

       npm install
       npm run dev

5. Create a production build:

       npm run build

Never put service_role keys, database passwords or provider secrets in VITE_* variables. Do not commit .env.local.

## Important implementation boundary

The PWA foundation is committed on feat/pwa-first-version. The service directory and request list use read-only queries and require Data API exposure plus correct RLS policies. The current database has no verified organizations or active services, so the directory can legitimately be empty. Request creation, farm records, file uploads, organization dashboards and central administration must be added only after their ownership mapping and access rules are tested.

## Backup and migration

Read ops/backup/README.md before any production change. No production data backup is performed by the frontend build. The current Supabase project remains authoritative until independent backups and an isolated restore test have passed.

## Project governance

See ORGANIZATION_GOVERNANCE.md for the institutional governance and service-routing model.

## Deployment verification

This documentation-only commit is used to trigger a fresh Vercel deployment from the production branch. It does not change application code, database schema, or runtime behavior.
