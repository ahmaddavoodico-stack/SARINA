create table if not exists public.organization_profiles (
  id uuid primary key default gen_random_uuid(),
  applicant_user_id uuid not null unique references public.users(id) on delete cascade,
  profile_data jsonb not null default '{}'::jsonb,
  completion_percent smallint not null default 0 check (completion_percent between 0 and 100),
  status text not null default 'draft' check (status in ('draft','ready_for_review','under_review','needs_correction','verified','suspended')),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organization_applications
  add column if not exists contact_phones text[] not null default '{}',
  add column if not exists social_links jsonb not null default '[]'::jsonb,
  add column if not exists office_locations jsonb not null default '[]'::jsonb,
  add column if not exists legal_documents jsonb not null default '[]'::jsonb,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.organization_profiles enable row level security;
revoke all on table public.organization_profiles from anon, authenticated;
grant select, insert, update, delete on table public.organization_profiles to service_role;

create index if not exists organization_profiles_status_updated_idx
  on public.organization_profiles(status, updated_at desc);

comment on table public.organization_profiles is
  'Private editable organization onboarding drafts. Access is only through the authenticated organization-registration Edge Function.';
comment on column public.organization_applications.social_links is
  'Optional public social and promotional URLs supplied by the organization; no financial details.';
comment on column public.organization_applications.office_locations is
  'Organization office and branch locations; may include map coordinates.';
comment on column public.organization_applications.legal_documents is
  'Document metadata and secure Storage object references; never store document bytes or financial information here.';
