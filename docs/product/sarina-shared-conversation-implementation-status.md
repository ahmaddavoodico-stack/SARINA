# SARINA shared farmer–specialist–assistant conversation

Status: implementation landed on `main`; deployment and end-to-end acceptance remain unverified.

## Implemented in this workstream

- Reuses `expert_consultation_messages` as the canonical human conversation history.
- Adds `expert_consultation_ai_messages` for assistant messages, linked to the same consultation timeline. Authenticated participants can read; only the server-side service role can insert.
- Deploys `sarina-case-chat`. It authenticates the caller, uses RLS-protected reads to verify access to the consultation and case, reads recent human messages, and stores the assistant response in the shared timeline. It requires both the server secret `OPENAI_API_KEY` and the explicit server flag `SARINA_CASE_CHAT_ENABLED=true`; the feature is default-deny so the previously approved small API test budget is not consumed by real-user traffic. Without both settings, an explicit unavailable message is recorded rather than pretending a model responded.
- Adds realtime delivery for assistant messages and loads human and assistant messages into one chronological view.
- Removes the farmer's separate floating SARINA chat and removes the duplicate specialist chat composer from the case-detail view. The specialist conversation inbox is the single messaging surface.
- Adds specialist-approved case fact capture from an individual human message. Approved facts are visible to the farmer and assigned specialist; this does not expose private expert notes.
- Links one improvement plan to each expert request and allows the assigned specialist to create or update it from the shared conversation. The plan is written to the existing `farm_improvement_plans` table with `origin='expert'`, `status='active'`, and source request/consultation links.

## Explicitly not complete yet

1. **Automatic fact extraction:** a person must select a message and explicitly record it as an approved case fact. SARINA does not yet extract candidate facts automatically or queue them for specialist review.
2. **Structured action items:** plan creation currently stores a title and description in the existing improvement-plan record. It does not yet create individual dated tasks, owners, reminders, evidence requirements, or completion checkpoints.
3. **Attachments in the shared timeline:** the human message schema can contain attachment/audio content, but this inbox still primarily renders text. Lab PDFs, photos, video, and voice need unified rendering and secure preview.
4. **AI provider readiness:** the deployed function is present, but a successful model response has not been proven. Confirm the `OPENAI_API_KEY` secret, approved model configuration, usage caps, and explicit activation of `SARINA_CASE_CHAT_ENABLED` before real-user use.
5. **Acceptance tests:** no independent farmer + assigned verified specialist + SARINA end-to-end session has been run yet. Required tests include RLS denial for unrelated users, realtime in both directions, fact visibility only after specialist approval, plan create/update, unread/read state, and mobile layout.
6. **Production deployment:** Vercel reports `build-rate-limit`. The latest frontend commits are on `main`, but a successful Vercel build/deployment is not confirmed. Do not describe this frontend work as live until Vercel reports success.

## Authority boundaries

- Farmer messages, specialist messages, and SARINA messages remain distinguishable in the timeline.
- SARINA is a communication assistant, not the assigned specialist. It must not issue unapproved diagnosis, dose, treatment, or operational decisions.
- Specialist private notes remain private and are not copied into the farmer-visible fact table.
- Only the assigned, verified specialist can promote a conversation message to an approved case fact or create/update the linked expert improvement plan.
