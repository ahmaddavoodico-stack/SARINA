# Farmer task markers: directional guidance and spoken instructions

## Product behavior

The farmer's 3D isometric farm map remains the primary surface. A task should be discovered at the place it applies, not only in a separate task list.

- A recommendation with a confirmed `field_id` receives a colored task marker on that field.
- A directional connector points from the marker toward the target field's map anchor. It is a field-level pointer only; it must not imply a specific tree, valve, or equipment target unless that asset has its own confirmed geometry and target relationship.
- Farm-wide recommendations remain farm-wide and do not receive a fabricated field arrow.
- Marker colors retain the agreed priority semantics: green = normal, yellow = important, orange = urgent or overdue. Completion state is shown separately in the marker glyph.
- Selecting a marker opens the matching task detail with its instruction, priority, dates, execution note, and start/complete/request-review actions.
- The instruction can be read aloud through the device/browser Persian speech engine. The control toggles play/stop and cleans up speech when the task panel unmounts.

## Audio behavior and limitation

The current first implementation uses the browser's `SpeechSynthesis` API, requests `fa-IR`, and prefers an installed Persian voice when available. Actual voice availability, gender, pronunciation, and audio quality depend on the device/browser. This is a functional fallback, not yet the final branded SARINA voice. A later branded-voice rollout should use an approved SARINA audio/TTS provider and persisted audio assets or a secured server-side speech endpoint; no API key belongs in the client.

## Visual design

- Keep the map visually dominant and uncluttered.
- Use a compact colored marker and a thin directional line with arrowhead; avoid permanent text labels for every task.
- Open task detail only after marker selection.
- Keep audio playback as one compact action inside the selected task detail.
- Preserve keyboard focus indication and accessible labels.

## Current implementation scope

The directional connector currently points to the center anchor of the associated field because the task model supports field-level or farm-level scope. It does not claim tree-level precision. Tree/equipment targeting requires a future explicit target-asset relation and confirmed asset geometry.

## Release gates

Do not merge this stacked feature branch until:
1. The complete branch has a successful application build and relevant automated checks.
2. The SQL migration is reviewed against the live schema and existing trigger/function definitions, then applied through the approved migration process.
3. Farmer + assigned verified specialist end-to-end tests pass, including task status synchronization and notification delivery.
4. Preview behavior is visually checked on mobile and desktop.

Merging to `main` and deploying to Production are separate approvals.
