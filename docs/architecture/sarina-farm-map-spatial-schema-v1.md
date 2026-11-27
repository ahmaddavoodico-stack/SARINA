# SARINA — Farm Map Spatial Schema & Migration Design V1

**Status:** Design artifact only; not an executable migration  
**Branch:** `feat/farmer-map-conversation-v1-mainline`  
**Database review:** Read-only inspection of project `wwgkiclcpgpdktneovrx`, 2026-11-27  
**Safety boundary:** No DDL/DML, migration application, policy change, merge, or Production deployment is included or authorized by this document.

## 1. Decision summary

Keep existing farm, field, crop, and irrigation-event records as the canonical foundations. Add three distinct spatial concepts rather than stretching one generic table to cover every domain:

1. **Individual trees** — a normalized `farm_trees` register with stable identity and lifecycle history. Trees are not generic equipment assets.
2. **Non-tree spatial features** — a typed `farm_map_features` layer for line and polygon infrastructure, crop blocks, and irrigation zones. Point-like equipment remains in the point-asset model.
3. **Irrigation connectivity** — explicit network-edge records connecting mapped point assets and line features to zones. Proximity never implies connectivity.

The existing branch-only `farm_assets` migration must be reconciled before it is treated as a production-ready foundation. In particular, remove `tree` from its equipment category if the separate tree register is adopted, and do not classify canals, drains, or irrigation lines as points.

## 2. Existing tables to reuse

| Existing table | Canonical responsibility | Do not duplicate |
|---|---|---|
| `farms` | Farm identity, owner, aggregate area | A second farm identity/owner model |
| `farm_fields` | Field boundaries and field-level area | A second field-boundary table |
| `crop_catalog`, `crop_varieties` | Crop and variety vocabulary | New parallel crop/variety catalogs |
| `crop_cycles` | Crop season, planting/harvest, crop role, field/farm linkage | A second crop-season/intercrop registry |
| `irrigation_events` | Time-bound irrigation application history | Permanent pipes, valves, zones, or graph connectivity |
| `crop_activities` | Work and input events | Spatial asset inventory |

The existing `farms.water_structures` and `farms.irrigation_systems` JSON arrays remain legacy/compatibility summaries until their readers and writers are audited. They must not become a second authoritative geometry store.

## 3. Proposed entities

### 3.1 `farm_trees` — one stable row per individual tree

Proposed fields:

- `id uuid primary key`; `farm_id uuid not null`; `field_id uuid null`.
- `crop_cycle_id uuid null` to connect a tree to the relevant orchard/crop context when a suitable cycle exists.
- `tree_code text null` for a farmer-friendly identifier; uniqueness scoped to a farm when present.
- `crop_catalog_id` / `crop_variety_id` only after exact existing key types and FK semantics are verified; do not invent catalog columns or copy crop names into authoritative fields.
- `location geometry(Point,4326) null`, location source, accuracy, confirmation flag and timestamp. Null is allowed for a registered tree whose exact location has not yet been captured.
- `planting_date date null`, `age_years numeric null` with provenance/observation date when age is estimated.
- `lifecycle_status`: `alive | dead | removed | unknown`.
- `death_date date null`, `death_cause_code text null`, `death_evidence_source` and confidence; a cause is never a diagnosis unless specialist-assessed.
- `replaced_by_tree_id uuid null`, timestamps and actor references.

Required invariants:

- A dead or removed tree is retained; lifecycle changes never delete the tree identity.
- A replacement receives a new `id`; the old row links to the new row. Enforce same-farm replacement using a composite self-reference `(replaced_by_tree_id, farm_id) -> (id, farm_id)`.
- A replacement must not point to itself; cycle detection belongs in a guarded transaction/trigger or service invariant and needs tests.
- Field and crop-cycle references must belong to the same farm. Use composite candidate keys and composite foreign keys after confirming the referenced tables can support them.
- Tree location is optional until captured; if present it must be non-empty WGS84 Point and inside the confirmed parent field/farm boundary before it is marked confirmed.
- Tree history is append-only in `farm_tree_events` (tree_id, farm_id, event_type, occurred_at, evidence_source, confidence, actor, structured event details). Correcting an event should create a superseding/correction event, not erase the audit trail.

### 3.2 `farm_map_features` — non-point geographic features

One row represents one mapped feature. Proposed fields:

- `id uuid primary key`, `farm_id uuid not null`, `field_id uuid null`.
- `feature_type text not null` with a controlled allowlist.
- `geometry geometry(Geometry,4326) not null`, with a check that permits only the supported line and polygon families (including their Multi* forms) and rejects Point.
- `geometry_source`, positional accuracy, confirmation flag/timestamp, status, optional dimensions (`width_m`, `depth_m`, `length_m`), capacity and units where applicable.
- `crop_cycle_id uuid null` for crop-plot geometry; crop identity/variety/date remain in `crop_cycles`.
- `attributes jsonb` only for non-query-critical optional details; all filtering, joins, authorization, and calculations must use typed columns.

