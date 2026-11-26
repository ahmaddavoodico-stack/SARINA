# SARINA Unified Communication Center — Implementation Plan

## Product objective

Make the SARINA chat experience the familiar, low-friction communication heart of the platform. The interaction model should feel immediately recognizable to users of mainstream messengers while supporting SARINA's broader roles, workflows, and multilingual agricultural community.

The UI shell may unify navigation and discovery, but it must not merge unrelated message histories or bypass the authorization rules of their source domains.

## Non-negotiable product principles

- Familiar, mobile-first messenger interaction; Persian RTL is a first-class layout, with Arabic and LTR languages supported.
- The farmer remains the primary user; common actions must be understandable without training and usable on small screens.
- Reuse existing canonical conversations, messages, notifications, and workflow services. Do not create a parallel generic message store.
- Keep human consultations separate from “Talk to SARINA” AI conversation history. A unified shell is not permission to mix their records.
- Organization/institutional communications and specialist consultations remain governed by their own domain workflows and authorization.
- AI-specialist/SCI activity is surfaced only through approved operational conversation or notification interfaces; the chat UI must not become a second SCI command center.
- Translation must preserve the original message and make the translated version clearly identifiable. Translation must not silently alter or replace source content.
- Never display delivery/read status unless supported by persisted server-side events.
- Do not expose attachments, audio, or channels until the existing storage, routing, and authorization paths are verified.

## Target interaction model

### Top app bar
- SARINA/avatar identity and active conversation identity.
- A menu control beside the avatar to open/close the conversation navigation drawer.
- Contextual conversation actions only when supported by the underlying domain.

### Collapsible conversation drawer
Categories are navigation filters over authorized records, not new message stores:
1. Customers / farmers
2. Specialists
3. Organizations / institutions
4. SARINA AI and specialist agents (only approved operational conversations; distinct from human chats)
5. Support
6. Archive

Each category should show its authorized conversation list with avatar/identity, display name, short last-message preview, timestamp, unread badge, and optional pinned state. Provide search and filters where the underlying data supports them.

### Conversation view
- Familiar sent/received message bubbles, sender identity, timestamp, and truthful status.
- Clear empty, loading, offline/reconnect, send-failure, and retry states.
- Mobile: drawer/list and conversation are separate navigable views; selecting a conversation closes the drawer and a back control returns to the list.
- Tablet/desktop: optional persistent side panel with the conversation in the primary pane.
- Keep composer uncluttered and preserve supported text, voice, and attachment capabilities only after verification.

### Translation experience
- Discover and reuse the existing SARINA translation capability; do not introduce a second translation provider or paid API dependency as a prerequisite.
- Determine supported languages, input/output contracts, latency, error behavior, and whether translation is currently available to the chat runtime.
- Respect each user's preferred display language where already stored; otherwise provide an explicit user choice without silently changing profile settings.
- Show translated text with a visible “translated” label and a one-tap way to reveal the original.
- Provide optional pre-send translation preview/edit/confirmation.
- Preserve original text, sender, timestamps, and message identity. Translation is a presentation/derived artifact, not a replacement for the canonical message.
- Translation failure must never block ordinary message delivery; fall back to the original and show a clear status.
- Do not translate system/security notices or structured identifiers in ways that change their meaning.
- Validate agricultural terminology and Persian/Arabic directionality. High-impact technical instructions should expose the original text and may require human review.

## Implementation phases

### Phase 0 — Baseline and integration audit
1. Identify the current production/main and development branch chat surfaces and their differences.
2. Inventory all existing communication domains: farmer-specialist consultations, organization/institutional messaging, support, AI assistant conversations, SCI operational events, SARINA Connect channels, and notifications.
3. Map each domain to its canonical tables/services, route, role permissions, and current UI entry point.
4. Locate the existing translation engine/module and document its API, supported languages, runtime dependencies, and current callers.
5. Audit existing message audio, file attachment, read/unread, archive, pin, and delivery capabilities; mark unsupported features explicitly.
6. Produce a domain-to-category mapping and a compatibility plan before changing the UI.

### Phase 1 — Shared communication shell
1. Implement the responsive top bar and collapsible drawer.
2. Add category navigation that queries each existing authorized domain adapter.
3. Add conversation list rows, search, unread badges, and pinned/archive affordances only where backed by real data.
4. Preserve independent conversation histories and existing workflow actions.
5. Keep mobile navigation low-friction and desktop panel behavior optional.

### Phase 2 — Message experience and reliability
1. Standardize visual message bubbles and composer styling without replacing domain-specific send services.
2. Reconcile initial loads and realtime updates without gaps or duplicates.
3. Retain pagination and implement retry/idempotency using existing supported mechanisms or a separately reviewed server-side change.
4. Add voice/file controls only for paths that pass storage and authorization review.
5. Ensure one domain's failure does not blank the entire communication center.

### Phase 3 — Translation integration
1. Connect the audited existing translation capability through a narrow adapter.
2. Add original/translated display, language selection, and pre-send preview where supported.
3. Cache derived translations only if privacy, retention, and invalidation rules are clear.
4. Preserve the canonical original message and handle translation failures gracefully.
5. Validate Persian, Arabic, English, and other languages confirmed by the existing translator.

### Phase 4 — Verification and staged release
- Build and automated tests.
- Mobile viewport and RTL/LTR acceptance.
- Role-based positive and negative authorization tests across farmers, assigned verified specialists, unverified specialists, organization users, support staff, administrators, and AI operational roles as applicable.
- Translation tests for language pairs, empty/long messages, mixed scripts, technical terms, failure, and original-text recovery.
- Realtime reconnect, pagination, retries, duplicate-send, unread/read, archive, and pinned-state tests.
- Production deployment and smoke tests only after review and approval.

## Release gates
- No parallel message store or parallel command center.
- No unauthorized cross-case, cross-organization, or cross-user visibility.
- AI assistant history remains separate from human messaging.
- No paid AI API is made a required dependency for core messaging or translation.
- No unsupported attachment/voice/delivery capability is advertised.
- Translation never overwrites the original and never blocks normal message sending.
- Build, role/security tests, and end-to-end smoke tests pass before production release.

## Current known baseline (2026-11-26)
- src/components/FarmerSpecialistChatInbox.tsx exists on develop and uses the existing expert_requests, expert_request_assignments, expert_consultations, expert_consultation_messages, and expert_case_notifications records.
- The inspected inbox is a farmer/verified-specialist text inbox with search, all/unread filter, pagination, realtime INSERT subscription, and read notification updates.
- The existing workstream document docs/FARMER_SPECIALIST_CHAT_COMPLETION_WORKSTREAM.md explicitly treats this as a farmer-specialist communication scope and records unresolved attachment, security, handover, and release gates. Preserve that scope; this unified communication plan must integrate with it rather than silently overwrite it.
- The application has a multi-language UI language selector. This alone does not prove that message translation is wired into chat.
- Repository code search did not yet locate a message-translation API/module. Translation integration remains an audit item; do not claim it is connected until its implementation is located and tested.
- No schema, RLS, storage, or production configuration changes are authorized by this plan.

## Change control
- Follow the repository's existing communication workstream guidance and make changes on develop; do not edit main directly.
- Prefer small, reviewable commits and keep the unified UI shell separate from database/security migrations.
- Any production schema, RLS, grants, storage, paid provider, or external channel changes require separate review and approval.
- A design/plan document or UI preview is not proof of operational readiness.