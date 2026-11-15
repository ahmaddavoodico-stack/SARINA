# SARINA
Sarina Central Intelligence Platform

## Farmer workspace (first implementation)
The first farmer-facing web app is being developed on the `feature/farmer-portal-foundation` branch.

- App source: [app/](./app/)
- Database migration: [005_farmer_portal_auth_rls.sql](./database/migrations/005_farmer_portal_auth_rls.sql)
- Pull request: [#1 — Build the first SARINA farmer portal](https://github.com/ahmaddavoodico-stack/SARINA/pull/1)

The app currently supports farmer email sign-up/sign-in, profile linkage to Supabase Auth, and create/list of farmer-owned farms. See [app/README.md](./app/README.md) for setup notes.
