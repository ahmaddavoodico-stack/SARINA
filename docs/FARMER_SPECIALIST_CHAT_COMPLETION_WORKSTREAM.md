# SARINA Farmer–Specialist Chat Completion Workstream

## Product decision
The next active workstream is completion of direct farmer–specialist communication. Marketplace-linked financial features (farmer AI/service credit top-ups, brand-purchase incentive bundles, and specialist AI credit purchase flows) are explicitly deferred until marketplace order, payment, refund, and reward flows are being implemented.

The farmer–specialist chat is independent from “Talk to SARINA” (the AI assistant). It must not consume AI credits, depend on AI availability, or share a mixed conversation history with the AI assistant.

## Current repository baseline (develop)
- Farmer-facing entry exists in `src/components/FarmerExpertWorkspace.tsx` and is exposed as the expert consultation area in `src/App.tsx`.
- Farmer requests and consultations use `expert_requests` and `expert_consultations`.
- Both farmer and specialist send messages through `expert_consultation_messages`.
- Specialist-side conversation is currently embedded in the case workflow in `src/components/ExpertDashboard.tsx` under the cases tab.
- Both sides subscribe to INSERT events for the active consultation using Supabase Realtime.
- Farmer notifications use `expert_case_notifications`; specialist dashboard also listens for case notifications.
- Existing conversation design is documented in `docs/SPECIALIST_DASHBOARD_GREEN_CREDIT_CONTRACTS_CONVERSATIONS_DESIGN.md`.

This is a working foundation, not evidence that the full chat experience, attachment handling, unread/read synchronization, or production security has passed end-to-end tests.

## Target experience

### Farmer dashboard
- A distinct entry named “گفت‌وگو با متخصصان” / “مکالمات با متخصصان”.
- A conversation inbox showing specialist, related farm/case, latest message/time, unread state, and who should respond next.
- Search/filter for all, unread, awaiting farmer, awaiting specialist, active, and archived conversations where the data model supports these states.
- Dedicated conversation view with message history, clear sender/time, safe attachments, case context, and send/retry feedback.
- Keep the separate “صحبت با سارینا” AI assistant entry and history independent.

### Specialist dashboard
- A distinct “مکالمات” inbox, not only a chat embedded in a selected case.
- Inbox filters and unread/response-needed indicators.
- Conversation view linked to the assigned case, farmer, farm, and relevant contract when available.
- Existing case review and final-report workflow remains available and separate from ordinary chat composition.
- A verified specialist can access only consultations belonging to cases currently authorized for that specialist; unverified specialists must not gain message access.

### Shared communication behavior
- One canonical conversation/message store; do not create a parallel messenger.
- Preserve SARINA Connect as the central communication abstraction. Channel routing (in-app, Bale, Telegram, etc.) remains behind adapters and must not leak channel implementation into ordinary UI.
- Message delivery/read states must be truthful; do not show a message as delivered/read without the corresponding persisted event.
- Prevent duplicate sends on retries/double taps using a client-generated stable request key or a server-side idempotent RPC/constraint after schema review.
- Use pagination/incremental loading rather than silently truncating history at the latest 100 messages.
- Attachment upload/download must use private storage, scoped authorization, safe content-type/size checks, and expiring signed URLs; do not claim attachment support until implemented and tested.
- Realtime is an enhancement, not the source of truth: initial load and reconnect must reconcile persisted messages without duplicates or gaps.
- One panel failing must not blank the rest of either dashboard.

## Implementation sequence
1. Inspect current migration history, table definitions, RLS policies, grants, storage policies, notification triggers, and any existing read/delivery fields. Do not infer security from UI filters.
2. Map the current farmer and specialist message flows end to end, including consultation creation, assignment acceptance, access checks, notification creation, and handover.
3. Implement the farmer inbox and conversation route using existing authorized records.
4. Implement the specialist inbox and conversation route, retaining case-context links and report workflow.
5. Add or repair unread/read state, response-needed status, pagination, retry/idempotency, and realtime reconnect reconciliation. Add forward-only migrations only if schema review proves they are needed.
6. Implement attachment support only after private storage and authorization have been verified.
7. Test role boundaries and end-to-end behavior for farmer, assigned verified specialist, unverified specialist, reassigned specialist, and administrator, including cross-farm/cross-case access attempts.
8. Run build, automated tests, and a deploy/smoke test before declaring completion.

## Non-goals for this workstream
- AI assistant conversation UX or AI provider activation.
- AI credit purchase/top-up, monthly allowances, payment processing, brand-purchase reward bundles, and marketplace incentives.
- Contract payment/settlement redesign.
- External channel activation unless separately approved and the relevant SARINA Connect adapter is ready.

## Release acceptance criteria
- Farmer and assigned verified specialist can exchange messages reliably in the same consultation.
- Both dashboards provide an independent conversation inbox and a usable conversation view on mobile and desktop, including Persian RTL.
- “Talk to SARINA” remains a separate AI experience and never appears in the human-chat inbox.
- Unread/read and response-needed states reflect persisted data.
- Reconnect/retry does not lose or duplicate messages.
- Message history is paginated and complete.
- Unauthorized cross-case access is denied by server-side RLS/RPC/storage controls.
- Attachments are either fully secured and tested or clearly not offered.
- Build, role/security tests, and smoke tests pass before production release.

## Change control
- Work only on `develop`; do not edit `main` directly.
- Keep this workstream limited to farmer–specialist communication.
- Preserve existing migration history; schema changes must be forward-only after migration-history review.
- Do not activate external AI providers or marketplace-linked financial flows as part of this workstream.


## Implementation and security audit update (2026-11-21)

