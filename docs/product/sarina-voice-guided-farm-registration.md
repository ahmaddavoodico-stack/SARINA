# SARINA — Voice-Guided Farm Registration

**Status:** Approved product direction; implementation workstream opened  
**Date:** 2026-11-27  
**Base:** `feat/farmer-crop-details-on-registration`

## 1. Product decision

Farm registration must be available as a guided, natural conversation with SARINA—not only as a long form. SARINA should collect the same structured farm records through short conversational turns, with voice as a first-class input and output method.

The experience should feel like a patient agricultural companion helping the farmer complete a farm profile one small step at a time. It must not feel like an interrogation, a government form, or a long audio lecture.

This is an additional way to complete the existing farm-registration workflow. It must use the canonical farm records and existing authorization rules; it must not create a parallel farm/profile database.

## 2. Interaction principles

1. **One useful question at a time.** Ask one question, or a very small group of tightly related questions, then wait for the farmer.
2. **Short independent spoken messages.** Each spoken turn conveys one idea or asks one question. Do not generate a multi-minute monologue. For longer explanations, split into separately playable messages and pause for the farmer's response.
3. **Voice-first, not voice-only.** The farmer may answer by speaking, typing, tapping a visual choice, or selecting “I don't know / later”.
4. **Text is optional.** Do not force a full transcript beside every audio message. Offer a compact transcript/summary on demand and show structured values in the review step.
5. **Adaptive question selection.** Ask only for information that is still missing and relevant to the farm/crop already described. Do not repeat confirmed answers. Follow-up questions depend on previous answers and crop type.
6. **No pressure to know everything.** Unknown, approximate, and “I'll answer later” are valid states. Do not invent values or block a basic farm record because optional data is missing.
7. **Save progressively.** Preserve confirmed answers as a draft after each meaningful step. If the farmer leaves, resume from the last confirmed step without asking the same questions again.
8. **Confirm before committing.** Read back a concise summary of important fields and let the farmer correct them before final submission. Clearly distinguish a saved draft from a completed/confirmed record.
9. **Mobile-first and accessible.** Large controls, clear progress, RTL Persian/Arabic, low-bandwidth resilience, and easy switching between voice and text.
10. **Warm but scientifically responsible.** Use the approved SARINA voice personality: feminine, warm, friendly, energetic, natural spoken language, never childish or over-familiar. Accuracy and uncertainty remain explicit.

## 3. Suggested conversation flow

The flow is adaptive rather than a fixed questionnaire. The following is a baseline sequence; SARINA may skip already-known stages or insert relevant follow-ups.

### A. Start and locate the farm
- Welcome the farmer and explain that the process can be completed gradually.
- Ask for the farm location: choose a map pin, use device location with permission, or enter a place.
- Ask for farm name (optional) and total area.
- Show the mapped location/area for farmer confirmation before saving.

### B. Crops and planted area
- Ask what is grown on the farm.
- Support multiple crops and multiple plots.
- For each crop, ask whether it is the main crop, intercrop, forage, cover crop, or another role.
- For tree crops, ask variety/cultivar, approximate age, number of trees or planted area when relevant, and yield.
- For annual/forage crops, ask season/crop cycle and planted area; do not ask tree age.
- Yield may be unknown or approximate. Ask for unit and period only when the farmer provides a yield value.

### C. Water and irrigation
- Ask about irrigation method (e.g. flood, furrow, drip, sprinkler), water source, and relevant equipment.
- Ask about water storage structures only when applicable.
- Ask follow-up questions based on the selected irrigation system, not every possible equipment field.

### D. Optional agronomic context
- Soil texture/type, salinity, drainage, water quality, climate observations, planting date, management practices, and current problems can be collected when they materially improve the farm profile or a requested analysis.
- Do not overwhelm the farmer with all optional questions during initial registration. Make these available as later profile completion or context-specific follow-ups.

### E. Review and confirmation
- Summarize farm name, location, area, crops, varieties, approximate ages, yield (with units/period), and irrigation.
- Let the farmer edit any item by voice, text, or visual controls.
- Confirm and save. Show a clear success state only after the database confirms persistence.

## 4. Existing data model and integration contract

Build on the existing crop-registration schema and canonical farm records. The current crop-details workstream already defines or uses:

- `farms`: farm identity, total area, water structures, irrigation systems.
- `farm_fields`: named plots, area, confirmed boundary.
- `farm_locations`: farmer-confirmed location and capture method.
- `crop_catalog`: crop choices and localized names.
- `crop_cycles`: crop, variety label, tree age, yield quantity/unit/period, crop role, planted area.

The conversational flow must map its answers into these existing records. Do not add duplicate “chat farm” tables or store structured answers only in message text.

