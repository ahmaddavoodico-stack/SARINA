# SARINA — My Farm Map Builder V1

**Status:** Product workflow approved; implementation specification on the isolated feature branch  
**Branch:** `feat/farmer-map-conversation-v1-mainline`  
**Release boundary:** Documentation only in this slice. No database migration, production data change, provider activation, merge, or production deployment.

## Product outcome

Turn the farmer's conversation and confirmed answers into a structured farm dossier, then guide the farmer through building a spatially accurate digital twin of the real farm. The map is the primary farm-management workspace, not a decorative illustration.

## Required onboarding and map sequence

The sequence is ordered. A later stage must not be presented as complete or enabled before its prerequisites are confirmed.

1. **Conversation-first intake**
   - SARINA asks short, contextual questions in a natural conversation.
   - Capture farm identity/location, farming activity, tree crops, other crops grown alongside trees, irrigation method, water sources, infrastructure, known problems, and history.
   - Accept voice or text where the corresponding capability is genuinely connected.
   - Record answer provenance and confidence. Unknown answers remain unknown; do not silently infer them.

2. **Initial farm dossier**
   - Convert conversation answers into structured draft records.
   - Show a concise review/confirmation step.
   - Mark missing, estimated, farmer-reported, specialist-verified, and system-derived values distinctly.
   - The dossier may preselect likely map-feature templates and sticker categories, but must not create spatial features before the farmer places/confirms them.

3. **Prepare the farm-specific sticker/tool palette**
   - Prepare reusable visual assets and map tools based on the dossier: tree species/types, ponds/reservoirs, greenhouses, buildings, pumps, valves, pipes, canals, drains, sensors, and crop-plot types.
   - A sticker is a visual representation of a typed record, not the source of truth. It must reference a persistent feature/tree/crop record.
   - Do not generate a unique image for every individual tree. Use a curated, reusable sticker library with meaningful variants (species, healthy/dead state, equipment type); metadata remains in the record.
   - The farmer can add, remove, or correct suggestions before placement.

4. **Farm boundary first**
   - Capture the real farm perimeter using GPS-assisted vertex capture, map taps, or an approved/imported survey.
   - Draw the polygon, calculate area, allow vertex edits, show units, and ask the farmer to confirm.
   - Preserve source, timestamp, and positional accuracy for captured vertices where available.
   - Do not invent boundaries, use a centroid as a substitute, or enable infrastructure/tree placement until the boundary is confirmed.

5. **Infrastructure and spatial structures**
   - Place infrastructure in the actual farm location, in this order before tree placement:
     - Area features: ponds, reservoirs with footprints, greenhouses, buildings and other bounded structures. Support polygon drawing and dimensions/area; for water structures support depth and calculated/declared capacity where dimensions make the calculation valid.
     - Linear features: drains, canals, irrigation mains/laterals, fences and routes. Support line drawing and optional width/depth/length.
     - Point features: wells, pumps, valves, tanks without a mapped footprint, sensors and other point assets. Capture relevant specifications and capacity.
   - The geometry tool must match the feature: Point, LineString, or Polygon. A marker alone must not represent an area or route.
   - Keep entered dimensions distinct from map-measured dimensions and calculated estimates.

6. **Irrigation-system mapping**
   - Capture the irrigation method (e.g. flood, drip, sprinkler, other), water source, network paths, pumps, valves, control zones, and which fields/plots/trees each zone serves.
   - Represent connectivity explicitly; do not assume two nearby lines or devices are connected.
   - Associate irrigation events and recommendations with the correct field, zone, or asset when a verified relation exists.

7. **Tree placement and individual tree register**
   - Ask for species/type, variety/cultivar, age or planting year, and optional production/health details.
   - Offer a bulk/row workflow for orchards, while retaining individual tree identity and position where the farmer is able to provide it.
   - Provide explicit lifecycle states: alive, dead, removed, and unknown/unverified. A dead tree remains in historical records and must not be silently deleted.
   - For dead trees capture estimated age, date/period of death, and cause only as farmer-reported, specialist-assessed, or unknown. Never present an unverified cause as a diagnosis.
   - If a replacement is planted at the same place, create a new tree identity and link it to the previous tree record; retain the history.
   - The tree sticker reflects the selected species and lifecycle state. Moving the sticker updates its confirmed spatial point only after farmer confirmation.

8. **Other crops and intercropping**
   - Register crops grown alongside or between trees, including cover crops, vegetables, grains, legumes, forage and other seasonal/perennial crops.
   - Represent a crop block/bed/strip with a polygon or line/area geometry as appropriate, and link it to the relevant field and (when known) orchard/tree rows or irrigation zone.
   - Capture crop type, variety, planting date/season, status and optional management details.
   - Do not treat an entire field's crop label as an exact location for individual plants or rows.

