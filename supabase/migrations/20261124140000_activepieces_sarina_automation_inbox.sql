-- Activepieces -> SARINA authenticated automation inbox.
-- The table is intentionally inaccessible to browser roles; only the Edge Function's
-- service-role client can enqueue events after HMAC verification.

create table if not exists public.activepieces_automation_inbox (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null check (
    event_type in (
      'store.market.research.requested',
      'store.market.research.completed',
      'store.daily.summary.requested'
    )
  ),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_code text,
  constraint activepieces_event_id_length check (char_length(event_id) between 1 and 128)
);

create index if not exists activepieces_automation_inbox_queue_idx
  on public.activepieces_automation_inbox (status, received_at)
  where status = 'queued';

alter table public.activepieces_automation_inbox enable row level security;

revoke all on table public.activepieces_automation_inbox from anon, authenticated;
grant all on table public.activepieces_automation_inbox to service_role;

comment on table public.activepieces_automation_inbox is
  'Server-to-server automation inbox. Events are authenticated by the activepieces-sarina-bridge Edge Function before insertion.';
