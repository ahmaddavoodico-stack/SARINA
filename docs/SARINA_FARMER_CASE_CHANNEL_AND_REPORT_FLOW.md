# SARINA Farmer Companion, Expert Secretary, Case Intake and Report Delivery

## Scope and product boundaries

This integration brings the existing farmer-facing SARINA companion and expert-office secretary surfaces onto the current `main` application without replacing the established farmer–specialist consultation workflow.

Keep three experiences distinct:

1. **Farmer companion — “من اینجام، چه خبر؟”**: the always-available SARINA assistant entry point. It is not the human specialist chat and must not silently create a consultation.
2. **Human farmer–specialist consultation**: a private, one-farmer ↔ one-assigned-verified-specialist thread. Its canonical records remain `expert_requests`, `expert_request_assignments`, `expert_consultations`, and `expert_consultation_messages`.
3. **Expert office secretary**: a role-specific launcher for an expert's own queue, follow-ups and navigation. It must never expose another expert's cases or pretend a local preview note has been saved.

The UI components integrated by this branch are presentation surfaces only. Their composer fields remain explicitly labelled as previews until connected to an authenticated persistence endpoint. Do not describe them as live AI chat, durable notes, or a connected Bale/Telegram bot.

## Verified current application flow

### Farmer-created consultation

The current farmer expert workspace creates the following records:

1. `expert_requests` with the authenticated farmer as `requester_user_id`, selected farm and verified specialist, farmer problem description, language and consent snapshot.
2. `expert_request_assignments` with an `offered` assignment for the selected specialist.
3. `expert_consultations` linked to the request.

The expert dashboard reads assigned requests and consultations, and both sides use `expert_consultation_messages` for the human conversation. The specialist's final report is written to `expert_request_reports` only after the verified, accepted specialist explicitly confirms it. 

**Integrity gap to address before external intake:** the current browser flow performs the three request/assignment/consultation inserts sequentially. A failure after the first insert can leave a partially created request. External-channel intake must use one authenticated server-side transaction/RPC (or an equivalent atomic Edge Function transaction) to create the request, assignment, consultation and initial message together. Do not duplicate the current multi-step browser sequence in a webhook handler.

## Canonical inbound routing from Bale and Telegram

Bale and Telegram are independent provider adapters behind SARINA Connect. They are transport channels, not separate conversation stores.

### Account linking and consent

1. Farmer opens the official SARINA bot and sends `/start`. Neither bot may initiate the first private conversation.
2. Bot explains the channel and offers a short-lived, single-use link code generated from an authenticated SARINA session.
3. Server validates code expiry, single use, intended user, provider and bot identity; then binds opaque provider chat/user identifiers to the canonical SARINA user.
4. Farmer explicitly chooses the consultation and grants channel consent for that consultation. Consent is not inferred from accepting an expert assignment.
5. Revocation immediately disables the route and cancels pending outbound jobs.

Never infer a SARINA identity from a display name, phone number, or user-supplied request/consultation ID. Never expose provider identifiers or endpoint secret references to the browser or specialist.

### Inbound message decision

For every normalized private-chat update:

- Deduplicate on provider + bot + provider update ID before processing.
- Resolve exactly one active, consented channel route.
- If the route points to an existing consultation, validate that the consultation is active and the linked SARINA user is still an authorized participant, then append one row to `expert_consultation_messages`.
- If the farmer is explicitly starting a **new consultation request**, collect the required farm, issue, language and specialist/assignment preference; validate farm ownership and specialist verification/capacity; then call the atomic intake operation to create `expert_requests`, `expert_request_assignments`, `expert_consultations` and the initial canonical message.
- If more than one active consultation could match, ask the farmer to choose using safe case labels. Never guess or route to the most recent case.
- If identity, consent, assignment or case status is ambiguous, fail closed and direct the farmer to the authenticated SARINA workspace.

The existing `expert_case_assistant_cases` initialization and `expert_case_notifications` triggers should remain the case-intake and notification source of truth. Do not create a parallel bot-only request or message table.

### Provider ingress and delivery

