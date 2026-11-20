# SARINA central administrator role management

## Purpose
Provide an auditable central-admin workspace for changing a user's global SARINA activity roles without creating a duplicate account or changing the authentication identity.

## Supported global roles
- farmer
- livestock_keeper
- expert
- organization

The central `admin` role is intentionally not grantable or removable from this workspace. Organization- and farm-scoped assignments remain separate from global roles.

## Security model
- The UI calls the dedicated admin RPCs; it does not write role rows directly.
- Server-side authorization checks the existing central-admin predicate.
- Role changes are recorded with actor, target, and before/after snapshots in a private audit table.
- The audit table is not client-readable.
- Self-escalation and modification of the admin role are rejected by the database functions.

## Activation requirements
Apply the additive migration `20261117220000_admin_user_management.sql` to the intended Supabase project, then test the RPCs with a central-admin account and an ordinary account. The presence of the UI alone does not prove database activation or successful authorization.
