# SARINA Phase Zero — Security Remediation Preparation

**Snapshot:** 2026-11-23  
**Project:** `wwgkiclcpgpdktneovrx`  
**Status:** Prepared in Git; not applied to any Supabase database.

## 1. What was confirmed

### 1.1 Specialist handover authorization defect

The active policy `expert_case_handovers_assigned_expert_insert` was inspected in PostgreSQL, not inferred from the UI. Its deparsed expression contains:

```sql
er.requester_user_id = er.requester_user_id
```

The source migration used an unqualified right-hand column reference. Inside the subquery PostgreSQL resolved it to the inner `expert_requests` row, making the owner comparison a tautology. The specialist client currently supplies the real farmer ID, but client payloads are not a security boundary.

The existing consent RPC checked the `requester_user_id` stored in the handover row against the signed-in SARINA user. Because the insert policy did not bind that field to the actual request owner, the RPC needed an independent request-owner join as defense in depth.

### 1.2 Existing and future privilege overreach

The connected project is PostgreSQL 17.11. Read-only inspection found:

- Broad `TRUNCATE`, `REFERENCES`, `TRIGGER` and `MAINTAIN` grants on public tables for client roles.
- Default privileges for both `postgres` and `supabase_admin` in schema `public` grant `anon` and `authenticated` broad table privileges, sequence privileges and function execution. Without correcting defaults, newly created objects can inherit the same overbroad access.
- Backend-owned AI/provider, messaging configuration, key-registry and communication-log tables have RLS enabled but no user-facing policies, while client grants remain present.
- `expert_case_notifications` is intended to allow recipient-scoped SELECT and UPDATE of `read_at` only; existing grants include unnecessary operations.
- `expert_case_handovers` needs only participant SELECT and assigned-specialist INSERT; clients do not need direct UPDATE or DELETE.

## 2. Prepared artifacts

| Artifact | Purpose | State |
|---|---|---|
| `supabase/patches/phase_zero_20261123_access_hardening.sql` | Candidate forward-only SQL hardening patch | Committed; not applied |
| `supabase/tests/phase_zero_access_hardening_regression.sql` | Read-only assertions for grants, policy and RPC definitions | Committed; not run |
| This runbook | Backup, migration and acceptance gates | Committed |

The candidate patch:

1. Explicitly qualifies `expert_case_handovers.requester_user_id` in the INSERT policy.
2. Makes the consent RPC join the handover to its request and require the real request owner to be the authenticated caller.
3. Revokes DDL-like client privileges on existing public tables.
4. Removes broad default table, sequence and function grants for `anon` and `authenticated` from future public objects created by `postgres` or `supabase_admin`.
5. Removes table-level and column-level client grants from backend-owned AI/provider/messaging tables until explicit user-facing policies are designed.
6. Limits notification access to recipient-scoped SELECT and UPDATE(`read_at`).
7. Limits handover table access to SELECT and INSERT under the existing RLS policies.

The candidate patch is deliberately outside `supabase/migrations`. It must not be treated as an automatically deployable migration.

## 3. Why no database change has been applied

### 3.1 Migration-history drift

A read-only comparison found:

- 132 migration versions recorded as applied in the connected database.
- 78 SQL files in the repository's `supabase/migrations` directory on `main`.
- 72 applied database versions do not have a matching local migration file.
- 18 local migration files are not present in the connected database's applied migration history.

Do not run `supabase db push`, reset a branch, or promote a migration from this repository until the mismatch is reconciled. Recover exact historical migration SQL or establish a verified schema baseline from a trusted export; do not recreate missing migrations from memory.

### 3.2 Backup and restore gate

The current backup runbook says there is no independent full backup and no tested restore. A database-only dump is not enough: Auth configuration, Storage object bytes, Edge Functions, secrets inventory and platform settings must be tracked separately.

The live project currently has six Storage buckets, zero Storage objects and seven active Edge Functions. The older inventory file is stale and must be refreshed as part of the backup checkpoint.

The connected Supabase project has no development branches. Creating a branch may incur hourly cost and requires cost review/approval. No branch has been created.

### 3.3 Production safety

No production DDL, grant change, policy change, function replacement, migration application, branch reset or deployment was performed during this preparation.

## 4. Required execution sequence

1. **Reconcile migration history:** compare all applied versions with repository files and recover exact missing SQL or create a documented baseline.
2. **Create an independent encrypted backup:** roles, schema, data, migration history, Auth coverage, Storage metadata and bytes, Edge Function sources, platform configuration and a secrets-name inventory. Secret values must never enter Git or chat.
3. **Restore to an isolated target:** verify table counts, policies, grants, functions, triggers, extensions, Auth test login and Storage object checksums.
4. **Create/use a development database branch only after cost is understood and approved.** Apply the candidate patch there, not to production.
5. **Run the companion SQL regression test.** It must pass without weakening RLS.
6. **Run behavioral role tests with independent test identities:**
   - Assigned verified specialist cannot submit a handover with their own SARINA user ID substituted as the farmer.
   - Assigned verified specialist cannot call the consent RPC as the farmer.
   - Actual farmer can accept and decline a valid handover.
   - Unrelated farmer cannot approve another farmer's handover.
   - Substitute acceptance completes the handover and revokes the previous specialist assignment.
   - Recipient can mark only their own notification as read; cannot alter its preview or another recipient's notification.
   - Anonymous and authenticated clients cannot directly read/write backend-owned AI/provider/messaging tables.
7. **Review application smoke tests** for farmer requests, specialist case intake, notification realtime and consent flow. The patch intentionally makes backend-owned AI tables server-only until proper conversation ownership policies are designed.
8. **Only after successful branch tests and migration-history reconciliation:** convert the candidate into a timestamped forward-only migration and plan controlled production rollout with rollback/restore evidence.

## 5. Findings intentionally not changed by this patch

- `public.spatial_ref_sys` is a PostGIS-managed relation flagged for RLS review. Do not blindly enable RLS or alter extension-owned objects; decide whether to restrict Data API exposure or relocate the extension through a separately tested plan.
- Security Advisor reports several other RLS-enabled tables without policies and SECURITY DEFINER RPCs callable by `anon` or `authenticated`. Review each table/function against its intended role matrix; do not apply a blanket policy or blanket function revoke.
- The AI conversation tables remain unavailable directly to client roles until owner-scoped policies and the package-one chat data flow are designed and tested.

## 6. Acceptance state

- [x] Handover defect reproduced from active policy definition.
- [x] RPC defense-in-depth design prepared.
- [x] Existing and future privilege-remediation design prepared.
- [x] Candidate SQL patch committed outside migration runner path.
- [x] Read-only regression assertions committed.
- [ ] Independent backup created and checksummed.
- [ ] Restore tested on isolated target.
- [ ] Migration history reconciled.
- [ ] Candidate patch applied to development target.
- [ ] SQL regression test passed.
- [ ] Two-account behavioral security tests passed.
- [ ] Production rollout approved and completed.

**Rule:** a committed patch is not an applied patch; an applied patch is not a tested patch; a passing static SQL test is not a substitute for two-account runtime authorization tests.
