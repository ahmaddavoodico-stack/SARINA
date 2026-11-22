-- Regional autonomy and selective cross-region synchronization.
-- Additive only: no existing ownership is inferred or backfilled.
create table if not exists public.deployment_regions (
  id uuid primary key default gen_random_uuid(),
  region_code text not null unique,
  display_name text not null,
  hosting_country_iso2 char(2),
  region_status text not null default 'planned' check (region_status in ('planned','active','paused','retired')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deployment_regions_code_format check (region_code ~ '^[A-Z][A-Z0-9_]{1,15}$'),
  constraint deployment_regions_country_format check (hosting_country_iso2 is null or hosting_country_iso2 ~ '^[A-Z]{2}$')
);
insert into public.deployment_regions (region_code, display_name, region_status, notes)
values
 ('IR','Iran domestic region','planned','Domestic service region; provider and NIN reachability remain subject to procurement and testing.'),
 ('INTL','International region','planned','Logical international region; hosting country and provider remain subject to legal, latency, residency and reliability review.')
on conflict (region_code) do nothing;

alter table public.users add column if not exists home_region_id uuid references public.deployment_regions(id) on delete restrict;
alter table public.farms add column if not exists home_region_id uuid references public.deployment_regions(id) on delete restrict;
alter table public.expert_consultations add column if not exists home_region_id uuid references public.deployment_regions(id) on delete restrict;

comment on column public.users.home_region_id is 'Authoritative home region. Nullable until assigned from verified onboarding/admin data; never infer from IP alone.';
comment on column public.farms.home_region_id is 'Authoritative region for farm data ownership; normally follows owner region unless an approved transfer is recorded.';
comment on column public.expert_consultations.home_region_id is 'Authoritative region for this consultation case; assign explicitly rather than inferring from the current viewer.';

create index if not exists users_home_region_id_idx on public.users(home_region_id);
create index if not exists farms_home_region_id_idx on public.farms(home_region_id);
create index if not exists expert_consultations_home_region_id_idx on public.expert_consultations(home_region_id);

create table if not exists public.regional_data_transfer_consents (
 id uuid primary key default gen_random_uuid(),
 subject_type text not null check (subject_type in ('user','farm','consultation')),
 subject_id uuid not null,
 consenting_user_id uuid not null references public.users(id) on delete restrict,
 source_region_id uuid not null references public.deployment_regions(id) on delete restrict,
 target_region_id uuid not null references public.deployment_regions(id) on delete restrict,
 purpose_code text not null,
 permitted_categories jsonb not null default '[]'::jsonb check (jsonb_typeof(permitted_categories)='array'),
 consent_text_version text not null,
 consent_status text not null default 'granted' check (consent_status in ('granted','revoked','expired','superseded')),
 granted_at timestamptz not null default now(),
 expires_at timestamptz,
 revoked_at timestamptz,
 created_at timestamptz not null default now(),
 constraint regional_transfer_distinct_regions check (source_region_id <> target_region_id),
 constraint regional_transfer_revocation_consistency check ((consent_status='revoked' and revoked_at is not null) or consent_status<>'revoked')
);
create index if not exists regional_transfer_consent_lookup_idx on public.regional_data_transfer_consents(subject_type,subject_id,source_region_id,target_region_id,consent_status);
create index if not exists regional_transfer_consent_user_idx on public.regional_data_transfer_consents(consenting_user_id,created_at desc);

create table if not exists public.regional_sync_outbox (
 id uuid primary key default gen_random_uuid(),
 source_region_id uuid not null references public.deployment_regions(id) on delete restrict,
 target_region_id uuid not null references public.deployment_regions(id) on delete restrict,
 consent_id uuid not null references public.regional_data_transfer_consents(id) on delete restrict,
 aggregate_type text not null check (aggregate_type in ('user','farm','consultation','reference_data')),
 aggregate_id uuid not null,
 event_type text not null,
 event_version integer not null default 1 check (event_version>0),
 schema_version integer not null default 1 check (schema_version>0),
 idempotency_key text not null unique,
 data_categories jsonb not null default '[]'::jsonb check (jsonb_typeof(data_categories)='array'),
 event_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(event_payload)='object' and octet_length(event_payload::text)<=65536),
 delivery_status text not null default 'queued' check (delivery_status in ('queued','processing','sent','acknowledged','retry','dead_letter','cancelled')),
 attempt_count integer not null default 0 check (attempt_count>=0),
 available_at timestamptz not null default now(),
 locked_at timestamptz,
 sent_at timestamptz,
 acknowledged_at timestamptz,
 last_error_code text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint regional_sync_outbox_distinct_regions check (source_region_id<>target_region_id)
);
create index if not exists regional_sync_outbox_ready_idx on public.regional_sync_outbox(delivery_status,available_at,created_at) where delivery_status in ('queued','retry');
create index if not exists regional_sync_outbox_aggregate_idx on public.regional_sync_outbox(aggregate_type,aggregate_id,created_at desc);