Initial feature types:

| Geometry family | Feature types |
|---|---|
| Polygon / MultiPolygon | `pond`, `reservoir`, `greenhouse`, `building`, `crop_plot`, `irrigation_zone` |
| LineString / MultiLineString | `drain`, `canal`, `irrigation_pipe`, `irrigation_main`, `irrigation_lateral`, `fence`, `farm_route` |

Rules:

- `crop_plot` requires a valid `crop_cycle_id`; non-crop features must not carry one.
- `irrigation_zone` must be polygonal.
- Width/depth/capacity are optional and must not be confused with map-derived measurements. Store entered values and measured values separately if both are required.
- Feature geometry must be valid, non-empty, SRID 4326 and of the type allowed by `feature_type`.
- A field-scoped feature must be contained by that field's confirmed boundary; a farm-scoped feature must be contained by a confirmed farm/field boundary policy appropriate to that geometry.
- Do not assume every field geometry is confirmed; an unconfirmed parent cannot authorize a child as confirmed.

### 3.3 Irrigation topology — explicit edges, not inferred proximity

Use `farm_assets` for point-like physical nodes such as wells, pumps, valves, and point tanks/sensors. Use `farm_map_features` for pipe/canal/drain geometry and irrigation-zone polygons.

Add `irrigation_network_edges` as a relational connection record:

- `id`, `farm_id`, `edge_feature_id` (must reference a line-type `farm_map_features` row in the same farm).
- `from_asset_id`, `to_asset_id` (both must reference point assets in the same farm; endpoints may be nullable only for explicitly declared open ends).
- `irrigation_zone_feature_id` (optional polygon zone in the same farm).
- `flow_direction`, `network_role`, `status`, provenance and confirmation fields.

Do not derive a connection because two assets are close or a line visually crosses a point. The farmer or qualified specialist must explicitly confirm each edge. A network can be incomplete while being drafted; incomplete edges must not be presented as a verified functioning network.

## 4. Farm/field integrity and geometry constraints

- Add composite candidate keys such as `(id, farm_id)` to referenced parent tables only after checking existing unique constraints and migration compatibility.
- Child records must use composite foreign keys for `(field_id, farm_id)`, `(crop_cycle_id, farm_id)`, and same-farm asset/feature/tree references. Simple independent FKs are insufficient to prevent cross-farm references.
- Prefer restrictive field deletion while child features exist; explicit reassignment/detachment must happen in a reviewed transaction. Avoid `ON DELETE SET NULL` on only one side of a composite farm/field relation if it can leave inconsistent ownership.
- Add B-tree indexes for farm/field and relation keys; add GiST indexes for geometry columns.
- Validate SRID 4326, expected geometry family, non-empty geometry, validity, coordinate ranges, and containment. A trigger or RPC must not silently repair invalid geometry or invent coordinates.
- Use spatial predicates against confirmed parent geometry; test boundary edge cases and multipart geometries. Do not use centroids as a substitute for actual point capture.
- Preserve source, accuracy, confirmation time, actor and edit history for all spatial changes.

## 5. RLS and API exposure design

### Observed current policy conventions

Read-only inspection confirmed these existing patterns:

- Farmer ownership resolves through `farms.owner_user_id -> users.id` and `users.auth_user_id = (select auth.uid())`.
- Active contracted expert read uses `is_current_user_active_expert_for_farm(farm_id)`.
- Organization-scoped farm read uses `organization_has_scoped_access(..., 'oversight.farm.read', ...)`, with `is_sarina_admin()` included in the current farms policy.
- `farm_fields` and `crop_cycles` have farmer-management and active contracted-expert SELECT policies; `farms` also has organization-scoped SELECT.

### Proposed policy matrix

| Actor | Read | Write |
|---|---|---|
| Owning farmer | Own farm children | Own farm children, subject to confirmation and lifecycle rules |
| Active contracted expert | Read only for farms covered by `is_current_user_active_expert_for_farm(farm_id)` | No blanket write; any future write requires a separately scoped explicit permission |
| Organization oversight reader | Only when existing `oversight.farm.read` scope grants access to that farm | No write |
| Unrelated authenticated user | None | None |
| Anonymous user | None | None |
| SARINA admin | Only via existing explicit admin policy conventions | Only via explicit admin workflow, not an accidental broad policy |

Implementation rules:

