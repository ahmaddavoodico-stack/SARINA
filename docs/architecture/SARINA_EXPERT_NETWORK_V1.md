# SARINA Experts & Expert Case — Architecture V1

Status: implementation blueprint; schema and API are not yet deployed.
Scope: a farmer can request help from a verified human expert or organization, receive a routed offer, communicate, and keep the outcome attached to the relevant farm.
Product principle: human expertise is a first-class route alongside AI, not a fallback hidden outside SARINA.

## 1. Goals and non-goals

### Goals
- Support independent experts and expert organizations.
- Represent verified professional identity, specialties, credentials, service modes, service areas, availability and service offerings.
- Let a farmer request online, phone or in-person help without having to identify the correct expert.
- Create one durable Expert Case for each support request.
- Route a case to eligible experts using specialty, geography, service mode, language, availability and verification status.
- Support expert acceptance/decline, case status, structured messages, evidence attachments, appointments and field-visit outcomes.
- Link each case to a farm and preserve a farmer-visible summary in the farm's history.
- Keep AI-assisted triage and human case handling interoperable through stable internal contracts.

### Non-goals for the first release
- Built-in video conferencing or telephony infrastructure.
- Payments, escrow, commissions, subscriptions or refunds.
- Automatic diagnosis or autonomous physical instructions.
- Public expert marketplace ranking based only on popularity.
- Multi-expert collaboration, arbitration and complex organization hierarchies.
- Worker dispatch or farm-operation execution.

## 2. Actors and trust boundaries

| Actor | Capabilities |
|---|---|
| Farmer | Create a case for an accessible farm, choose contact preferences, share selected farm context, message assigned experts, confirm completion and rate the service. |
| Expert applicant | Create a professional application and submit credentials; cannot receive farmer cases until approved. |
| Verified expert | Maintain approved profile and service offerings, receive eligible case invitations, accept/decline, communicate and submit findings. |
| Organization manager | Maintain organization profile and authorized staff membership; assign cases only to verified organization experts. |
| SARINA operations/admin | Review identity and credentials, approve/suspend experts and organizations, resolve reports and manage taxonomy. |
| SARINA Central Intelligence | Classify the request, identify missing information, prepare a consent-bounded case brief and recommend eligible expertise. It does not impersonate a human expert or approve credentials. |

A profile being present is not proof of professional qualification. Verification state and evidence must be explicit and auditable.

## 3. Product surfaces

### Farmer workspace
- Entry point: "دریافت کمک متخصص" / "Get expert help" on a farm.
- Start with a short, choice-led intake: issue category, crop/group, urgency, preferred service mode, language and concise description.
- Allow "I don't know" and optional photo/document upload.
- Show what farm information will be shared and obtain explicit consent before sharing it with an external expert or organization.
- Show request status, assigned expert identity and verified specialties, expected response window, communication history and final summary.
- Offer online/phone consultation and in-person field visit only when service coverage supports it.

### Expert workspace
- Application and profile completion.
- Credential submission and verification status.
- Specialty and crop taxonomy, languages, service area, supported modes, indicative fees and availability.
- Case inbox with only cases the expert is authorized to view.
- Accept/decline with reason, case messages, appointment proposals and final report submission.

### Operations console
- Review applications and credential evidence.
- Approve, reject, request more information, suspend or revoke verification.
- Maintain specialty taxonomy and service modes.
- Inspect case status and audit events for support and dispute handling without unrestricted access to private case content by default.

## 4. Core domain model

The following is the proposed logical model, not an instruction to create these tables blindly. Before migrations, compare it with the live schema and existing users, roles, provider registry, storage buckets and RLS policies. Reuse compatible structures and avoid duplicate identity systems.

### Expert identity and capability
- `expert_profiles`: one professional profile linked to an authenticated identity; display name, biography, country/region, languages, contact policy, verification state, visibility state and timestamps.
- `expert_organizations`: company, laboratory, advisory center or institution profile; legal/display name, registration metadata, locations, verification state.
- `expert_organization_members`: organization-to-expert membership with explicit role and active state.
- `expert_credentials`: credential type, issuer, reference, issue/expiry dates, evidence storage reference, review state, reviewer and review timestamps. Sensitive evidence must not be publicly readable.
- `expert_specialties`: normalized specialty taxonomy (e.g. soil, irrigation, plant nutrition, pathology, entomology, machinery, farm economics).
- `expert_profile_specialties`: expert's specialties, crop focus, proficiency/experience metadata and verification state.
- `expert_service_offerings`: service type, mode (async, chat, phone, online meeting, field visit, sampling/lab coordination), coverage, indicative fee/currency, duration and active state.
- `expert_service_areas`: country/administrative regions and optional bounded geographic coverage. Do not expose an expert's private home address.
- `expert_availability`: availability windows or simple weekly schedule; avoid building a complex calendar engine in V1.

