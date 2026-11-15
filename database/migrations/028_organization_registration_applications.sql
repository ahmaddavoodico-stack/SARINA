-- SARINA | Migration 028: organization and agricultural support applications
-- Submitted applications remain private and pending until reviewed by an authorized administrator.
-- Direct browser access is intentionally denied; the authenticated Edge Function is the only application gateway.

create table if not exists public.organization_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_user_id uuid not null references public.users(id) on delete cascade,
  legal_name varchar(200) not null,
  display_name varchar(160) not null,
  organization_type varchar(40) not null check (organization_type in (
    'government','company','cooperative','laboratory','bank','insurer',
    'research','university','ngo','support_association','professional_association',
    'foundation','charity','supplier','buyer','other'
  )),
  registration_number varchar(120),
  country_id uuid references public.countries(id),
  country_name varchar(120),
  city varchar(120),
  address text,
  website_url text,
  contact_email varchar(254),
  contact_phone varchar(32),
  description text,
  support_areas text[] not null default '{}',
  service_regions text[] not null default '{}',
  status varchar(24) not null default 'pending'
    check (status in ('pending','under_review','approved','rejected','withdrawn')),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organization_applications_applicant_created_idx
  on public.organization_applications (applicant_user_id, created_at desc);
create index if not exists organization_applications_status_created_idx
  on public.organization_applications (status, created_at desc);

alter table public.organization_applications enable row level security;
revoke all on table public.organization_applications from anon, authenticated;
grant all on table public.organization_applications to service_role;
