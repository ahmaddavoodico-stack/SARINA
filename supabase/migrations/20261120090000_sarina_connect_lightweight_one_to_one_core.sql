-- SARINA Connect: lightweight one-to-one channel routing foundation.
-- Message content remains in expert_consultation_messages; this layer stores routes,
-- consent, delivery state and provider event references only. It does not invoke AI.

begin;

create table if not exists public.sarina_connect_channel_routes (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.expert_consultations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete restrict,
  channel_id uuid not null references public.messaging_channels(id) on delete restrict,
  connection_id uuid references public.messaging_connections(id) on delete set null,
  endpoint_secret_ref text,
  route_status text not null default 'pending_consent'
    check (route_status in ('pending_consent','active','paused','revoked','error')),
  consent_scope jsonb not null default '{}'::jsonb
    check (jsonb_typeof(consent_scope) = 'object'),
  consented_at timestamptz,
  revoked_at timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sarina_connect_route_consent_state check (
    (route_status <> 'active' or (consented_at is not null and connection_id is not null and endpoint_secret_ref is not null))
    and (route_status <> 'revoked' or revoked_at is not null)
  ),
  constraint sarina_connect_route_one_per_channel unique (consultation_id, user_id, channel_id)
);

create index if not exists sarina_connect_routes_user_status_idx
  on public.sarina_connect_channel_routes (user_id, route_status, updated_at desc);
create index if not exists sarina_connect_routes_consultation_idx
  on public.sarina_connect_channel_routes (consultation_id, route_status);

create table if not exists public.sarina_connect_delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.expert_consultation_messages(id) on delete cascade,
  route_id uuid not null references public.sarina_connect_channel_routes(id) on delete restrict,
  idempotency_key text not null unique,
  delivery_status text not null default 'queued'
    check (delivery_status in ('queued','processing','sent','delivered','failed','dead_letter','cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  provider_message_ref text,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sarina_connect_delivery_ready_idx
  on public.sarina_connect_delivery_jobs (available_at, created_at)
  where delivery_status in ('queued','failed');
create index if not exists sarina_connect_delivery_message_idx
  on public.sarina_connect_delivery_jobs (message_id, created_at desc);
create index if not exists sarina_connect_delivery_provider_ref_idx
  on public.sarina_connect_delivery_jobs (provider_message_ref)
  where provider_message_ref is not null;

create table if not exists public.sarina_connect_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider_code text not null,
  provider_event_ref text not null,
  route_id uuid references public.sarina_connect_channel_routes(id) on delete set null,
  message_id uuid references public.expert_consultation_messages(id) on delete set null,
  event_type text not null,
  processing_status text not null default 'received'
    check (processing_status in ('received','processed','ignored','failed')),
  safe_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(safe_metadata) = 'object' and octet_length(safe_metadata::text) <= 8192),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint sarina_connect_provider_event_idempotency unique (provider_code, provider_event_ref)
);

create index if not exists sarina_connect_provider_events_pending_idx
  on public.sarina_connect_provider_events (received_at)
  where processing_status = 'received';

create table if not exists public.sarina_connect_consent_events (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.sarina_connect_channel_routes(id) on delete cascade,
  actor_user_id uuid not null references public.users(id) on delete restrict,
  event_type text not null check (event_type in ('granted','revoked','renewed','scope_changed')),
  consent_scope jsonb not null default '{}'::jsonb
    check (jsonb_typeof(consent_scope) = 'object' and octet_length(consent_scope::text) <= 4096),
  recorded_at timestamptz not null default now()
);

create index if not exists sarina_connect_consent_route_idx
  on public.sarina_connect_consent_events (route_id, recorded_at desc);

alter table public.sarina_connect_channel_routes enable row level security;
alter table public.sarina_connect_delivery_jobs enable row level security;
alter table public.sarina_connect_provider_events enable row level security;
alter table public.sarina_connect_consent_events enable row level security;

-- Provider routes, delivery queues, webhook receipts and consent audit are server-managed.
-- No direct client access prevents endpoint identifiers, delivery internals or provider data
-- from being exposed to other participants or manipulated from a browser.
revoke all on public.sarina_connect_channel_routes from anon, authenticated;
revoke all on public.sarina_connect_delivery_jobs from anon, authenticated;
revoke all on public.sarina_connect_provider_events from anon, authenticated;
revoke all on public.sarina_connect_consent_events from anon, authenticated;

grant all on public.sarina_connect_channel_routes to service_role;
grant all on public.sarina_connect_delivery_jobs to service_role;
grant all on public.sarina_connect_provider_events to service_role;
grant all on public.sarina_connect_consent_events to service_role;

comment on table public.sarina_connect_channel_routes is
  'Server-managed, consent-based one-to-one external channel routes. endpoint_secret_ref points to a secret vault entry; raw phone numbers and provider credentials must not be stored here.';
comment on table public.sarina_connect_delivery_jobs is
  'Lightweight transactional outbox. References existing consultation messages; message content is not duplicated and AI credit is never charged for delivery.';
comment on table public.sarina_connect_provider_events is
  'Idempotent provider webhook/event receipts. Stores only minimal safe metadata; raw provider payloads and message bodies are not retained here.';
comment on table public.sarina_connect_consent_events is
  'Append-only audit of explicit channel consent and revocation, managed by trusted server-side flows.';

commit;
