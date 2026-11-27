# SARINA Farm Map — Lifecycle & Audit History V1

**Status:** Additive hardening specification  
**Target branch:** \`feat/farmer-map-conversation-v1-mainline\`

## Why this layer is required

The spatial model already distinguishes trees, point assets, line/polygon features and explicit irrigation-network edges. A map is not trustworthy if it only stores the latest position and silently loses how an asset moved, changed state, was removed or was replaced.

## Additions

- Tree events retain both previous and new WGS84 point geometry.
- \`farm_asset_events\` preserves asset creation, location changes, confirmation changes, status changes and detail changes.
- \`farm_map_feature_events\` preserves previous/new line or polygon geometry and feature lifecycle changes.
- \`irrigation_network_edge_events\` preserves previous/new endpoint, line, zone, direction, role, status and confirmation state.
- Event tables use same-farm composite references, RLS, and append-only triggers.
- Farmer clients can read history and append explicitly farmer-reported observations, but cannot update/delete history rows.
- Spatial records are retired or marked removed/inactive; client hard-delete is revoked.

## Invariants

1. Every event is tied to the same farm as its source record.
2. Exact prior geometry is retained; an event does not rely only on a human-readable JSON summary.
3. A system-generated history row is created by a narrow trigger-only function.
4. Corrections create a new event; historical rows are not edited.
5. No coordinates are inferred from a farm centroid or sticker position.
6. History is private to the farm owner, active contracted experts and explicitly scoped organizational readers.

## Verification

The structural test checks RLS, grants, history columns, append-only protections, trigger presence and non-executable trigger functions. Identity-specific farmer/expert/organization tests remain required before release.
