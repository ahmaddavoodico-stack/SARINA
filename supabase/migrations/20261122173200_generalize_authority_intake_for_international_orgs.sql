alter table public.authority_onboarding_requests add column if not exists country_name text not null default 'ایران';
alter table public.authority_onboarding_requests drop constraint if exists authority_onboarding_requests_organization_type_check;
alter table public.authority_onboarding_requests add constraint authority_onboarding_requests_organization_type_check
 check (organization_type in ('government','regulator','support_agency','public_institution','international_organization','research_institution','nonprofit'));
-- Reviewer decisions must use the guarded RPC, not direct table updates.
revoke update on public.authority_onboarding_requests from authenticated;