create table if not exists public.regional_sync_inbox (
 id uuid primary key default gen_random_uuid(),
 source_region_id uuid not null references public.deployment_regions(id) on delete restrict,
 target_region_id uuid not null references public.deployment_regions(id) on delete restrict,
 source_event_id uuid not null,
 consent_id uuid not null references public.regional_data_transfer_consents(id) on delete restrict,
 aggregate_type text not null check (aggregate_type in ('user','farm','consultation','reference_data')),
 aggregate_id uuid not null,
 event_type text not null,
 event_version integer not null check (event_version>0),
 schema_version integer not null check (schema_version>0),
 payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
 event_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(event_payload)='object' and octet_length(event_payload::text)<=65536),
 processing_status text not null default 'received' check (processing_status in ('received','validated','applied','conflict','rejected','failed')),
 received_at timestamptz not null default now(),
 processed_at timestamptz,
 error_code text,
 constraint regional_sync_inbox_distinct_regions check (source_region_id<>target_region_id),
 constraint regional_sync_inbox_event_unique unique (source_region_id,source_event_id)
);
create index if not exists regional_sync_inbox_status_idx on public.regional_sync_inbox(processing_status,received_at);
create index if not exists regional_sync_inbox_aggregate_idx on public.regional_sync_inbox(aggregate_type,aggregate_id,event_version desc);

alter table public.deployment_regions enable row level security;
alter table public.regional_data_transfer_consents enable row level security;
alter table public.regional_sync_outbox enable row level security;
alter table public.regional_sync_inbox enable row level security;

revoke all on public.deployment_regions from anon,authenticated;
revoke all on public.regional_data_transfer_consents from anon,authenticated;
revoke all on public.regional_sync_outbox from anon,authenticated;
revoke all on public.regional_sync_inbox from anon,authenticated;
grant all on public.deployment_regions to service_role;
grant all on public.regional_data_transfer_consents to service_role;
grant all on public.regional_sync_outbox to service_role;
grant all on public.regional_sync_inbox to service_role;

drop policy if exists regional_regions_deny_client_access on public.deployment_regions;
create policy regional_regions_deny_client_access on public.deployment_regions for all to anon,authenticated using(false) with check(false);
drop policy if exists regional_transfer_consents_deny_client_access on public.regional_data_transfer_consents;
create policy regional_transfer_consents_deny_client_access on public.regional_data_transfer_consents for all to anon,authenticated using(false) with check(false);
drop policy if exists regional_sync_outbox_deny_client_access on public.regional_sync_outbox;
create policy regional_sync_outbox_deny_client_access on public.regional_sync_outbox for all to anon,authenticated using(false) with check(false);
drop policy if exists regional_sync_inbox_deny_client_access on public.regional_sync_inbox;
create policy regional_sync_inbox_deny_client_access on public.regional_sync_inbox for all to anon,authenticated using(false) with check(false);
