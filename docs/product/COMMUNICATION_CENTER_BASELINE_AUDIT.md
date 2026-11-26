# SARINA Communication Center — Baseline Audit

Audit date: 2026-11-26
Target implementation base: `main`
Working branch: `feat/sarina-unified-communication-center`

## Executive finding

SARINA already has separate communication surfaces and canonical data domains, but it does not yet have one unified inbox. The implementation must create a common navigation/presentation shell over existing domain adapters; it must not merge histories into a new generic message table or imply that every category is already operational.

## Existing surfaces and sources

### Floating SARINA companion (`src/SarinaCompanion.tsx`)
- Mounted at the application shell for farmer and administrator roles.
- The farmer chat path is currently a local component-state prototype: `sendText` adds the user's message to local state and shows a prototype notice; it does not persist a conversation or call a general farmer AI response endpoint.
- The admin path invokes the `sarina-admin-chat` Edge Function and is explicitly an admin-only test path.
- The component currently includes a guide drawer and voice controls. The guide drawer is not a persistent conversation inbox.
- Do not treat this component's local message array as canonical message history.

### Farmer-specialist conversations (`src/components/FarmerSpecialistChatInbox.tsx`)
- This is the existing human consultation inbox and should remain the canonical source for farmer ↔ assigned verified specialist conversations.
- It uses `expert_requests`, `expert_request_assignments`, `expert_consultations`, `expert_consultation_messages`, and `expert_case_notifications`.
- Main-branch version includes additional consultation workflow capabilities (including attachment/audio handling and pre-read deletion controls) that must be preserved during any UI redesign.
- Existing authorization and case assignment rules must remain authoritative. No generic cross-user query or broad admin transcript view should be introduced.

### SARINA Connect
- `docs/SARINA_CONNECT_ARCHITECTURE.md` defines `expert_consultations` and `expert_consultation_messages` as the canonical in-app consultation message source.
- External channels are transport adapters and must reference canonical messages; provider-specific histories must not become competing message stores.
- AI credit exhaustion or AI service downtime must never block ordinary communication.

### AI conversation history
- The database model defines `ai_conversations` and `ai_messages` in `sarina_migration_003_ai_experts.sql`.
- Existing product architecture notes state that these tables are RLS-protected and should not be opened to ordinary authenticated clients as a shortcut.
- A future inbox adapter must use a secure server-side endpoint with explicit user ownership checks. Until that endpoint is audited and available, do not claim persistent AI chat history is connected to the companion.

### Organizations and support
- The inspected main-branch application has organization/institution portals and service/request workflows, but repository search did not identify a canonical organization-to-user chat inbox or a support ticket messaging store.
- Do not show fake conversations or connect organization messages to service requests unless a reviewed domain model explicitly establishes that relationship.
- Organization and support categories may appear in the design shell as unavailable/coming later, but must not look like active message inboxes until their canonical sources and permissions exist.

### Translation
- The main-branch source tree search did not locate a dedicated message-translation module, translation Edge Function, or translator adapter.
- The app does have a UI-language selector; UI localization is not proof of message translation.
- The user has stated that SARINA has a translator. This audit finding is limited to the inspected repository tree; the translator may exist in another service, branch, or external subsystem. Locate and verify that implementation before wiring it into messaging.
- The message model must retain the original text. Translation should be a derived display/preview layer, never overwrite canonical content, and must fail open to the original message.

## Recommended implementation sequence

1. Create a common responsive communication shell and drawer, with role-aware categories and explicit availability states.
2. Connect the first fully verified adapter: farmer-specialist consultations, preserving the existing inbox queries, realtime behavior, pagination, attachments/audio and deletion controls.
3. Audit and add the secure AI conversation endpoint before showing persistent SARINA AI history in the same drawer.
4. Identify the user's existing translator service and integrate it through a narrow adapter with original/translated toggling and send preview.
5. Add organization and support inbox adapters only after their canonical message sources and RLS/authorization contracts are identified.
6. Verify mobile RTL/LTR behavior, permissions, realtime, retry, attachments, voice, translation fallback and end-to-end flows before production release.

## Safety and change-control constraints

- No new generic message table.
- No disabling or weakening RLS.
- No direct browser access to AI history without verified ownership policies.
- No parallel SCI command center.
- No paid AI API as a mandatory dependency for core messaging or translation.
- No migration, production secret, storage-policy or production deployment change under this UI task without separate review and approval.
- Keep the original SARINA companion, specialist inbox and AI history logically distinct while they are brought under a common presentation shell.

## Current implementation status

- Audit complete for the principal source files and architecture documents listed above.
- A dedicated feature branch has been created from `main`.
- No application code, database schema, RLS, storage policy, secret, or production setting has been changed in this audit step.