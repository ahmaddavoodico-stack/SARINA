# SARINA — Shared Farmer, Specialist & SARINA Conversation

**Decision date:** 2026-11-23  
**Status:** Approved product contract; implementation in progress  
**Supersedes:** Earlier farmer-facing design that separated the SARINA assistant from human specialist chat  
**Primary experience:** One case room, one shared timeline, three participants

## 1. Product decision

For a specialist-supported case, the farmer uses one conversation window. The farmer, the assigned verified specialist, and SARINA participate in that same conversation. SARINA acts simultaneously as:
- the farmer's assistant, explaining specialist responses and evidence in accessible language;
- the specialist's assistant, preparing concise case summaries, extracting relevant facts, identifying missing evidence, and drafting follow-up questions;
- the case coordinator, helping promote important, verified information into the structured case file and connecting approved decisions to the farmer's operational plan.

The farmer must not be asked to switch between a separate AI chat and a separate specialist chat to complete one case.

## 2. One room, clear participant identity

Every visible message is labelled as one of:
- **کشاورز** — farmer-reported information, observations, questions, and execution updates;
- **متخصص** — a named human specialist's own messages and decisions;
- **سارینا** — AI explanations, summaries, questions, and drafts.

SARINA must never impersonate the specialist. It may explain a specialist's message but must preserve the meaning and attribution. Specialist messages remain attributable to the verified specialist who sent them.

The specialist workspace remains professional and case-oriented, but its case room is the same shared conversation, not a second message history.

## 3. Conversation lifecycle

1. Farmer starts with SARINA through the single communication entry point.
2. SARINA gathers only the minimum useful details and confirms which farm/case the information belongs to.
3. When human review is needed, the farmer is shown the specialist referral and its scope; the existing request/assignment workflow is linked to the same conversation.
4. The assigned verified specialist joins the room and sees the authorized case context and chronological shared timeline.
5. Farmer, specialist, and SARINA continue in the same room. SARINA can answer the farmer, prepare specialist briefs, and ask for missing evidence.
6. Important case facts are extracted as structured drafts with source, timestamp, author, confidence/verification state, and related evidence.
7. The specialist confirms, edits, or rejects the drafts. Only approved facts and recommendations become authoritative case records.
8. SARINA converts approved recommendations into a clear operational plan for the farmer, with actions, quantities/units where applicable, timing, responsible party, status, and follow-up.
9. Farmer reports completion or results in the same conversation. SARINA updates the case summary and prepares the next specialist review when needed.

## 4. SARINA's two-sided assistant role

### For the farmer
- Explain test results and specialist language in simple, respectful terms.
- Summarize what has been decided, what remains uncertain, and what the farmer should do next.
- Ask one useful follow-up question at a time.
- Explain the operational plan and help the farmer report progress.

### For the specialist
- Produce a short, current case brief instead of requiring repeated long explanations.
- Distinguish farmer-reported facts, lab/instrument evidence, retrieved official sources, specialist-confirmed findings, and AI hypotheses.
- Identify missing information and inconsistencies.
- Draft structured case updates and operational actions for specialist review.
- Summarize farmer execution and outcomes before the next review.

SARINA must not bury the specialist in unsolicited long messages. It should surface only relevant, actionable summaries and clearly label uncertainty.

## 5. Case record and operational plan

The shared transcript is not the authoritative case file. Important items are promoted into structured records with at least:
- item type (observation, measurement, evidence, hypothesis, confirmed finding, recommendation, decision, action, outcome);
- concise value/description;
- source and author;
- created/observed time;
- farm, field, crop/cycle and case linkage when known;
- evidence references;
- confidence/verification state;
- specialist approval state and approver where required.

The operational plan is derived from approved decisions and verified context. It must not silently convert an AI hypothesis into an instruction. Each action should capture the task, quantity and unit if applicable, due date/time window, responsible person, status, dependencies, safety notes, and follow-up evidence. Consequential agronomic recommendations require explicit specialist approval.

Specialist-only internal notes remain private. They become farmer-visible only when the specialist deliberately promotes them into an approved shareable update.

## 6. Data architecture principles

- Preserve one farmer-visible chronological conversation timeline.
- Reuse existing AI conversation/message and expert case/request records where possible; do not create a parallel messenger without a demonstrated schema need.
- Keep internal AI usage/cost, specialist private notes, structured case facts, recommendations, and operational actions in their appropriate stores.
- Link the AI conversation to the expert consultation/case through a forward-only, indexed, integrity-constrained relationship after reviewing live schema and migration history.
- Preserve message provenance when adapting existing `expert_consultation_messages` and `ai_messages`; migration/backfill must be idempotent and must not duplicate or drop messages.
- Use server-authorized reads/writes for shared messages. Never expose service-role credentials or weaken RLS to make the UI work.
- Enforce access for the farmer owner and currently assigned verified specialist. Reassignment must revoke former specialist access.
- Realtime is a delivery enhancement; initial load and reconnect must reconcile against persisted history.
- AI provider outages must not block farmer–specialist human messaging.

## 7. AI invocation and cost gates

The shared room UI and persisted human messaging can be developed independently of provider activation. SARINA must not fabricate an AI reply or show a successful answer unless a provider was actually invoked and the assistant message was persisted.

Model routing remains internal. Strata is only a candidate after separate quality/performance/privacy evaluation. OpenAI escalation remains subject to the previously approved one-time USD 5 technical-test ceiling, server-side hard limits, disabled automatic recharge, and usage review after each test. Do not switch the farmer-facing assistant to Groq or another provider without an explicit product/provider decision and cost controls.

## 8. Implementation sequence

1. Audit live schema, migrations, AI and expert message tables, RLS, auth-to-SARINA identity mapping, specialist verification/assignment checks, and current notifications.
2. Design and add the forward-only conversation-to-consultation link; plan safe legacy message backfill and source attribution.
3. Build one shared conversation component and use it for farmer and assigned specialist case views.
4. Route message read/write through a server-authorized path and update realtime/pagination/notifications.
5. Connect SARINA's assistant participant through a secure orchestrator; provider-disabled state must be explicit and human chat must continue.
6. Add structured case-fact drafts and specialist approval.
7. Connect approved recommendations/actions to the farmer's operational plan and progress tracking.
8. Run role-based, cross-case, reassignment, retry/reconnect, mobile/RTL, and end-to-end tests before merge or deployment.

## 9. Current verified implementation baseline

At the start of this workstream:
- Farmer–specialist chat exists in `FarmerSpecialistChatInbox.tsx` and uses `expert_consultation_messages`.
- The specialist dashboard also reads/writes the same human-message table in its case workflow.
- The farmer SARINA companion is a separate mounted UI.
- The current `sarina-central-intelligence` Edge Function verifies the caller and assembles farm context but returns `model_invoked: false`; it is not yet a live farmer conversational model endpoint.
- The existing AI schema has `ai_conversations` and `ai_messages`, including an `expert` sender type, but their live policies/linkage and suitability for this shared room must be verified before use.
- No new database migration, live schema change, provider call, or production deployment is implied by this document.

**Acceptance outcome:** a farmer and an assigned verified specialist can use one shared room, see SARINA as a distinct participant, receive SARINA's useful assistance when the provider is enabled, and have approved case facts and actions reflected in the structured case file and farmer operational plan.