### Expert case and communication
- `expert_cases`: case ID, farmer user ID, farm ID, category, title, description, urgency, requested mode, language, consent snapshot, status, created/updated timestamps and closure metadata.
- `expert_case_assignments`: case-to-expert or case-to-organization assignment, invitation/acceptance/decline state, assigned role, response deadline and timestamps. Keep assignment history rather than overwriting it.
- `expert_case_messages`: case-scoped messages with sender identity/type, message type, body, attachment references and timestamps. Access only for case participants and authorized operations staff.
- `expert_case_appointments`: proposed/confirmed/cancelled appointment, mode, start/end with timezone, meeting reference or field-visit location details, and participants.
- `expert_case_reports`: structured expert findings, recommendations, limitations, evidence references, author and submission/review timestamps. Keep immutable submitted versions or explicit revision history.
- `expert_case_events`: append-only lifecycle events (created, triaged, invited, accepted, declined, reassigned, appointment, report, farmer confirmation, closed, reopened). Avoid relying on mutable status alone for auditability.
- `expert_case_feedback`: farmer feedback about communication, timeliness and service quality; keep separate from credential verification and technical correctness.

### Existing farm context
Cases reference the existing farm record. A case may store a consent-bounded snapshot/reference of relevant context and its provenance at the time of sharing. Do not copy the entire farm dossier into every case. Preserve source class and retrieval time for each shared context item.

## 5. Case lifecycle

1. `draft` — farmer is preparing the request; not visible to experts.
2. `submitted` — farmer submits and confirms the sharing scope.
3. `triage` — SARINA checks category, urgency, farm link, consent and minimum required details.
4. `matching` — eligible verified experts/organizations are identified.
5. `offered` — invitation sent to one or more eligible experts according to a bounded routing policy.
6. `accepted` — an expert accepts; assignment is locked for the active work period.
7. `in_progress` — communication, consultation or field work underway.
8. `waiting_for_farmer` / `waiting_for_expert` — explicit pause with a reason and optional due time.
9. `report_submitted` — expert submits findings and limitations.
10. `completed` — farmer acknowledges completion or an approved closure policy applies.
11. `cancelled` / `expired` / `rejected` — terminal outcomes with reason.
12. `reopened` — a follow-up is requested; preserve the prior report and event history.

Status changes must be validated server-side. A client must not be able to mark a case accepted, completed or verified by directly writing arbitrary status values.

## 6. Routing and matching

Eligibility is a hard filter; ranking is a soft preference.

### Hard filters
- Expert and organization are active and verification is approved.
- Specialty is compatible with the case category and crop/context.
- Requested mode is supported.
- Service area covers the farm for in-person work.
- Expert is currently accepting requests and has capacity.
- Language requirement is met where specified.
- No suspension, conflict-of-interest or case-access restriction applies.

### Ranking signals
- Relevant verified specialty and crop experience.
- Geographic proximity for field work.
- Availability and expected response time.
- Farmer's selected preference and prior case continuity.
- Quality and timeliness indicators with minimum sample-size safeguards.

Do not rank solely by paid placement or unverified ratings. Explain the reason for recommendations in simple language. In early release, use transparent rules rather than opaque machine ranking.

### Escalation
If no qualified expert is available, say so clearly and offer a safe alternative: broaden the area, change the mode, join a waitlist or use AI-supported general guidance with its uncertainty clearly labelled. Do not silently route a high-risk case to an unqualified person.

## 7. Consent, privacy and security

- Farm ownership/access must be verified on the server for every case operation.
- Consent is purpose-specific: what farm fields, observations, images, tests and contact details are shared, with whom, and for what case.
- Default to minimum necessary context. The expert does not receive unrelated farm records.
- Revocation stops future access where feasible; preserve records legally required for the case and explain retention limits.
- Experts can access only cases assigned to them and only while the assignment is active or retained for a defined audit period.
- Organization managers do not automatically gain access to every case of every member; access is explicit and role-scoped.
- Credential evidence is private; only verified status and approved public credential summaries are displayed.
- Private attachments use private storage and short-lived signed access after authorization. Never expose bucket paths as public URLs.
- Apply RLS to all exposed tables, with explicit participant/ownership policies. Do not rely on authenticated role alone.
- Avoid service-role credentials in browser code. Any privileged workflow must be server-side and narrowly scoped.
- Record security-sensitive actions in an append-only event/audit trail.

