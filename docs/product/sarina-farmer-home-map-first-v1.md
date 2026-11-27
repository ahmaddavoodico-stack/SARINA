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
