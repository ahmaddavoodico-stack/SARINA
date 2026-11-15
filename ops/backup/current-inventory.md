# Current Supabase Backup Inventory

Snapshot date: 2026-11-16
Project reference: wwgkiclcpgpdktneovrx
Region: ap-northeast-2
PostgreSQL engine: 17.11.0.019 (major 17)
Project status: ACTIVE_HEALTHY

## Observed data inventory

- Auth users: 1 (count only; no identity data exported here).
- Storage buckets: 0.
- Storage objects: 0.
- Active Edge Functions: 6.
- Installed extensions: pg_stat_statements 1.11, pgcrypto 1.3, plpgsql 1.0, postgis 3.3.7, supabase_vault 0.3.2, uuid-ossp 1.1.

## Active Edge Functions and source snapshot

| Function | Active version | JWT verification |
|---|---:|---|
| sarina-siacp-bridge | 4 | enabled |
| farm-weather-context | 1 | enabled |
| farm-land-context | 4 | enabled |
| sarina-central-intelligence | 1 | enabled |
| sarina-contract-workflow | 1 | enabled |
| organization-registration | 2 | enabled |

The deployed source files were retrieved from the active Supabase project and copied into supabase/functions/. The Central Intelligence function includes its shared sci-contract helper. No hard-coded credential patterns were detected in the retrieved source files; environment variable names remain references only and secret values were not exported.

## Important gaps

- This is an inventory snapshot, not a complete backup.
- No database schema/data dump has been generated or restored.
- Auth user count was checked, but Auth identities, provider configuration, templates, SMTP and other Auth settings have not been exported.
- There are currently no Storage buckets or objects, so no object bytes were present to export at snapshot time.
- Edge Function code is now versioned in this repository, but deployed secrets and function-level settings still need secure export/recreation.
- Supabase migration history includes versions 028–031 applied directly to the project, but corresponding migration SQL files are not yet present in this repository. Do not reconstruct them from memory; export the exact live schema or recover the original migration SQL before self-hosted restore.

## Next backup checkpoint

Obtain a secure operator environment with Supabase CLI and database connection access, export roles/schema/data, inspect the dump for Auth coverage, checksum the files, store encrypted copies outside Supabase and GitHub, then restore to an isolated target and compare critical counts and policies.
