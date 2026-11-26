# SARINA Communication Center — Role Access Matrix and Phase 2 Baseline

Audit date: 2026-11-26
Base commit: `ffe4a9d5ff7ede57b2cf435e580f3081a6e402c9`
Working branch: `feat/communication-center-role-inboxes`

## Scope

Implement the approved shared communication panel as a role-aware presentation layer over existing canonical communication domains. This document records verified sources and release boundaries; it does not authorize production database changes.

## Role-to-conversation matrix

| Signed-in role | Verified source | What the user may see | Current status / boundary |
|---|---|---|---|
| Farmer | `expert_requests`, `expert_request_assignments`, `expert_consultations`, `expert_consultation_messages`, `expert_case_notifications` | Their own consultations and messages with the currently assigned, verified specialist | Existing `FarmerSpecialistChatInbox` is the canonical UI/data path. Preserve pagination, attachments/audio handling, first-human-view deletion, notification read state and assignment/handover checks. |
| Verified specialist | Same consultation tables, scoped through their verified `expert_profiles` and offered/accepted assignments | Only consultations for cases currently assigned/offered to that specialist | Existing inbox/case chat exists. A dedicated inbox view should reuse it; revoked/reassigned cases must disappear under RLS. |
| Organization / public institution | `institutional_message_threads`, `institutional_messages` and scoped RPCs | Only recipient threads for the signed-in user and organization communications authorized by `organization_has_scoped_access(..., 'communications.read', ...)` | Existing secure RPCs: `send_institutional_message`, `reply_institutional_message`, `mark_institutional_thread_read`. Direct client INSERT/UPDATE policies are absent; use reviewed RPCs, not direct table writes. |
| Administrator | Existing admin-only `sarina-admin-chat` endpoint and admin workspaces | Admin assistant and explicitly authorized administrative workflows | `sarina-admin-chat` checks authenticated identity and `is_sarina_admin()`. It is an experimental admin assistant, not a general-purpose transcript viewer. Do not expose it to other roles. |
| Livestock keeper | No verified canonical human-chat inbox identified in this audit | Only categories backed by a real, authorized source | Do not show fabricated chats or silently route livestock conversations into farmer consultations. Identify an existing canonical livestock support workflow before enabling. |
| Support / helpdesk | No canonical support-ticket conversation store verified in this audit | Only actual support cases assigned to or owned by the user | Keep unavailable until a real source and access contract are verified. |
| SARINA AI history | `ai_conversations`, `ai_messages` exist in the database | Only the authenticated owner's own AI conversations, through a secure, ownership-checked server-side interface | RLS is enabled but no policies are currently present on these tables. Do not query from the browser or create a broad policy as a shortcut. Build a scoped server-side adapter after migration/history and authorization review. |

## Cross-cutting invariants

- The common panel is a shell, not a new message database.
- Human consultations, institutional correspondence, admin-only AI, and farmer AI history remain distinct domains.
- The current farmer companion's non-admin text path is local component state and a prototype notice; it is not persisted and does not call a general farmer AI response endpoint.
- The admin companion invokes `sarina-admin-chat`; its access gate must remain server-side.
- No role may see another user's private thread, and a role label from client state is never an authorization boundary.
- No fake contacts, messages, unread counts, delivery/read receipts, or unsupported category availability.
- Existing message deletion, attachment/audio, pagination, Realtime reconciliation, consent, and audit behavior must be preserved.
- Translation must retain canonical original text and be an optional derived display/preview. The user has stated that a translator already exists; the current main-branch repository search did not identify its implementation. Locate and verify the existing service/adapter before integration; do not replace it with a new paid API or silently translate/overwrite messages.
- No new generic chat tables, no weakened RLS, no service-role key in the browser, and no parallel SCI command center.

## Verified database access observations

- Consultation message SELECT and INSERT policies are participant-scoped. Specialist access is tied to a verified profile and offered/accepted assignment; farmer access is tied to request ownership.
- Notification reads/updates are recipient-scoped by `current_sarina_user_id()`.
- Institutional thread reads are scoped to the recipient or an organization access scope with `communications.read`. Message reads inherit that thread-level scope.
- Institutional message send/reply/read operations are implemented as SECURITY DEFINER RPCs with authenticated-user checks and audit events. The UI must invoke those RPCs rather than write directly to the tables.
- `ai_conversations` and `ai_messages` have RLS enabled but currently have no client policies; treat them as inaccessible to ordinary browser queries until a secure adapter is designed and tested.

## Phase 2 implementation order

1. Build the role-aware conversation drawer and category registry from the verified matrix above.
2. Integrate the farmer and verified-specialist consultation inbox as one shared adapter, preserving the existing component's complete workflow.
3. Integrate institutional correspondence through the existing scoped RPCs and recipient/organization policies.
4. Keep admin assistant isolated behind the existing admin authorization gate.
5. Design a server-side, owner-scoped adapter for AI conversation history only after auditing the existing AI conversation creation/message pipeline and all related migrations.
6. Locate the existing translator and integrate original/translated preview without modifying canonical messages.
7. Leave livestock-keeper and support categories unavailable until canonical sources and access rules are found.
8. Add role-negative tests, mobile RTL/LTR tests, Realtime/reconnect tests, and end-to-end send/read tests before release.

## Security findings outside this workstream

The current Supabase security advisor reports:
- RLS disabled on `public.spatial_ref_sys` (ERROR).
- 27 RLS-enabled tables without policies, including `ai_conversations`, `ai_messages`, messaging configuration tables, and several internal/admin tables.
- 4 SECURITY DEFINER functions executable by `anon` and 40 executable by `authenticated`; each needs a purpose-specific authorization review rather than blanket revocation.
- Leaked-password protection is disabled.

These are project-wide findings, not all communication-center defects. Do not apply broad remediation from this feature branch. The RLS-disabled PostGIS table finding must be reviewed separately with PostGIS extension behavior and application dependencies in mind.

## Change-control status

- This branch is based directly on the verified merge commit on `main`.
- Database inspection was read-only. No migrations, policies, grants, storage settings, or production data were changed.
- No Supabase development branch was created; the existing project has no isolated development branch and creating one may incur cost.
- The next implementation commits must remain on this feature branch and use forward-only migrations only after migration-history review and isolated verification.
