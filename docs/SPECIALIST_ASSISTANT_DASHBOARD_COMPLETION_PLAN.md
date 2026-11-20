# Specialist Assistant & Dashboard Completion Plan

## Scope and priority
This workstream is limited to:
1. Specialist case assistant (intake, evidence preparation, human review, follow-up, reminders, handover).
2. Specialist dashboard (case workload, notifications, consultation, productivity oversight, availability and actionable summaries).

Do not expand this workstream into marketplace, investment, or unrelated farmer modules.

## Repository checkpoint
- Production branch: `main`
- Development branch: `develop`
- `develop` was fast-forwarded to the current `main` after PR #64 was merged.
- Both branches therefore start this workstream from the same repository state.
- Vercel Production Branch is configured as `main`; deployment success remains a separate verification gate.

## Existing implementation found
- `src/components/ExpertDashboard.tsx`: specialist profile/onboarding, assignments, consultation messages, notifications, reports, credentials, impact signals, contracts/settlements, productivity and navigation.
- `src/components/ExpertCaseOperationsWorkspace.tsx`: assistant case status, missing-information checklist, evidence-preparation action, availability/capacity, vacation and consent-based handover.
- `src/SpecialistWorkspace.tsx`: supervised-farm dashboard, productivity timeline and scheduled actions.
- `supabase/functions/specialist-case-preparation/index.ts`: verified-expert and assigned-case checks, evidence collection, optional signed provider dispatch, human-review requirement.
- `supabase/functions/sarina-central-intelligence/_shared/specialist-preparation.ts`: evidence packet with provenance and explicit missing-data/safety markers.
- Existing expert workflow docs and migrations cover case notifications, availability, handover, reminders, security and dashboard data views.

## Completion phases

### Phase 1 — Reliability and workflow audit
- Verify every dashboard query against current schema, RLS and grants.
- Check partial-failure handling so one unavailable panel does not blank the entire dashboard.
- Verify case list, assistant record, consultation, messages and notification linkage.
- Check duplicate/rapid actions, loading states, stale state after writes and error feedback.
- Confirm the AI preparation endpoint never returns an authoritative diagnosis or dosage and that provider dispatch remains disabled unless server-side controls are configured.
- Verify evidence source labels, dates and confidence/provenance are visible and understandable.

### Phase 2 — Specialist case assistant
- Make the case intake queue actionable and ordered by urgency/age.
- Show case completeness, missing evidence domains and next required action.
- Add a safe follow-up workflow that sends the farmer a clear, structured request for missing information through the existing case channel.
- Make AI preparation idempotent/rate-limited and auditable; show provider-disabled/evidence-only state distinctly.
- Preserve specialist approval as a mandatory step before any recommendation/report is shared.
- Test reminders, escalation, handover consent and substitute acceptance/rejection.

### Phase 3 — Specialist dashboard
- Provide an at-a-glance work queue: new, awaiting review, missing farmer information, overdue, and completed.
- Make notification counts and case status consistent with the underlying records.
- Improve farm-level productivity view with baseline/latest value, trend, measurement quality and missing-data context where the schema supports it.
- Ensure each panel degrades independently and includes a useful empty/error state.
- Validate responsive/mobile and Persian RTL behavior.

### Phase 4 — Verification and release
- Run available automated checks and build.
- Execute role-based tests for farmer, verified specialist, unverified specialist and central administrator.
- Test unauthorized cross-farm/cross-case access and column-level write restrictions.
- Verify scheduled reminder job and notification delivery.
- Confirm Supabase migration history before applying any new migration; do not replay archived or already-applied migrations.
- Release only after successful build, security checks and smoke tests. Vercel rate-limit failure is not evidence of source-code failure, but it also is not a successful deployment.

## Acceptance criteria
- A verified specialist sees only cases assigned to that specialist.
- The assistant clearly distinguishes farmer-reported information, recorded/lab measurements and missing data.
- AI-generated material is explicitly a draft, evidence-linked, and requires specialist approval.
- The farmer receives actionable follow-up information through the existing case conversation/notification mechanism.
- Handover never changes ownership before farmer consent and substitute acceptance.
- Dashboard panels remain usable when an unrelated query fails.
- Productivity views do not present missing data as zero or imply causation from a simple time trend.
- No service-role secret is exposed to browser code.
- Build and role/security tests pass before production release.

## First review findings / watch items
- The current specialist dashboard loads many independent datasets in one refresh operation; inspect failure isolation and query authorization carefully.
- The case-operations view currently combines assistant, availability and handover controls in one workspace; simplify the primary case-review path without removing governance controls.
- The evidence-preparation endpoint has a safe provider-disabled mode and signed provider gate; retain this boundary and verify operational logging, request throttling and provider-output validation before enabling model calls.
- The specialist productivity panel currently describes itself as operational monitoring; richer natural-language analysis is not yet represented as completed functionality.

## Change control
- Work on `develop`; do not edit `main` directly.
- Keep changes focused on the two priority modules.
- Any schema change requires a new forward-only migration and an explicit migration-history check.
- Do not delete legacy branches or migrations as part of this workstream.
