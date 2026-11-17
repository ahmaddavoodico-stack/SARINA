create table if not exists public.expert_impact_signals (
  id uuid primary key default gen_random_uuid(),
  expert_profile_id uuid not null references public.expert_profiles(id) on delete cascade,
  impact_record_id uuid references public.expert_impact_records(id) on delete set null,
  title text not null check (length(btrim(title)) between 3 and 180),
  message text not null check (length(btrim(message)) between 10 and 3000),
  evidence_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence_summary) = 'object'),
  attribution_confidence text not null default 'insufficient' check (attribution_confidence in ('insufficient','low','medium','high','verified')),
  signal_status text not null default 'unread' check (signal_status in ('unread','seen','actioned','dismissed')),
  generated_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists expert_impact_signals_owner_created_idx on public.expert_impact_signals (expert_profile_id, created_at desc);
alter table public.expert_impact_signals enable row level security;
revoke all on public.expert_impact_signals from anon, authenticated;
grant select on public.expert_impact_signals to authenticated;
grant update (signal_status, acknowledged_at) on public.expert_impact_signals to authenticated;
create policy expert_impact_signals_owner_select on public.expert_impact_signals for select to authenticated
using (exists (select 1 from public.expert_profiles ep where ep.id=expert_impact_signals.expert_profile_id and ep.user_id=public.current_sarina_user_id()));
create policy expert_impact_signals_owner_acknowledge on public.expert_impact_signals for update to authenticated
using (exists (select 1 from public.expert_profiles ep where ep.id=expert_impact_signals.expert_profile_id and ep.user_id=public.current_sarina_user_id()))
with check (signal_status in ('seen','actioned','dismissed') and exists (select 1 from public.expert_profiles ep where ep.id=expert_impact_signals.expert_profile_id and ep.user_id=public.current_sarina_user_id()));
comment on table public.expert_impact_signals is 'SARINA-generated evidence-based notifications to experts; inserts are reserved for trusted SARINA backend services.';

create table if not exists public.expert_ip_applications (
  id uuid primary key default gen_random_uuid(),
  expert_profile_id uuid not null references public.expert_profiles(id) on delete cascade,
  impact_record_id uuid not null references public.expert_impact_records(id) on delete restrict,
  application_type text not null check (application_type in ('patent','utility_model','industrial_design','copyright','trade_secret','other')),
  title text not null check (length(btrim(title)) between 3 and 180),
  novelty_summary text not null check (length(btrim(novelty_summary)) between 20 and 5000),
  proposed_claims text,
  co_inventors jsonb not null default '[]'::jsonb check (jsonb_typeof(co_inventors) = 'array'),
  evidence_refs text[] not null default array[]::text[],
  legal_jurisdiction text,
  status text not null default 'submitted' check (status in ('submitted','under_review','needs_information','referred_to_ip_authority','approved_for_filing','declined','withdrawn')),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists expert_ip_applications_owner_created_idx on public.expert_ip_applications (expert_profile_id, created_at desc);
alter table public.expert_ip_applications enable row level security;
revoke all on public.expert_ip_applications from anon, authenticated;
grant select, insert on public.expert_ip_applications to authenticated;
create policy expert_ip_applications_owner_select on public.expert_ip_applications for select to authenticated
using (exists (select 1 from public.expert_profiles ep where ep.id=expert_ip_applications.expert_profile_id and ep.user_id=public.current_sarina_user_id()));
create policy expert_ip_applications_owner_insert on public.expert_ip_applications for insert to authenticated
with check (status='submitted'
  and exists (select 1 from public.expert_profiles ep where ep.id=expert_ip_applications.expert_profile_id and ep.user_id=public.current_sarina_user_id())
  and exists (select 1 from public.expert_impact_records ir where ir.id=expert_ip_applications.impact_record_id and ir.expert_profile_id=expert_ip_applications.expert_profile_id and ir.record_kind='innovation' and ir.status='submitted'));
comment on table public.expert_ip_applications is 'Expert requests for review of potential intellectual-property protection; this is not a legal grant of IP rights.';