- Webhooks validate HTTPS, method, content type, body size, provider-specific authentication/secret path and update shape; acknowledge quickly and process idempotently.
- Telegram and Bale each have a separate adapter, token and configuration. Do not assume full API parity.
- The reviewed Bale documentation does not establish a Telegram-equivalent signed webhook header. Use a high-entropy per-bot secret path, strict schema/size/rate checks, replay protection and monitoring; do not claim cryptographic signature verification.
- Keep raw webhook bodies and message text out of provider-event audit rows. Store only bounded safe metadata and opaque references.
- Use the existing SARINA Connect server-only channel-route, consent-event, provider-event and transactional-outbox tables. Outbox jobs reference canonical message IDs; they must not duplicate message bodies.
- Provider retries must be bounded and idempotent. A provider outage must not interrupt the in-app conversation.
- Ordinary messages, receipts and attachments never consume AI credits.

## Specialist response and farmer report delivery

### Existing expert report path

The current expert dashboard already provides a structured report form with:
- summary,
- recommendations and next steps,
- limitations and uncertainty.

A verified specialist with an accepted assignment reviews the preview and explicitly confirms it. The report is persisted in `expert_request_reports` with its request, consultation and author identifiers. The specialist case detail reads these report records.

### Verified database audit and missing farmer-facing delivery step

A read-only audit of the connected production schema confirmed:

- RLS is enabled on `expert_request_reports` and `expert_case_notifications`.
- `expert_reports_participant_select` already permits the request owner to read reports for their own request; the specialist side is limited to an accepted assignment and a verified profile.
- `expert_reports_assigned_expert_insert` allows report insertion only when the author is the current authenticated user, the profile is verified, and the assignment is accepted.
- No trigger exists on `expert_request_reports` to create a farmer notification. Existing message notifications are triggered by inserts into `expert_consultation_messages`.
- The reviewed farmer workspace does not query `expert_request_reports`; the report is therefore authorized for the farmer at the database layer but is not yet surfaced in the farmer UI.
- SARINA Connect's routes, consent events, provider events and delivery jobs are present with RLS enabled and explicit client-deny policies. The outbox references canonical consultation-message IDs.

Implement the missing delivery slice as follows; do not widen the existing report RLS policy:

1. After a successful report insert, create a recipient-scoped `expert_case_notifications` event such as `report_ready` for the actual `expert_requests.requester_user_id`. Derive the recipient from the request in trusted database code; never accept a client-supplied recipient.
2. Make report creation and notification creation atomic, preferably in a server-side RPC/transaction. Preserve the existing author/verified-profile/accepted-assignment checks.
3. Add a farmer-visible report section in the case detail/workspace using the existing owner-scoped SELECT policy. Add a role-switched negative test proving a different farmer cannot read it.
4. For an active consented Bale/Telegram route, create a canonical farmer-visible consultation message representing the report (report reference plus approved summary/recommendations/limitations), then enqueue an outbox row referencing that message. The structured `expert_request_reports` row remains the canonical report; the channel is a delivery copy, not a second report database.
5. Clearly identify the human specialist in every relayed report/message. Include a SARINA case reference and a safe in-app link when available.
6. Track report saved, farmer notification created, provider delivery queued, sent, delivered or failed as separate states. Do not claim delivery from a successful database insert.
7. If no external route exists or consent is revoked, the report remains available in the authenticated SARINA workspace and the farmer receives the in-app notification.

The existing SARINA Connect outbox references `expert_consultation_messages`, not `expert_request_reports`. Do not attach a report row directly to that outbox without a reviewed schema contract. Create the canonical consultation message first, then enqueue its message ID.

**Important integrity note:** `expert_case_notifications` currently has recipient-scoped read/update policies, but its table-level UPDATE grant is broader than the intended `read_at`-only behavior. A separate least-privilege grant review is already recorded in the chat-completion workstream; verify all legitimate clients/RPCs before changing it.

## Expert secretary behavior

- Launcher is mounted only after the authenticated expert profile has loaded.
- Counts are scoped to the current expert's assignments and recipient notifications.
- Shortcuts navigate to the existing cases, case-operations and notification tabs.
- Text entered into the secretary composer must remain visibly marked as a local preview until a durable, authenticated expert-note endpoint is implemented.
- Durable internal notes use `expert_case_notes` with the existing least-privilege policy; they are not farmer-visible reports.
- Never convert a secretary note into a farmer report without explicit specialist review and confirmation.