### UI work committed to develop
- Added `src/components/FarmerSpecialistChatInbox.tsx` as a shared, role-aware inbox for farmer and verified specialist accounts.
- Added a distinct farmer navigation entry, `گفت‌وگو با متخصصان`, separate from the expert directory/request form.
- Added a distinct specialist navigation tab, `مکالمات با کشاورزان`.
- The inbox uses the existing `expert_requests`, `expert_request_assignments`, `expert_consultations`, `expert_consultation_messages`, and `expert_case_notifications` records; no parallel message store was created.
- Added message history pagination (50 messages per page), realtime INSERT subscription for the active conversation, deduplication of realtime inserts, a 6,000-character text limit, sending-state protection against repeated taps, and marking all unread message notifications for the active consultation as read.
- The new inbox is text-only. It does not advertise generic file attachments or render existing audio payloads. The legacy database audio-note path remains separate and must be integrated/tested before the new inbox can claim voice-note support.
- Existing case-specific chat and report workflow remain available as contextual tools; the new inbox is the dedicated communication entry point.

### Read-only database audit findings
- The connected Supabase project currently has no development branches. Its migration history includes the existing expert messaging, realtime, voice-note, voice-upload cleanup, and voice-message policy-hardening migrations; no migration was applied during this audit.
- RLS is enabled on the core request, assignment, consultation, message, notification, profile, and handover tables.
- Message SELECT and INSERT policies are participant-scoped. Specialist access is tied to a verified profile and an offered/accepted assignment; the farmer is checked against the request owner.
- The handover completion trigger revokes the prior specialist's offered/accepted assignment when the substitute accepts, then updates the request's assigned specialist. The active message access policies no longer include revoked assignments.
- Realtime publication currently includes `expert_consultation_messages` and `expert_case_notifications`.
- The `expert-voice-notes` storage bucket is private and has consultation/participant-scoped storage policies. No generic document/image attachment path was verified for chat; do not expose one in the UI yet.
- **Integrity hardening item identified:** the notification UPDATE policy restricts rows to their recipient, but the `authenticated` role has table-level UPDATE privilege on `expert_case_notifications`. This appears row-scoped rather than cross-user access, but it permits a recipient to update columns beyond `read_at` on their own notification rows. The intended least-privilege fix is to revoke table-level UPDATE and grant UPDATE only on `read_at`, after confirming all legitimate clients and RPCs. This requires a forward-only migration and tests.
- The Supabase security advisor also reports unrelated project-wide findings (including RLS-disabled `public.spatial_ref_sys`, several RLS-enabled tables without policies, and SECURITY DEFINER RPC exposure). Those findings need a separate scoped security review; do not make broad unrelated changes in this chat workstream.

### Environment and release gate
- No Supabase development branch is currently available. Creating one requires explicit cost approval at **US$0.01344 per hour** for the selected organization. No branch was created because that cost has not yet been approved.
- No database schema, grants, RLS policies, or storage policies were changed.
- GitHub Actions returned no workflow runs for the latest commit. The latest Vercel status is a Build Rate Limit failure; a successful build/deployment is not established.
- Therefore this work is a committed UI foundation plus a read-only security audit, not a production-ready release. The grant hardening, role-based negative tests, full build, and smoke tests remain release blockers.


### Critical authorization defect discovered during deeper handover review
- The INSERT policy `expert_case_handovers_assigned_expert_insert` contains the tautology `er.requester_user_id = er.requester_user_id` instead of binding `expert_case_handovers.requester_user_id` to the actual request owner.
- The `authenticated` role has INSERT permission on this table, and the `respond_to_expert_case_handover(p_handover_id, p_accept)` SECURITY DEFINER function authorizes the caller by comparing `v_handover.requester_user_id` to `current_sarina_user_id()`. Since the INSERT policy does not validate that field against the request owner, an assigned specialist could potentially create a handover row with their own user ID and invoke the farmer-consent RPC themselves.
- The normal specialist UI currently supplies the real `requester_user_id`, but client behavior is not a security boundary. This is a server-side authorization vulnerability, not merely a UI issue.
- Required remediation on a development branch: replace the tautological predicate with `er.requester_user_id = expert_case_handovers.requester_user_id`; independently harden the RPC by joining the handover to its request and requiring `expert_requests.requester_user_id = current_sarina_user_id()`; review function EXECUTE grants and preserve only the intended farmer invocation. Add negative tests proving the assigned specialist cannot create or approve a handover as the farmer, while the actual farmer can approve/decline.
- Treat handover and chat release as blocked until this migration is applied and tested in an isolated development database. No production changes have been made.


## Sender deletion before first human view (2026-11-26)

- Human messages (text, audio, image, PDF) are deletable by their sender only until the first authorized human recipient opens the message in a conversation view.
- The first human recipient view is stored on the canonical message row. Sender self-view, AI/background processing, and notification creation do not count.
- Database row locking serializes first-view marking and sender deletion; whichever valid operation wins first determines the result.
- Deletion redacts message text and attachment descriptors, marks a minimal tombstone, and redacts linked notification previews. Private Storage cleanup is attempted immediately after the DB accepts deletion; a durable server-side cleanup retry remains a hardening item.
- Voice recording can be cancelled before send; cancellation discards in-memory chunks and creates no message or Storage object.
- Chat history remains persisted when the panel closes or refreshes. No automatic 24-hour expiry is applied.
- Migration: `20261126113000_expert_message_pre_read_deletion.sql`. A transactional syntax/application test was run against the connected database and rolled back; no schema change was retained.
- Source changes are isolated on `feature/main-human-view-message-delete`, based directly on `main`. Build/CI and authenticated two-user race/role acceptance tests remain required before production rollout.
