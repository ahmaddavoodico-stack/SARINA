# SARINA Farm Map — Phase One Scope and Acceptance Criteria

## Purpose

Phase One is complete only when a farmer can register a farm through a guided, low-friction workflow, review and confirm the resulting farm map, and then see that map as the primary workspace immediately below the farmer welcome area in the dashboard.

This document records the approved Phase One boundary. It is a product and engineering acceptance contract; it does not claim that every item below is implemented or tested.

## Non-negotiable UX principles

- Farmer-first, mobile-first, visual interaction; minimize typing and avoid requiring surveying knowledge.
- Keep the workflow in a single farm-map experience. Do not make infrastructure or pond registration a separate map destination.
- Preserve each farm's data isolation. Switching farms must never mix geometries, assets, irrigation, crops, or history.
- Distinguish farmer-reported, approximate, GPS-derived, imagery-derived, measured, specialist-confirmed, and system-calculated data.
- Never invent coordinates, dimensions, area, capacity, or connections.
- A farmer's confirmation records their acceptance of the representation; it does not convert an estimate into a survey-grade measurement or specialist verification.
- Every asset must have a stable record identity. Visual sticker size is independent from its stored geometry or location.

## Guided registration sequence

The sequence below is fixed and must not be reordered.

1. **Natural initial conversation**
   - Collect farm identity and location, activity, crops/trees and varieties/ages, companion crops, irrigation method and source, infrastructure, problems, and available history.
   - Support text and voice only where the relevant capability is genuinely available.
   - Allow unknown or skipped answers; do not block registration because a farmer lacks a detail.

2. **Structured preliminary farm record**
   - Convert the conversation into structured fields.
   - Preserve provenance and confidence states: unknown, estimated, farmer-reported, specialist-confirmed, measured, and derived.
   - Do not silently promote unverified values to confirmed facts.

3. **Prepare the map toolkit**
   - Select relevant stickers/tools from a reusable library based on the preliminary record.
   - Every sticker is a visual control linked to a persistent asset/feature ID, not the data record itself.
   - Allow the farmer to adjust the visual icon size without changing the underlying coordinates or dimensions.

4. **Farm and field boundaries**
   - Draw or capture the farm/field boundaries using a supported map/GPS workflow.
   - Calculate area only from valid geometry and a known spatial reference.
   - Show the calculated area and obtain farmer confirmation before placing farm assets.
   - Preserve unconfirmed geometry as unconfirmed; do not present it as an approved boundary.

5. **Infrastructure before trees**
   - Surface assets (ponds, reservoirs with a footprint, greenhouses, buildings, etc.) use polygons.
   - Linear assets (roads, drains, canals, pipes) use lines.
   - Point assets (wells, pumps, valves, sensors, and point-like tanks) use points.
   - House, warehouse, livestock area, and access road tools are available from the primary map without a separate questionnaire.
   - In Phase One, approximate placement is acceptable when explicitly labelled approximate.

6. **Irrigation network**
   - Capture irrigation type, source, conveyance route, pumps, valves, control zones, and their explicit relationships to fields/trees.
   - Do not infer a connection merely because two assets are geographically close.
   - Keep physical network records distinct from irrigation-event history.

7. **Trees**
   - Support individual placement and practical bulk/row registration.
   - Capture species, variety, age/year planted, and optional yield/health details.
   - Assign a stable identity to each tree for its individual history.
   - Preserve lifecycle states such as living, dead, removed, and unknown. Do not erase a dead/removed tree's history; a replacement tree receives a new identity linked to the previous one where appropriate.

8. **Other crops and companion planting**
   - Register cover crops, vegetables, cereals, legumes, forage, and other crops.
   - Reuse crop-cycle records with roles such as main crop, intercrop, forage, cover crop, and other.
   - Link a crop to a field/row/zone only when that relationship is known.

9. **Review and confirmation**
   - Show a consolidated preview of boundaries/fields, infrastructure, irrigation network/zones, trees and their histories, and other crops.
   - Make each layer editable and clearly mark approximate, unknown, or unconfirmed geometry.
   - Provide a final farmer action: “نقشه مزرعه من تأیید می‌شود”.
   - Store who confirmed, when, and which map version was confirmed.
   - Farmer confirmation must not overwrite the underlying provenance or imply specialist measurement.

10. **Dashboard handoff**
    - After final confirmation, show the completed farm map in the primary farmer dashboard immediately below the welcome area.
    - The map is the primary farm-management workspace, not a small secondary card.
    - Keep isometric as the default view, with satellite and hybrid modes available.
    - Selecting a tree or infrastructure asset opens its corresponding record.
    - Farm switching must preserve strict per-farm separation.

## Visual estimation and scale rules

- Prefer a reliable georeferenced satellite image, GPS, or confirmed boundary as the metric reference.
- A farmer may optionally use a locally known road width/road reserve as a visual reference, but road widths vary and this is not a reliable universal scale.
- Visual shape and aspect-ratio adjustment is a third-level reference.
- If no reliable scale exists, store a visual footprint without fabricating metric area or volume.
- Separate icon display size from asset footprint geometry.
- For ponds, ask the farmer for depth when known; retain its source and approximate/confirmed status.
- Estimate surface area only when a valid spatial scale exists. Estimate capacity only when both area and depth support it, and label the result approximate with the calculation method/provenance. Unknown depth means unknown capacity.
- If a specialist or survey later supplies measured dimensions, make that the active value while retaining the earlier estimate in history.

## Pond and open-reservoir requirements

- Support multiple independent ponds/reservoirs in one farm.
- Each has its own stable ID, geometry, purpose, construction type, water source, status, notes, optional depth/capacity, provenance, and history.
- Status options include active, inactive, retired, and removed. Inactive/retired/removed assets remain in the farm record and history.
- Explicitly record connections to sources, pumps, valves, pipelines, and irrigation zones; never infer these from proximity.
- Pond registration and visualization must ultimately be integrated into the primary farm map experience. A separate pond map is not the final Phase One UX.

## Final dashboard acceptance checks

- The map appears immediately below the farmer welcome area after farmer confirmation.
- Isometric, satellite, and hybrid modes work on supported devices; imagery failure has a clear fallback.
- Confirmed boundaries, assets, routes, ponds, trees, and crop layers render from the correct farm records.
- Approximate and unconfirmed items are visually distinguishable and retain provenance.
- Selecting a map item opens the matching record.
- A farmer can return to edit the map without losing its previous confirmed version/history.
- Mobile touch interactions, undo/cancel, and accessible labels are usable.
- Loading, empty, permission, and save-error states are handled without silently dropping farmer input.

## Definition of done

Phase One is not considered complete based on a visual mockup, a successful commit, or a successful build alone. Completion requires:

1. All workflow steps above implemented in the primary map experience.
2. Database/RLS and same-farm ownership boundaries verified.
3. End-to-end tests for the full registration → review → farmer confirmation → dashboard flow.
4. Tests for multiple farms, multiple ponds, lifecycle/history, approximate geometry, and missing scale/depth.
5. Mobile and desktop visual/interaction checks.
6. A successful build and preview verification.
7. A documented review of unresolved limitations.

Merge and Production deployment remain separate approval steps.
