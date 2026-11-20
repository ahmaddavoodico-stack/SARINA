# SARINA Organization Governance

Status: database foundation applied to the active Supabase project.

## Operating model

- Private companies and eligible institutions may submit an organization application.
- Government, regulatory, public and international bodies are centrally created by a SARINA global administrator. They do not self-register.
- Organization records are international-ready; initial operational data entry starts with Iran.
- Organization creation, verification, service configuration and access grants are separate administrative decisions.

## Database changes

Applied Supabase migrations:
- `028_organization_governance_and_services`
- `029_organization_review_and_integration_policies`

Existing tables reused:
- `organizations`
- `organization_members`
- `organization_applications`
- `expert_credentials`
- `expert_recognition_awards`
- `integration_connections`
- `integration_endpoints`
- `integration_logs`
- `integration_sync_jobs`

New tables:
- `organization_capabilities`: per-organization enabled capabilities and configuration.
- `organization_access_scopes`: global, country, individual-user or farm-level oversight scope.
- `organization_services`: services and programs offered by an organization.
- `organization_audit_events`: administrative and organization activity history.
- `farmer_credentials`: farmer credentials and their review trail.
- `farmer_recognition_awards`: awards issued to farmers, with public verification tokens.

## Capability codes

- `oversight.farmer.read`
- `oversight.farm.read`
- `oversight.expert.read`
- `farmer_credential.review`
- `expert_credential.review`
- `farmer_award.issue`
- `expert_award.issue`
- `reports.view`
- `services.manage`
- `integrations.manage`

## Security model

- Central administration is checked against the global `admin` role.
- Organization actions require an active organization membership, an enabled capability and a matching scope.
- Government and regulator categories are excluded from self-service organization applications.
- External integration configuration and logs remain central-admin-only. Secrets are referenced by secret reference, not stored as plaintext in client-visible configuration.
- No broad read policy is added to the `users` table. Farmer personal contact details are not opened to organizations by this migration.
- RLS is enabled on all new tables and explicit policies are defined.

## Current implementation boundary

The Supabase backend foundation is in place. The connected GitHub repository currently contains SQL foundation scripts and no application frontend/admin-panel source. The following UI work remains:
1. Add an Organization Registry section to the SARINA central admin panel.
2. Add a central-admin-only form to create government/regulatory/support bodies.
3. Add capability and scope assignment controls.
4. Add service, report and integration configuration screens.
5. Add organization-side dashboards with only the permissions granted to each organization.
6. Add scoped farmer/expert directory projections and report endpoints before exposing broader personal or farm data.

Do not expose raw user tables or integration credentials to organization dashboards. Implement report projections and external-system connectors through narrowly scoped server-side endpoints.

## Farmer institutional services and official request routing

Migrations applied:
- `030_farmer_institutional_service_requests`
- `031_authority_registry_and_request_timeline`

Farmers can discover active institutional services and submit requests to the verified organization/service record. SARINA should explain the institution's published remit, jurisdiction, eligibility, required documents, official submission channel and whether the institution is the legally responsible authority or only a supporting/referral body.

Extended `organization_services` fields:
- `service_category`
- `is_official_authority` (central-admin governed; never self-declared by an organization)
- `authority_scope`
- `legal_basis`
- `eligibility_rules`
- `required_documents`
- `submission_mode` (`sarina_assisted`, `official_portal`, `api`, `email`, `in_person`, `information_only`)
- `official_service_url`, `official_contact`, `external_service_code`
- `public_description`, `response_sla_days`

New tables:
- `institutional_service_requests`: farmer request, farm context, explicit consent, target organization/service, status, official reference and external tracking reference.
- `institutional_request_events`: auditable status timeline with farmer-visible event flag.

Security and workflow:
- Farmers can read their own requests and submit only against an active service belonging to a verified organization.
- Organization members can read only requests addressed to their organization and within their granted capability and geographic/user/farm scope.
- Organization status changes are performed through `organization_update_institutional_request`, which checks authorization and records an event.
- Active service directory entries are readable by authenticated farmers.
- Only central SARINA admins can configure the official authority registry, legal remit and official routing metadata.
- Initial request submission is recorded in SARINA. Actual external filing, government API integration, portal automation, and verified status callbacks are not live until a specific official channel is configured and tested. For link-out/email/in-person services, SARINA must clearly tell the farmer that submission happens outside SARINA and must not imply that an official application has been filed.

User experience:
1. Farmer describes the need in plain language or chooses a guided service category.
2. SARINA matches the request against the verified service/authority registry and jurisdiction.
3. SARINA explains why the selected authority is responsible, what it can/cannot do, eligibility and documents.
4. Farmer reviews the destination and explicitly consents to share the selected data.
5. SARINA creates a trackable request and routes it only through the configured official channel.
6. Farmer sees the receipt/reference, timeline, required next action and official response when available.
7. If jurisdiction is unclear or multiple agencies share responsibility, SARINA asks a minimal clarification or refers to the primary authority with a transparent explanation; it must not invent authority.

## Runtime verification — 2026-11-16

- Supabase migration history confirms migrations `028` through `031` are applied.
- The four operational tables currently contain zero records: `organizations`, `organization_services`, `institutional_service_requests`, and `institutional_request_events`. The directory is therefore not yet populated for real farmer use.
- RLS policies are present for the organization directory, farmer request creation/reading, and organization-scoped request/timeline reading.
- The GitHub repository currently has no frontend source or Supabase client code; the README is only a project title/description. A usable UI cannot be truthfully claimed until application source is added.

### RPC privilege hardening applied and verified

- Revoked direct execution of `log_institutional_request_submission()` from `PUBLIC`, `anon`, and `authenticated`. The database trigger continues to invoke it automatically.
- Revoked `anon`/public execution of `organization_update_institutional_request(...)`; explicitly granted execution to `authenticated` only. The function's internal organization capability/scope checks remain in force.
- Changed both functions' search path to `pg_catalog` because their application objects are explicitly schema-qualified.
- Verified with `has_function_privilege`: anonymous execution is false for both functions; authenticated execution is false for the trigger function and true for the authorized request-update RPC.

### Outstanding security finding

Supabase Security Advisors still reports `public.spatial_ref_sys` with RLS disabled. It was not changed automatically because enabling RLS without a deliberate read policy can break spatial reference lookups. Review and decide its read-only policy before changing it. The advisors also report other pre-existing SECURITY DEFINER RPCs and 19 RLS-enabled tables with no policies; these require a separate targeted review rather than blanket grants or blanket policies.


## Organization self-service onboarding and review

- The explicit global `organization` role starts a private organization workspace; it does not grant access to any verified organization, marketplace, or institutional data by itself.
- Organization profile drafts are stored in `organization_profiles` and can be resumed before formal submission.
- Legal documents use a private `organization-documents` storage bucket, user-scoped paths, MIME/size limits, and server-side object validation.
- A central administrator must review the application. Approval provisions the organization and its initial membership; only approved organizations with active membership and scoped capabilities can use gated marketplace and institutional features.
- Organization ratings and reviews are separate from application verification and use authenticated farmer identity checks.
- Self-selected `expert` and `organization` roles are requests for the relevant workspace, not professional verification or organization approval. Those gates remain server-side.

The connected Supabase project already contains these organization schema migrations. This change restores the matching migration source files to GitHub; it does not reapply them to the live database.