Before changing schema, inspect the migration history and RLS policies. Any new draft/session persistence must be owner-scoped, protected by RLS or secure server-side operations, and must not expose service-role credentials to the browser. Prefer reusing existing draft or farm-record mechanisms if available. If a dedicated interview-state record is proven necessary, use a forward-only migration with explicit owner checks and retention behavior.

Official documents are not a prerequisite for creating a farm record. Do not request legal deeds, ownership papers, or other formal documents at the beginning. They may be offered later as optional supporting evidence when a specific workflow genuinely requires them.

## 5. Voice behavior

### Outgoing speech
- Use SARINA's selected local Persian voice (Parisa / tiny-ava) for Persian TTS when its runtime is available and verified.
- Keep each audio turn short and semantically complete. A practical target is roughly 1–2 short sentences per turn; longer explanations must be broken into independently playable segments.
- Never autoplay a chain of long audio messages. The farmer controls playback and can pause, replay, skip, or continue.
- After a question, stop speaking and wait for the farmer's answer.
- If TTS is unavailable, retain the same short conversational text flow and offer retry; do not block registration.

### Incoming speech
- Accept a short voice answer and transcribe it using the self-hosted STT service when available.
- For farm registration, raw audio should not be retained by default. Use transient audio processing and persist the confirmed structured answer/transcript only when necessary for the farm record or an explicitly enabled conversation history.
- Validate audio size, duration, MIME type, and supported codecs. Give a clear retry path if the audio is unclear or unsupported.
- If confidence/clarity is insufficient, ask the farmer to repeat or choose from options. Never silently guess a crop, variety, age, area, or yield.
- The farmer can edit the transcription before it is accepted as a structured value.

### Message presentation
- Audio is the primary response when the farmer chooses voice mode.
- Do not display the full response text by default alongside every spoken turn. Provide a compact “نمایش متن” affordance and a concise structured recap during review.
- Keep the spoken messages as separate turns in the conversation history, with playback state scoped to each message.

## 6. Adaptive logic and data quality

Use a transparent, testable question planner. The planner should:
- Track required, optional, answered, unknown, skipped, and needs-confirmation fields separately.
- Select the next question from the current missing fields and the farmer's prior answers.
- Avoid asking tree-specific questions for non-tree crops.
- Ask variety only when it is relevant and the farmer has not already provided it.
- Normalize units carefully; preserve the farmer's original value and unit where needed, and never convert without a defined conversion.
- Distinguish farmer-reported facts from map-derived estimates, imported context, and AI-inferred suggestions.
- Mark uncertain values as approximate and request confirmation before they affect recommendations.
- Permit interruption, pause, resume, and correction at any stage.

An AI model may phrase questions naturally or interpret free-form answers, but the core state machine, validation, authorization, and database writes must remain deterministic and testable. Do not make registration dependent on a paid external model. A local model can be evaluated for language understanding only after its Persian accuracy and runtime are validated.

## 7. Implementation sequence

1. Audit the existing crop-registration branch, schema/migrations, RLS, and current farm creation flow; preserve its map-boundary and area-confirmation requirements.
2. Design a guided conversational registration component that reuses the current farm/crop form state and data contract.
3. Implement the deterministic question planner and structured answer extraction/validation for farm identity, area, crop, variety, age, yield, crop role, irrigation, and water source.
4. Integrate the existing voice runtime with a transcript-only intake mode so registration does not accidentally persist raw audio as a voice note.
5. Add short, independently playable TTS messages with explicit farmer-controlled progression; provide text and visual-choice fallbacks.
6. Add progressive draft persistence and resume only after the owner-scoped persistence model and RLS have been verified.
7. Add review, correction, and final confirmation, then write to the existing farm tables.
8. Run build, unit tests for question selection/validation, database/RLS tests, and end-to-end tests on mobile for Persian and Arabic before release.

## 8. Acceptance criteria

- A farmer can create a farm profile without completing a long traditional form.
- The experience asks one short question at a time and adapts to prior answers.
- Crop type, variety, tree age, and yield are captured where relevant; unknown values remain unknown rather than being fabricated.
- Multiple crops and crop roles are supported.
- Map boundary and area confirmation remain intact.
- Voice and text answers both work; visual options are available for common answers.
- TTS messages are short, separate, controllable, and never form an uninterrupted multi-minute monologue.
- Full text is optional; a concise review summary remains available.
- The farmer can pause, resume, skip optional questions, and correct answers.
- Confirmed data is saved to canonical farm records with ownership enforced server-side.
- No official documents are required at the start of registration.
- Build, automated tests, RLS/authorization tests, and mobile end-to-end tests pass before production activation.

## 9. Release honesty

The approval of this design and the creation of an implementation branch do not mean the guided interview is already available to farmers. Do not claim production activation until the component, secure persistence, voice integration, tests, and deployment have all been verified.
