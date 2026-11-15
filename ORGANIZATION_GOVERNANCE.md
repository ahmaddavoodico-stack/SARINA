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
