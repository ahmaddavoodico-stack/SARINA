# Deployed Supabase Edge Functions

Source snapshots in this directory were retrieved from the active Supabase project on 2026-11-16. They are source-control copies, not proof of a complete deployment backup.

All six observed functions were ACTIVE and had JWT verification enabled at snapshot time:

- sarina-siacp-bridge (v4)
- farm-weather-context (v1)
- farm-land-context (v4)
- sarina-central-intelligence (v1; includes _shared/sci-contract.ts)
- sarina-contract-workflow (v1)
- organization-registration (v2)

Do not commit .env files or secret values. Runtime secrets must be recreated through a secure secret manager on a target project. Before redeployment, inspect the function source, confirm all required environment variable names, and verify the function configuration against the current Supabase project.

The live project may change after this snapshot. Refresh these sources before any production migration.
