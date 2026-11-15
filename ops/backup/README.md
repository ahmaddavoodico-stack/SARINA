# SARINA — Backup, Restore and Provider Exit Plan

Policy: The current Supabase project remains the source of truth until an independent backup exists, a restore has been tested on an isolated target, and the first SARINA acceptance test has passed. Never delete, pause, overwrite, or migrate the current project during preparation.

## What must be preserved

A database-only dump is not a complete project backup. Track these layers separately:

1. Postgres: schema, data, indexes, constraints, RLS policies, grants, functions, triggers, extensions, sequences and migration history.
2. Authentication: auth users and identities where supported by the selected export route, provider configuration, redirect URLs, SMTP, templates, MFA, JWT configuration and recovery procedures. Treat identity data and password hashes as highly sensitive.
3. Storage: bucket definitions, access policies, object metadata and the actual object bytes. Database backups do not contain Storage object bytes.
4. Edge Functions: source code, function configuration, names of environment variables and separately escrowed secret values.
5. Platform configuration: Data API exposure, Auth providers, Realtime, custom domains, webhooks, scheduled jobs, secrets, OAuth callbacks, enabled extensions and DNS.
6. Application source: Git repository, branch history, deployment configuration, environment-variable inventory (never values) and release commit SHA.

## Database export (operator-run)

Use a trusted workstation or secured backup runner with a current Supabase CLI, Docker and PostgreSQL client tools. Obtain the database connection string from Supabase Dashboard > Connect. Keep it in a local secret manager or temporary shell environment. Never place it in this repository, a browser bundle or chat.

Verify the installed CLI syntax first:

    supabase db dump --help

Example export:

    export SUPABASE_DB_URL='[securely supplied connection string]'
    mkdir -p backup/$(date -u +%Y%m%dT%H%M%SZ)
    cd backup/<timestamp>
    supabase db dump --remote="$SUPABASE_DB_URL" -f roles.sql --role-only
    supabase db dump --remote="$SUPABASE_DB_URL" -f schema.sql
    supabase db dump --remote="$SUPABASE_DB_URL" -f data.sql --use-copy --data-only

Inspect generated files and verify which managed schemas are included/excluded for the exact CLI version. Explicitly verify whether Auth records are present; do not assume database export covers all Auth users or settings. Compare the export to the current official platform-to-self-hosted guide before relying on it.

## Storage export

- Enumerate every bucket and record public/private status, limits, MIME restrictions and policies.
- Export every object byte-for-byte using the Storage API or supported S3-compatible endpoint.
- Preserve paths and metadata. Create a manifest with bucket, path, byte size, content type, checksum and export timestamp.
- Compare object counts and checksums after restore. The storage.objects metadata table is not a substitute for object bytes.

## Edge Functions and platform configuration

- Download source for every deployed Edge Function and commit source to Git.
- Export a names-only inventory of secrets and environment variables. Transfer secret values separately using a password manager or secret vault; never commit them.
- Record Auth providers, redirect URLs, SMTP, webhooks, Realtime settings, extensions, custom domains and integration callback URLs.
- Keep a signed-off inventory of external integrations and their required credentials.

## Integrity and restore acceptance

A backup is not accepted until:
- All expected export files exist and are non-empty.
- SHA-256 checksums and a manifest are generated.
- A second encrypted copy exists outside the Supabase project and outside GitHub.
- Restore completes on a separate disposable PostgreSQL/Supabase target.
- Critical table counts, migration history, RLS policies, functions and extensions are compared.
- Storage object counts and checksums match.
- Auth login and password-reset flows are tested with test accounts.
- Edge Functions are redeployed and smoke-tested where applicable.
- SARINA authenticates and reads/writes test records against the restored target.

Maintain at least two independent copies in separate failure domains. Encrypt backups at rest and in transit, restrict access and test restoration periodically.

## Migration gate — no cutover before all checks pass

1. Choose the production server/provider only after the first application acceptance test and backup/restore test.
2. Match PostgreSQL major version and required extensions where possible. Review self-hosted feature gaps and operational responsibilities.
3. Restore roles, schema and data into a new target. Recreate platform configuration, Storage bytes, Auth providers, secrets, Edge Functions, DNS and TLS separately.
4. Run acceptance tests on the new target while the current Supabase project remains untouched.
5. Plan a write freeze or controlled final delta export. Verify row/object counts and checksums, then switch application environment variables and DNS.
6. Keep the original Supabase project intact and available for rollback until the new environment passes the agreed observation period.
7. Only then consider decommissioning the old project with explicit owner approval.

## Current state

- This repository change has not created an independent full backup.
- No production database password or service-role key is stored here.
- The PWA uses only a browser-safe publishable key and Supabase Auth. Service/request reads are best-effort and must be verified against Data API grants and RLS.
- Storage objects, Edge Functions, Auth provider configuration and project-level settings require separate inventory/export.
- GitHub is the source-control home for application source and this runbook, not the backup location for production data.

## Official references

- https://supabase.com/docs/guides/self-hosting/restore-from-platform
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/reference/cli/supabase-db-dump
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
