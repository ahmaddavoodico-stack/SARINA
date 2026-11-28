# Environmental Dossier — Database Reconciliation Audit

**Branch:** `feature/environmental-dossier-integration`
**Audited:** 2026-11-28
**Mode:** Read-only inspection of Supabase project `wwgkiclcpgpdktneovrx` and repository `main`.
**Changes applied to database:** None.

## Executive result

The existing `farm_environmental_assessments` table is already present in production and its live columns, constraints, RLS policies, version trigger, and grants match the repository migration's intended design. The previous assumption that the assessment migration was absent was incorrect.

There is, however, a migration-history version discrepancy that must be reconciled before future schema migrations: the database records `20261126200445 / farm_environmental_assessment_snapshots`, while the repository file is named `20261126220000_farm_environmental_assessment_snapshots.sql`. Do not replay this create-table migration or create another assessment table. Determine the canonical history/version mapping in a controlled migration workflow.

## Verified live schema

### `public.farm_environmental_assessments`

Live columns:
- `id uuid` primary key, generated UUID;
- `farm_id uuid` not null, FK to `farms(id)`, cascade on farm deletion;
- `version integer` not null;
- `assessment_schema_version text` default `1.0`;
- `assessment_status text` constrained to `partial | complete | needs_review`;
- `assessed_at timestamptz`, `valid_until timestamptz`;
- `source_manifest jsonb` default array;
- `evidence_payload jsonb` and `quality_summary jsonb` default objects;
- `missing_domains jsonb` default array;
- `created_by_auth_user_id uuid` default `auth.uid()`;
- `created_at timestamptz`.

Constraints include unique `(farm_id, version)`, positive version, manifest/missing-domain JSON arrays, and the farm foreign key.

### Versioning

A `BEFORE INSERT` trigger calls `assign_farm_environmental_assessment_version()`. It obtains a transaction advisory lock keyed by farm ID and assigns `max(version)+1`. This is an existing mechanism and should be reused rather than replaced.

### Access controls

- RLS is enabled.
- Authenticated farmers can select their own farm snapshots.
- Existing active farm experts can select within the current expert-farm authorization helper.
- Authenticated farmer inserts are checked against the farm owner mapping.
- Authenticated users have no UPDATE, DELETE, or TRUNCATE privilege in the migration's intended grants.
- Service role retains privileged server-side access.

Before implementation, review the helper's exact authorization semantics for all intended specialist/case types. Do not broaden this policy casually.

## Migration reconciliation

- Database history contains `20261126200445 / farm_environmental_assessment_snapshots`.
- Repository `main` contains `supabase/migrations/20261126220000_farm_environmental_assessment_snapshots.sql`.
- The live table definition and policies match the repository SQL inspected in this audit.
- Therefore this is not a missing-table problem. It is a migration version/name discrepancy. The migration must not be applied again. Reconcile the migration ledger and repository naming through a reviewed, non-destructive migration-history procedure before the next schema migration is released.

## Current data readiness

Observed live row counts:
| Table | Rows |
|---|---:|
| farms | 1 |
| farm_locations | 1 |
| farm_fields | 1 |
| farm_environmental_assessments | 0 |
| weather_records | 0 |
| soil_tests | 0 |
| water_tests | 0 |
| farm_observations | 0 |
| regional_data_sources | 0 |
| regional_datasets | 0 |

The single existing field has a non-null `boundary` geometry and a confirmation timestamp. This means the current farm has a confirmed polygon available for parcel-aware spatial work; implementation must still validate geometry type, SRID, validity, and coordinate bounds at runtime.

## Security and performance advisor observations

The project-wide security advisor returned several findings, including:
- one exposed public table with RLS disabled: `public.spatial_ref_sys` (PostGIS metadata; review exposure separately);
- multiple RLS-enabled tables with no policies;
- exposed SECURITY DEFINER RPC warnings.

These findings are project-wide and are not evidence that the environmental-assessment table itself is unprotected. The assessment table specifically has RLS enabled and the two expected policies. Do not modify unrelated policies or extension placement as part of this dossier integration without a separate scoped security review.

The performance advisor reports several project-wide unused indexes and multiple permissive policies. No dossier-specific performance change is justified from this audit alone.

## Implementation decisions

1. Reuse `farm_environmental_assessments` unchanged as the immutable snapshot store for the first integration pass.
2. Reuse the existing per-farm version trigger.
3. Do not add columns until the actual builder contract and cache requirements are implemented and reviewed.
4. Treat `source_manifest`, `evidence_payload`, `quality_summary`, and `missing_domains` as the existing snapshot envelope.
5. Build a server-side writer with strict farm authorization, idempotency, and partial-domain outcomes. Keep service-role access server-side only.
6. Use the confirmed `farm_fields.boundary` geometry when present; explicitly mark spatial evidence unavailable when a usable polygon is absent.
7. Reconcile migration history without reapplying the table-creation migration.
8. Run targeted RLS tests for owner, assigned specialist, unrelated farmer, and unauthenticated caller before release.

## Next engineering step

Implement the central dossier builder and evidence normalization in the existing SARINA central architecture, with read-only provider adapters first. Persisting snapshots should be gated until the authorization tests and migration-ledger reconciliation are complete. No provider secrets, source licensing, or live data quality should be inferred from the presence of function code alone.