## Required release gates

### Functional
- Farmer launcher appears only for farmer role; expert secretary appears only for the authenticated expert workspace.
- The companion and human consultation inbox remain separate.
- New external intake creates exactly one request, assignment, consultation and initial message.
- Messages from Bale/Telegram append to the same consultation history used by the web app.
- Ambiguous or revoked routes do not write or deliver messages.
- Specialist report is visible to the farmer in SARINA and, only with active consent, delivered through the selected bot route.
- A provider outage does not block in-app messaging or report access.

### Security and integrity
- Farmer cannot create a request for another farmer or attach a message to another farm/case.
- Specialist cannot read or report on an unassigned case.
- A reassigned/revoked specialist loses access according to the existing assignment policies.
- Duplicate provider updates create no duplicate request, message, notification or delivery job.
- Bot tokens, webhook secrets, provider IDs and raw payloads never enter browser code, source control or ordinary logs.
- Internal notes and farmer-visible reports remain separate.
- Handover authorization defect recorded in the existing chat-completion workstream must be fixed and negative-tested before enabling external consultation routing.

### Validation and rollout
- Add role-switched SQL/RLS tests for farmer, assigned verified specialist, unverified specialist, previous specialist after handover, unrelated user and service worker.
- Test request intake atomicity, provider update replay, duplicate delivery, revoked consent, inactive consultation, multiple open consultations, provider throttling and dead-letter recovery.
- Test report visibility and notification recipient derivation from the request owner.
- Run typecheck, lint, build, automated tests and mobile RTL smoke tests.
- Verify Telegram and Bale with sandbox bots before enabling production routes. Keep production bot secrets and feature flags disabled until the full acceptance suite passes.

## Current implementation status

- Farmer companion and expert secretary visual launchers are integrated by the companion UI PRs and this main-based integration branch.
- Existing web request/consultation and expert report records are reused; no parallel case/message store is introduced.
- SARINA Connect's database routing/outbox foundation exists on `main`.
- Live Bale/Telegram adapters, account-linking/consent flow, atomic bot intake, farmer report display/notification and provider delivery are not yet verified as implemented. They remain explicit integration work and must not be presented as live.
- No production database migration, provider secret, bot webhook or external delivery was changed by this documentation/UI integration.


## Approved specialist recommendations in the farmer weekly plan

The weekly farmer plan is the execution surface for structured recommendations from the assigned specialist. Do not parse free-text consultation messages or reports into executable tasks.

### Authoring and approval

- A recommendation is attached to the canonical `expert_requests` case, its `expert_consultations` record and the request's farm.
- Only the currently assigned, verified specialist with an accepted assignment can create a recommendation.
- The specialist's explicit **final approval and save** action creates the row in `expert_recommendation_actions` with `status='approved'` and an approval timestamp. Draft text in a composer is not visible to the farmer.
- Each recommendation contains an instruction, priority, start date and optional due date. It is not a fertilizer/pesticide prescription unless the specialist explicitly writes that instruction and has the appropriate qualifications.

### Farmer execution and feedback

- The farmer sees only recommendations for their own farm and case, with the specialist-approved text and schedule.
- The farmer can mark an action in progress, submit an execution note, mark it complete, or request a specialist review.
- Completion and review requests create recipient-scoped events in `expert_case_notifications` for the specialist attached to that recommendation. A notification row means the in-app event was created; it does not imply push, email, Bale or Telegram delivery.
- The weekly plan keeps farmer-created improvement tasks separate from specialist recommendations. Farmers cannot edit the recommendation instructions, approval, author, case or schedule fields.
- Photo/document evidence upload is a later extension; this slice stores a bounded evidence array but the UI currently collects text notes only.

### Security and rollout

- The migration `20261122180000_expert_recommendation_weekly_schedule.sql` is committed to the integration branch only and has **not** been applied to the connected Supabase project.
- The recommendation table has RLS for the request owner and the currently assigned verified specialist. Farmer updates are column-limited to execution status, note, evidence and completion metadata.
- Do not merge or enable this feature until the migration is reviewed, role-switched RLS tests pass, and the frontend/PWA build checks complete.