## 8. API and event contracts

Initial farmer-facing operations:
- `POST /expert-cases` — create/submit a case for an accessible farm with explicit consent.
- `GET /expert-cases?farm_id=...` — list only cases visible to the farmer.
- `GET /expert-cases/{case_id}` — fetch case summary and permitted timeline.
- `POST /expert-cases/{case_id}/messages` — send a participant message.
- `POST /expert-cases/{case_id}/cancel` — cancel if lifecycle policy permits.
- `POST /expert-cases/{case_id}/feedback` — submit farmer feedback.

Initial expert operations:
- `POST /expert-applications` — apply and submit credentials.
- `GET /expert-inbox` — list eligible invitations/assigned cases.
- `POST /expert-cases/{case_id}/accept` and `/decline` — server-validated response.
- `POST /expert-cases/{case_id}/appointments` — propose or confirm appointment.
- `POST /expert-cases/{case_id}/reports` — submit a structured report.

These are logical contracts; implementation may use Supabase Edge Functions rather than a separate REST server. All operations require authenticated identity and server-side authorization.

Events should be versioned and provider-independent, e.g. `EXPERT_CASE_SUBMITTED_V1`, `EXPERT_CASE_OFFERED_V1`, `EXPERT_CASE_ACCEPTED_V1`, `EXPERT_CASE_MESSAGE_CREATED_V1`, `EXPERT_CASE_REPORT_SUBMITTED_V1`.

## 9. Interoperability with SARINA Central Intelligence and SIACP

- SCI may classify the case and prepare a concise expert brief from the farm context.
- The farmer must approve the data-sharing scope before the brief is exposed to an external expert.
- AI-generated triage is labelled as AI-assisted and is never represented as a verified diagnosis.
- A human expert report is stored separately from AI outputs, with author identity and credential state.
- SCI may summarize an expert report for the farmer, but must preserve the original report and attribution.
- Expert responses can be returned to SCI through a versioned internal contract; do not force human experts to speak SIACP directly.
- SIACP remains the AI-agent protocol. Human case APIs/events are a separate domain contract connected through SCI, not a misuse of the AI protocol.

## 10. Delivery plan

### Slice A — foundation (next implementation step)
1. Inspect the live schema, migrations, Auth identity mapping, RLS and storage setup.
2. Finalize minimal tables and indexes; create migrations only after schema review.
3. Add owner/participant-scoped RLS and test both permitted and forbidden access.
4. Add domain contracts and lifecycle transition validation.
5. Add expert application and admin verification workflow.

### Slice B — first useful workflow
1. Farmer creates a case linked to a farm.
2. SARINA triages and offers it to one verified expert.
3. Expert accepts or declines.
4. Farmer and expert exchange text messages.
5. Expert submits a report; farmer sees a plain-language summary.
6. Case and outcome appear in the farm history.

### Slice C — service expansion
- Appointment proposals and phone/online meeting links.
- Field visits with service-area matching and visit report.
- Private attachments and lab/sample coordination.
- Feedback, operational analytics and carefully governed ratings.

### Slice D — later commercial capabilities
- Payments and invoicing, organization plans, commissions and refunds only after service quality, legal requirements and country-specific operating model are established.

## 11. Acceptance criteria for V1

- A farmer cannot create or read a case for another farmer's farm.
- An unverified expert cannot see or accept farmer cases.
- An expert cannot access a case unless invited/assigned and authorized.
- An organization member cannot access cases solely because they belong to the organization.
- Case transitions are enforced server-side and recorded as events.
- Consent scope is visible and recorded before any external sharing.
- A farmer can submit, track, message, cancel when allowed, and view the final report.
- A verified expert can receive, accept/decline, communicate and submit a report.
- A no-match case produces an honest, safe next step rather than fabricated availability.
- No video/phone/field-service capability is claimed until the relevant provider/workflow is actually integrated and tested.

## 12. First implementation decision

Start with the smallest complete human-support loop: verified expert profile + specialty + expert case + assignment + text messages + final report. Keep organization support in the domain model, but do not block the first pilot on complex organization administration. Do not introduce payment, real-time video or field-visit scheduling before the basic case loop is proven.
