-- Persistent, auditable operational signals for SCI agent adapters.
-- This migration does not enable specialist dispatch or start a worker.

create table if not exists public.sci_agent_runtime (
  agent_instance_id text primary key check (char_length(agent_instance_id) between 3 and 120),
  adapter_id text not null check (char_length(adapter_id) between 2 and 80),
  specialist_role text not null check (char_length(specialist_role) between 3 and 120),
  lifecycle_state text not null default 'enabled'
    check (lifecycle_state in ('registered','enabled','paused','disabled','deprecated')),
  dispatch_enabled boolean not null default false,
  last_heartbeat_at timestamptz,
  last_capability_check_at timestamptz,
  capability_check_ok boolean,
  capabilities text[] not null default '{}',
  active_task_count integer not null default 0 check (active_task_count >= 0),
  capacity integer check (capacity is null or capacity >= 1),
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_code text,
  runtime_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(runtime_metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sci_agent_runtime_heartbeat_idx
  on public.sci_agent_runtime (last_heartbeat_at desc);

create table if not exists public.sci_agent_health_events (
  id bigint generated always as identity primary key,
  agent_instance_id text not null references public.sci_agent_runtime(agent_instance_id) on delete restrict,
  event_type text not null check (event_type in ('heartbeat','capability_check','task_succeeded','task_failed','status_changed')),
  health text not null check (health in ('healthy','degraded','unavailable','unknown')),
  runtime_state text not null check (runtime_state in ('ready','busy','responding','degraded','offline','unknown','paused','disabled','deprecated')),
  reason_code text not null,
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  occurred_at timestamptz not null default now()
);
create index if not exists sci_agent_health_events_agent_time_idx
  on public.sci_agent_health_events (agent_instance_id, occurred_at desc);

create table if not exists public.sci_external_missions (
  id uuid primary key default gen_random_uuid(),
  external_task_id text not null unique check (char_length(external_task_id) between 3 and 160),
  external_task_url text not null check (external_task_url like 'https://%'),
  title text not null,
  adapter_id text not null,
  specialist_role text not null,
  domain text not null,
  status text not null default 'awaiting_report'
    check (status in ('submitted_external','awaiting_report','draft_received','owner_review','accepted','rejected','failed')),
  draft_id uuid references public.sarina_manus_market_research_drafts(id) on delete set null,
  linked_by_auth_user_id uuid references auth.users(id) on delete set null,
  external_started_at timestamptz,
  report_received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sci_external_missions_status_idx
  on public.sci_external_missions (status, created_at desc);

alter table public.sarina_manus_market_research_drafts
  add column if not exists external_mission_id uuid
  references public.sci_external_missions(id) on delete set null;

create index if not exists sarina_manus_drafts_external_mission_idx
  on public.sarina_manus_market_research_drafts (external_mission_id);

alter table public.sci_agent_runtime enable row level security;
alter table public.sci_agent_health_events enable row level security;
alter table public.sci_external_missions enable row level security;
revoke all on public.sci_agent_runtime, public.sci_agent_health_events, public.sci_external_missions from public, anon, authenticated;
grant select, insert, update on public.sci_agent_runtime to service_role;
grant select, insert on public.sci_agent_health_events to service_role;
grant select, insert, update on public.sci_external_missions to service_role;
grant usage, select on sequence public.sci_agent_health_events_id_seq to service_role;
grant select, update on public.sarina_manus_market_research_drafts to service_role;

comment on table public.sci_agent_runtime is
  'Private runtime telemetry for SCI execution adapters. No provider credentials are stored.';
comment on table public.sci_agent_health_events is
  'Append-only evidence log for SCI agent health and runtime transitions.';
comment on table public.sci_external_missions is
  'Links external agent missions to SCI and private research drafts without inventing farmer or farm ownership.';

insert into public.sci_external_missions (
  external_task_id, external_task_url, title, adapter_id, specialist_role, domain,
  status, external_started_at
) values (
  'Eii9EWz735xAwtbPSDNrBh',
  'https://manus.im/app/Eii9EWz735xAwtbPSDNrBh',
  'Assess Khuzestan Dates Export Readiness for the UAE',
  'manus',
  'market_intelligence_specialist',
  'market_intelligence',
  'awaiting_report',
  null
)
on conflict (external_task_id) do nothing;
