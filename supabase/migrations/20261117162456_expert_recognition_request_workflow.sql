create table if not exists public.expert_recognition_requests (
  id uuid primary key default gen_random_uuid(),
  expert_profile_id uuid not null references public.expert_profiles(id) on delete cascade,
  signal_id uuid not null references public.expert_impact_signals(id) on delete restrict,
  impact_record_id uuid not null references public.expert_impact_records(id) on delete restrict,
  request_type text not null default 'professional_achievement' check (request_type in ('professional_achievement','certificate')),
  expert_note text,
  status text not null default 'submitted' check (status in ('submitted','under_review','needs_information','approved','declined','issued')),
  submitted_at timestamptz not null default now(),
  reviewed_by_user_id uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  unique (signal_id)
);
create index if not exists expert_recognition_requests_owner_created_idx on public.expert_recognition_requests (expert_profile_id,created_at desc);
alter table public.expert_recognition_requests enable row level security;
revoke all on public.expert_recognition_requests from anon,authenticated;
grant select,insert on public.expert_recognition_requests to authenticated;
create policy expert_recognition_requests_owner_select on public.expert_recognition_requests for select to authenticated
using (exists (select 1 from public.expert_profiles ep where ep.id=expert_recognition_requests.expert_profile_id and ep.user_id=public.current_sarina_user_id()));
create policy expert_recognition_requests_owner_insert on public.expert_recognition_requests for insert to authenticated
with check (status='submitted'
  and exists (select 1 from public.expert_profiles ep where ep.id=expert_recognition_requests.expert_profile_id and ep.user_id=public.current_sarina_user_id())
  and exists (select 1 from public.expert_impact_signals s where s.id=expert_recognition_requests.signal_id and s.expert_profile_id=expert_recognition_requests.expert_profile_id and s.impact_record_id=expert_recognition_requests.impact_record_id)
  and exists (select 1 from public.expert_impact_records ir where ir.id=expert_recognition_requests.impact_record_id and ir.expert_profile_id=expert_recognition_requests.expert_profile_id and ir.status='submitted'));
comment on table public.expert_recognition_requests is 'Expert-initiated request for professional recognition based on a SARINA-generated impact signal; awards are issued separately by authorized parties.';