9. **Review and publish the farm map**
   - Show independently toggleable layers: farm boundary/fields, infrastructure, irrigation network/zones, trees (including dead/removed history), and other crops.
   - Provide a review checklist and allow the farmer to correct each layer.
   - The farm map becomes operational only for confirmed geometry and clearly labels draft/unverified items.
   - Keep each farm isolated; switching farms must never mix geometry or records.

## Spatial data principles

- Store canonical geometry in WGS84 (SRID 4326), with explicit provenance and confirmation status.
- Geometry types are semantic: Point for individual trees and point assets; LineString/MultiLineString for irrigation routes, canals and drains; Polygon/MultiPolygon for farm/field boundaries, ponds, greenhouses, buildings and crop blocks.
- Validate every child feature against its parent farm boundary. If field-scoped, validate against the selected field as well. Support multipart geometries and holes where the underlying use case requires them.
- Distinguish farmer pin, device GPS, surveyed/imported verified geometry, and derived measurements.
- Never fabricate a point from a field/farm centroid. Never display unconfirmed geometry as verified.
- Keep visual scale/rotation/sticker appearance separate from geographic coordinates; changing sticker size must not change real-world position or area.
- Preserve audit/history for edits, movement, death, removal, replacement and status changes.

## Data-model direction — review before migration

The current branch's `farm_assets` foundation is **point-only**. It is suitable for point assets but cannot faithfully represent ponds, greenhouse footprints, drains, canals, irrigation routes or crop polygons.

Before extending the database, review whether to:
- retain `farm_assets` for point-like infrastructure and introduce normalized tree/crop records; and
- add a typed `farm_map_features` spatial layer supporting Point, LineString and Polygon geometries, with explicit farm/field ownership, feature category, provenance, confirmation, dimensions/capacity and lifecycle metadata.

Do not put all business meaning into unvalidated JSON metadata. Keep query-critical attributes (tree species/variety/lifecycle, crop identity/season, geometry type, dimensions, irrigation-zone relations) in typed columns or normalized related tables. The exact schema must be reconciled against existing farm, field, crop-cycle, irrigation and RLS conventions before a migration is authored.

## Sticker and interaction requirements

- The sticker palette is context-aware and prepared from the farmer-confirmed dossier.
- Drag/drop is a friendly placement gesture, but the resulting geographic point/polygon/line must be derived from the map's coordinate transform and shown for confirmation.
- GPS/survey capture remains available when higher positional accuracy is needed.
- Selecting a sticker opens its underlying record; editing record data updates the visual variant.
- Tree health/lifecycle, equipment type, and crop category must be distinguishable without relying on color alone.
- Provide accessible labels, keyboard alternatives, mobile touch targets, undo/cancel before save, and explicit confirmation for destructive or history-changing actions.
- Bulk placement must still create stable individual identities for trees when individual-tree analytics are expected.

## Acceptance gates

- [ ] Conversation intake produces a reviewable draft dossier; missing facts remain explicit.
- [ ] Sticker/tool palette is based on the dossier and contains no fabricated map locations.
- [ ] Farm perimeter must be confirmed before infrastructure placement.
- [ ] Infrastructure area, line and point features use the correct geometry editor and retain dimensions/capacity.
- [ ] Irrigation method, network, zones and served fields are represented without inferred connectivity.
- [ ] Trees have stable individual IDs, variety/age/lifecycle fields, and retained dead-tree history.
- [ ] Other crop plots and intercropping areas can be mapped independently of tree points.
- [ ] All saved geometries are validated against farm/field boundaries and have provenance/confirmation state.
- [ ] Map layers are independently viewable/editable and never mix between farms.
- [ ] RLS owner/non-owner/contracted-expert tests, PostGIS geometry read/write tests, multipart geometry tests, mobile end-to-end tests, and recovery checks pass in an approved non-production environment.
- [ ] No production migration, data mutation, merge, or production deployment occurs as part of this design slice.

## Implementation order after this specification

1. Reconcile the proposed geometry and tree/crop entities with the existing schema and RLS policies.
2. Design a non-production migration plan and tests; do not apply it without explicit authorization.
3. Implement the sequential map-builder UX with boundary gating and feature-specific geometry editors.
4. Add tree lifecycle/history and crop-plot workflows.
5. Add the context-aware sticker palette and connect every sticker to a persisted record.
6. Run authenticated data/RLS and mobile end-to-end acceptance before considering merge/release.