- Enable RLS on every new table in exposed schemas.
- Build owner and expert policies using the exact existing helpers/conventions; do not create a parallel authorization function.
- Organization scope on child rows must be derived through the parent farm and the existing scoped-access helper; do not grant all organization members blanket access.
- UPDATE requires both a qualifying SELECT policy and matching `USING` and `WITH CHECK` predicates. Test both row visibility and mutation.
- Never authorize with user-editable `user_metadata`; use `auth.uid()` and trusted existing authorization helpers.
- Grants and RLS are separate. Explicitly decide whether each new table is reachable through Data API; grant only required operations to required roles. The October 30, 2026 Supabase rollout means new `public` tables may no longer be automatically exposed, so do not assume either automatic access or automatic denial—inspect project defaults and declare grants deliberately.
- No SECURITY DEFINER helper should be added merely to bypass an RLS failure.

## 6. Migration sequencing — design only

Do not author/apply the executable migration until the exact key types, constraints, current farm_assets migration, trigger conventions, grants/default privileges, and RLS helper definitions are rechecked against the target non-production database.

Suggested migration units:

1. **Foundation and integrity:** verify PostGIS extension schema; add safe composite candidate keys if needed; create farm-tree register and event history; indexes and constraints.
2. **Spatial features:** create line/polygon feature table, feature-type/geometry checks, farm/field/crop-cycle same-farm relations, GiST indexes.
3. **Irrigation topology:** create explicit network-edge relation and same-farm references to point assets, line features, and zone polygons.
4. **Authorization:** enable RLS, create owner/expert/organization-scoped read policies, restrict grants, and add policy regression tests.
5. **Compatibility:** reconcile the point-only `farm_assets` branch migration, remove duplicate tree/linear/area asset categories, and verify no existing UI or JSON consumer is broken.

Every unit must be independently reviewable and safe to roll back. Prefer additive changes first; do not rewrite existing farm/crop/event data in place. No automatic backfill of spatial coordinates is allowed.

## 7. Required test matrix before a non-production apply

### Schema and relational integrity

- Valid same-farm field, crop-cycle, tree, feature, asset, zone and network-edge references are accepted.
- Cross-farm `field_id`, `crop_cycle_id`, `asset_id`, `feature_id`, zone and replacement-tree references are rejected.
- Crop-plot without a crop cycle and non-crop feature with a crop cycle are rejected.
- Point geometry in `farm_map_features`, polygon geometry for a line feature, wrong SRID, empty geometry, invalid polygon and out-of-range coordinates are rejected.
- MultiLineString/MultiPolygon and polygon holes are accepted where the selected feature type supports them.
- Out-of-bound child geometry is rejected for confirmed parent boundaries; unconfirmed geometry cannot become verified.
- Deleting a referenced field/tree/asset/feature cannot orphan or silently reassign dependent records.
- Tree lifecycle changes retain history; replacement creates a new identity, same-farm relation, and no replacement cycle.
- Irrigation edges require explicit endpoint/zone relations; visual proximity alone creates no relation.

### RLS authorization matrix

Run each case as separate authenticated identities and assert both SELECT and write outcomes:

- Owning farmer: read/write only own farm rows.
- Active contracted expert: read only assigned farm rows; cannot insert/update/delete.
- Expired, revoked, or unassigned expert: no access through the expert policy.
- Organization member with `oversight.farm.read`: scoped read only for permitted farms.
- Organization member without that capability: no access.
- Unrelated authenticated user: no access.
- Anonymous role: no access.
- SARINA admin: only the explicitly intended admin path.
- Attempted UPDATE that changes `farm_id` or `field_id` to another farm is rejected by both RLS and relational constraints.
- Verify Data API grants independently of RLS; a missing grant and a denied row must be distinguishable.

### Operational and UI tests

- Concurrent edits cannot create duplicate tree codes or replacement cycles.
- Spatial edits preserve original and new geometry in audit history.
- Mobile map placement, undo/cancel, explicit confirmation and farm switching never mix farm records.
- Unconfirmed items remain visually distinct and excluded from verified analytics.
- Existing farm/field/crop-cycle/irrigation-event workflows continue to work without schema regressions.
- Backup/restore rehearsal and migration rollback are demonstrated in non-production.

## 8. Explicit unresolved checks before executable SQL

These must be verified from the exact target database before writing migration files:

1. Exact data types and existing unique constraints for `farms.id`, `farm_fields.id/farm_id`, `crop_cycles.id/farm_id`, and `farm_assets` references.
2. Full definitions and grants for `is_current_user_active_expert_for_farm`, `organization_has_scoped_access`, and `is_sarina_admin`.
3. Whether `postgis` is installed in `public` or `extensions`; use the actual extension schema in geometry references/functions.
4. Existing triggers for `updated_at`, audit, boundary validation, and farm/field deletion.
5. Data API default privileges and exact grants required by the current app clients.
6. Whether the point-asset migration needs to be revised before any spatial feature UI can be activated.

## 9. Acceptance gate

This design is ready for implementation review, **not** database application. The next authorized engineering step is to verify the six unresolved checks above and convert the approved design into migration files plus automated SQL/RLS tests on the isolated branch. Applying those migrations requires separate explicit authorization and an approved non-production target. Production, live data, PR merge, and production deployment remain untouched.
