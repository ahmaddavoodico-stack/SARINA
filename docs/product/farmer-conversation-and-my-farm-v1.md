# SARINA — Farmer Conversation & My Farm V1

**Status:** Approved for V1 implementation  
**Branch:** `feat/farmer-map-and-conversation-v1`  
**Safety boundary:** UI and application changes only on this feature branch. No production deployment, database migration, destructive data operation, or provider/API activation is authorized by this document.

## Product outcome

The farmer's workspace has two connected experiences:
1. **SARINA Conversation** — one friendly, multimodal conversation entry point.
2. **My Farm** — the farmer's own mapped farm as the primary operational workspace.

The farmer should not need to understand SARINA's internal departments or navigate tables to manage routine work.

## My Farm

- Place the farm map directly below the welcome area on the farmer home screen.
- Load only farms owned by the authenticated SARINA user, using existing RLS-protected records.
- Support multiple farms as horizontal swipe/next-previous map cards. Each farm keeps its own fields, markers, weekly tasks, and productivity summary.
- Use the existing farm boundary geometry where available. Do not invent coordinates or present a decorative illustration as a verified geospatial map.
- Preserve the existing boundary-drawing workflow for new farms. The farmer draws the boundary on a map, reviews calculated area, and explicitly confirms it.
- Add crop/tree/row/irrigation details progressively; do not block initial farm registration on missing formal documents or unavailable precision data.
- Replace farmer-facing overview tables with map markers and contextual detail panels. Preserve all underlying records and detailed views where they remain useful.
- Show productivity as one evidence-based score and one plain-language sentence below the map. If the required data is absent, show that the score is not yet available; never fabricate a score.
- The map must expose accessible controls and a clear empty state for farms without verified boundaries.

## Weekly plan and map markers

- Tasks are scoped to a farm and, when known, a field/tree/irrigation asset.
- A task is created only from a traceable recommendation by the relevant specialist or approved domain AI.
- Store recommendation source, rationale, confidence/review status, scheduled time, priority, and completion outcome.
- Do not turn uncertain or high-risk recommendations into definitive instructions. Route high-impact actions for expert review as required.
- Markers use clear states: scheduled, due, needs review, completed.
- Selecting a marker opens a compact text/audio guidance panel; the farmer may complete, defer, or report a problem.
- Existing messaging infrastructure should be reused. No parallel command center or messaging system is introduced.

## SARINA Conversation

- One consistent SARINA entry point, distinct from the human specialist inbox.
- Text is the reliable baseline. Voice messages and live voice are separate capabilities and must be clearly identified.
- Do not display voice/live controls as operational until a real, tested STT/TTS or WebRTC path is connected.
- Keep attachments associated with the correct authenticated user and conversation; use private storage and authorization checks.
- Routine repeated guidance should resolve through approved shared knowledge; raw personal conversation content must not be promoted into shared memory.
- The assistant must identify itself as SARINA, an AI assistant, and never imply a human is speaking.
- Human specialist conversations remain a separate, clearly labeled workflow.

## Shared memory and privacy

- Separate shared approved answers, temporary conversation context, reviewed knowledge candidates, and the farmer's operational farm records.
- Temporary context may be removed after the relevant workflow ends, subject to retention, security, audit, and legal requirements.
- Never delete farm records or operational history merely because a conversation ended.
- Do not publish raw or identifiable user messages as shared knowledge.

## V1 acceptance criteria

1. Authenticated farmer sees their own farm map directly under welcome.
2. A farmer with multiple farms can switch between them without mixing farm data.
3. A farmer with no farm sees a clear action to create one using the existing map boundary flow.
4. Existing farm boundary geometry is rendered only when present and valid.
5. Productivity is evidence-based and has an honest unavailable state.
6. Weekly tasks are shown only when backed by real task/recommendation records; demo tasks are explicitly labeled as demo.
7. Conversation entry point is visible and does not falsely claim live AI/voice functionality when backend services are not connected.
8. Existing specialist inbox and other farmer workflows remain available during transition.
9. No production schema or data is changed by this UI work.

## Implementation sequence

- Integrate the My Farm map surface into the farmer home, backed by existing farm/field data and RLS.
- Add the single SARINA conversation entry surface and connect only to verified existing conversation services.
- Wire weekly task markers after verifying the task/recommendation schema and specialist orchestration outputs.
- Run TypeScript/build and end-to-end checks before requesting review or deployment.
