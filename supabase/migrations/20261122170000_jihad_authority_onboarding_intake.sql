-- Dedicated, least-privilege intake for public agricultural authorities.
-- Separate from commercial organization_applications, which excludes public authorities.

create table if not exists public.authority_onboarding_requests (
  id uuid primary key default gen_random_uuid(),
  applicant_user_id uuid not null references public.users(id) on delete restrict,
  organization_legal_name text not null,
  organization_display_name text not null,
  organization_type text not null default 'government'
    check (organization_type in ('government','regulator','support_agency','public_institution')),
  registration_or_authority_reference text,
  province_name text not null default 'خوزستان',
  county_name text not null default 'آبادان',
  service_hub_name text not null default 'آبادان',
  requested_service_locations text[] not null default array['آبادان','چوئبده','اروندکنار']::text[],
  mandate_reference text,
  applicant_contact_name text not null,
  applicant_contact_email text,
  applicant_contact_phone text,
  proposed_admin_full_name text not null,
  proposed_admin_email text not null,
  proposed_admin_phone text,
  service_scope_description text not null,
  evidence_document_paths text[] not null default '{}'::text[],
  status text not null default 'pending_verification'
    check (status in ('pending_verification','under_review','needs_correction','approved','rejected','withdrawn')),
  review_notes text,
  reviewed_by_user_id uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint authority_onboarding_nonempty_locations check (cardinality(requested_service_locations) > 0),
  constraint authority_onboarding_evidence_limit check (cardinality(evidence_document_paths) <= 10),
  constraint authority_onboarding_review_pair check (
    (reviewed_by_user_id is null and reviewed_at is null)
    or (reviewed_by_user_id is not null and reviewed_at is not null)
  )
);

create unique index if not exists authority_onboarding_one_active_per_applicant
  on public.authority_onboarding_requests(applicant_user_id)
  where status in ('pending_verification','under_review','approved');

create index if not exists authority_onboarding_status_created_idx
  on public.authority_onboarding_requests(status, created_at desc);

alter table public.authority_onboarding_requests enable row level security;
revoke all on public.authority_onboarding_requests from anon, authenticated;
grant select, insert, update on public.authority_onboarding_requests to authenticated;

drop policy if exists authority_onboarding_applicant_read on public.authority_onboarding_requests;
create policy authority_onboarding_applicant_read
  on public.authority_onboarding_requests for select to authenticated
  using (applicant_user_id = (select public.current_sarina_user_id()) or coalesce(public.is_sarina_admin(), false));

drop policy if exists authority_onboarding_applicant_submit on public.authority_onboarding_requests;
create policy authority_onboarding_applicant_submit
  on public.authority_onboarding_requests for insert to authenticated
  with check (
    applicant_user_id = (select public.current_sarina_user_id())
    and status = 'pending_verification'
    and reviewed_by_user_id is null
    and reviewed_at is null
    and not exists (
      select 1 from unnest(evidence_document_paths) as p(path)
      where p.path !~ ('^' || applicant_user_id::text || '/[A-Za-z0-9._/-]+$')
    )
  );

drop policy if exists authority_onboarding_admin_review on public.authority_onboarding_requests;
create policy authority_onboarding_admin_review
  on public.authority_onboarding_requests for update to authenticated
  using (coalesce(public.is_sarina_admin(), false))
  with check (coalesce(public.is_sarina_admin(), false));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('authority-onboarding-documents','authority-onboarding-documents',false,10485760,
  array['application/pdf','image/jpeg','image/png']::text[])
on conflict (id) do update set public=false,file_size_limit=10485760,
  allowed_mime_types=array['application/pdf','image/jpeg','image/png']::text[];

drop policy if exists authority_onboarding_docs_owner_insert on storage.objects;
create policy authority_onboarding_docs_owner_insert on storage.objects for insert to authenticated
with check (bucket_id='authority-onboarding-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);

drop policy if exists authority_onboarding_docs_owner_or_admin_read on storage.objects;
create policy authority_onboarding_docs_owner_or_admin_read on storage.objects for select to authenticated
using (bucket_id='authority-onboarding-documents' and (
  (storage.foldername(name))[1]=(select auth.uid())::text or coalesce(public.is_sarina_admin(),false)
));

drop policy if exists authority_onboarding_docs_owner_delete on storage.objects;
create policy authority_onboarding_docs_owner_delete on storage.objects for delete to authenticated
using (bucket_id='authority-onboarding-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);

comment on table public.authority_onboarding_requests is
  'Private intake and evidence workflow for government/public agricultural authority tenants; not an approved organization registry.';
comment on column public.authority_onboarding_requests.requested_service_locations is
  'Requested operational service coverage. Abadan, Choebdeh and Arvandkenar are the approved pilot request scope; labels do not assert official administrative codes.';
comment on column public.authority_onboarding_requests.proposed_admin_email is
  'Contact claim for a proposed organization administrator; approval must bind it to an authenticated user before membership provisioning.';
