# SARINA V1 — My Farm Map & Conversation Entry

**Status:** Approved product design; first UI integration on an isolated branch  
**Release boundary:** No production deployment, schema migration, provider activation, or data mutation.

## Farmer home hierarchy

1. Welcome greeting.
2. My Farm map immediately below the greeting.
3. Farm-specific productivity comparison and weekly actions inside the same farm card.
4. One SARINA Conversation entry, using the existing companion UI.
5. Human specialist conversations remain a separate workflow.

## My Farm map

- Farms are loaded through the authenticated Supabase client; existing RLS remains the ownership boundary.
- Each farm has an independent map card and can be selected with previous/next controls or horizontal swipe.
- Render only farmer-confirmed field boundary geometry from `farm_fields.boundary`; never synthesize a location or display an illustrative image as a verified map.
- Expert recommendations are read from `expert_recommendation_actions` using the same approved/in-progress/completed/review statuses already used by the weekly-plan workspace.
- Recommendation markers are placed only when the linked request identifies a field with a saved boundary. Unlocated recommendations remain in the farm's task list, not at invented coordinates.
- Farmer-created improvement actions remain distinct from expert recommendations.
- Productivity display compares marketable-yield measurements with a confirmed baseline only when values, units and dates are comparable. Otherwise it displays an unavailable state. A measured change is descriptive and is not presented as proof that an intervention caused the change.
- No tree-level markers are shown until verified tree/asset coordinates exist.

## Conversation boundary

- Use the existing SARINA Companion and its voice controls as the single AI-assistant entry point.
- Human specialist chat must not be embedded as if it were the AI assistant.
- The farmer-facing companion currently has no verified general-purpose server response/persistence path. The UI must not claim a live AI answer or successful persisted message until the authenticated conversation service, RLS/ownership checks and approved model runtime are available.
- Voice controls must remain clearly staged according to their actual connected capability; no false live-voice claim.

## Acceptance checks before merge

- TypeScript and Vite production build pass.
- Authenticated farmer sees welcome followed immediately by their own map.
- Farm switching never mixes boundaries, recommendations, actions or productivity evidence.
- No-boundary farms show a clear state and a route to the existing boundary-capture workflow.
- Recommendations are shown only from the existing expert recommendation records; map markers require a verified field association and boundary.
- Productivity comparison uses a confirmed baseline and same-unit marketable-yield measurement, otherwise shows unavailable.
- AI companion is distinct from human specialist chat and does not claim an AI response when no provider was invoked.
- Mobile touch interaction does not hijack map panning.
- Existing specialist, farm registration, weekly-plan and productivity workflows remain available.
- No migration, production data change, secret activation, or production deployment is part of this branch.


## Current implementation checkpoint

The current branch is an initial integration slice, not a release-complete implementation:
- The map-first home surface reads the farmer's saved boundaries and renders them on the existing Leaflet/OpenStreetMap 2D map foundation.
- Farm switching, evidence-aware yield comparison, and visible specialist recommendations/actions are wired to existing records.
- The approved 3D farm rendering, satellite/terrain provider decision, full map interaction for each asset, and complete weekly task lifecycle are still outstanding.
- The existing SARINA Companion is mounted as the farmer's conversation entry, but the general farmer AI response/persistence path is still a prototype and must not be represented as live.
- The first CI run caught unused imports only; those imports were removed in follow-up commits. A fresh successful build has not yet been observed.

Do not mark this workstream complete or merge for release until the remaining 3D, conversation backend, mobile interaction, and acceptance gates pass.


## Isometric farm map — implementation slice 2

- The flat 2D basemap has been replaced in the farmer home by a boundary-derived isometric SVG scene. Polygon geometry is sourced from the farmer-confirmed `farm_fields.boundary`; field proportions are preserved using latitude-aware projection.
- The scene renders shallow extruded field faces, field labels, crop-cycle markers, field-linked irrigation-event markers, and field-linked expert/AI recommendation markers.
- Selecting a marker opens a compact detail panel; weekly guidance is also available in the task list.
- AI recommendations are only read when `requires_expert_review=false` and status is suggested/accepted/in_progress; expired recommendations are filtered out. Expert-authored actions retain their existing workflow statuses.
- Crop and irrigation markers are **field-level indicators**, not surveyed tree/equipment coordinates. SARINA currently has crop-cycle-to-field and irrigation-event-to-field relations, but no canonical tree/valve/pump coordinate model was found. Do not present these markers as exact individual tree or irrigation-device locations.
- This is an isometric 3D-style rendering of real field boundaries, **not yet a photogrammetric 3D terrain model, satellite imagery, or elevation-derived surface**. Those require an approved imagery/DEM source and licensing decision.
- No schema migration or production data write was made.

## Remaining map work before release

1. Add farmer-confirmed positions for individual trees, irrigation assets, water structures and other farm objects; support placement/editing on the map.
2. Decide on licensed satellite imagery and elevation/terrain source; then add true terrain/3D scene without inventing elevation.
3. Bind every scheduled task to its source (specialist or eligible SARINA intelligence), field/crop/asset, due window, evidence, and status.
4. Add accessible touch/keyboard selection, map/task deep links, and end-to-end tests with multiple farms and complex/multipart polygons.
5. Validate query policies and real linked Supabase data in an authenticated test account; CI build alone does not prove RLS/data correctness.


## Farm asset location model — implementation slice 3 foundation

A branch-only migration, `20261127160000_farmer_confirmed_farm_asset_locations.sql`, now defines the canonical `farm_assets` model.

- Stores physical objects as WGS84 PostGIS points: trees, irrigation valves/pumps/lines, tanks, canals, drainage, buildings, sensors and other assets.
- Each asset belongs to one farm and may be associated with a field. A database trigger rejects a field that belongs to a different farm.
- Stores capture provenance (`farmer_pin`, `device_gps`, `surveyed`, `imported_verified`), optional accuracy, notes and structured metadata.
- A location is not eligible for a verified map marker until the farmer confirms it; no field centroid, farm pin or inferred point is backfilled.
- RLS allows the owning farmer to manage their assets and an active contracted expert to read them, following the existing farm access model.
- This migration has been committed to the feature branch only. It has **not** been applied to Supabase, and no production or development database schema/data was changed.

### UI work still required

- Add a farmer-friendly asset placement flow: choose asset category, tap/confirm a position on the farm map or use device GPS, review accuracy, assign an optional field, and save only after confirmation.
- Render only active, confirmed asset points using their actual coordinates; provide edit, move, retire and unlocated states.
- Add authenticated RLS tests and migration regression checks before any database rollout.
- Link weekly actions to an optional asset ID only when a real association exists; otherwise retain the field-level or farm-level association.
