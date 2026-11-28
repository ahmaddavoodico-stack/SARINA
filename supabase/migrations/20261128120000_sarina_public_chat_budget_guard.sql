-- SARINA public conversation hard-budget guard.
-- The $10 USD platform-wide monthly ceiling is a hard stop, not a warning.
-- Model rates are versioned against Groq's published GPT-OSS 20B pricing.
begin;

create table public.sarina_ai_budget_policy (
  singleton boolean primary key default true check (singleton),
  monthly_budget_usd numeric(20,8) not null check (monthly_budget_usd > 0),
  provider_code varchar(40) not null,
  model_code varchar(160) not null,
  input_usd_per_million numeric(20,10) not null check (input_usd_per_million >= 0),
  output_usd_per_million numeric(20,10) not null check (output_usd_per_million >= 0),
  max_input_tokens integer not null check (max_input_tokens > 0),
  max_output_tokens integer not null check (max_output_tokens > 0),
  is_enabled boolean not null default false,
  hard_limit_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.sarina_ai_budget_policy (
  singleton, monthly_budget_usd, provider_code, model_code,
  input_usd_per_million, output_usd_per_million,
  max_input_tokens, max_output_tokens, is_enabled, hard_limit_enabled
) values (
  true, 10.00, 'groq', 'openai/gpt-oss-20b',
  0.075, 0.30, 6000, 500, true, true
)
on conflict (singleton) do update set
  monthly_budget_usd = excluded.monthly_budget_usd,
  provider_code = excluded.provider_code,
  model_code = excluded.model_code,
  input_usd_per_million = excluded.input_usd_per_million,
  output_usd_per_million = excluded.output_usd_per_million,
  max_input_tokens = excluded.max_input_tokens,
  max_output_tokens = excluded.max_output_tokens,
  is_enabled = excluded.is_enabled,
  hard_limit_enabled = excluded.hard_limit_enabled,
  updated_at = now();

create table public.sarina_ai_budget_reservations (
  request_id uuid primary key,
  user_id uuid not null references public.users(id) on delete restrict,
  month_start date not null,
  reserved_usd numeric(20,10) not null check (reserved_usd > 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index sarina_ai_budget_reservations_month_idx
  on public.sarina_ai_budget_reservations(month_start, expires_at);

-- Persistent attempt ledger keeps per-user throttling effective even when
-- provider calls fail and their temporary budget reservations are released.
create table public.sarina_ai_chat_requests (
  request_id uuid primary key,
  user_id uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index sarina_ai_chat_requests_user_created_idx
  on public.sarina_ai_chat_requests(user_id, created_at desc);
alter table public.sarina_ai_chat_requests enable row level security;
revoke all on public.sarina_ai_chat_requests from anon, authenticated;
grant all on public.sarina_ai_chat_requests to service_role;

alter table public.sarina_ai_budget_policy enable row level security;
alter table public.sarina_ai_budget_reservations enable row level security;
revoke all on public.sarina_ai_budget_policy, public.sarina_ai_budget_reservations from anon, authenticated;
grant select on public.sarina_ai_budget_policy to authenticated;
create policy sarina_ai_budget_policy_admin_read on public.sarina_ai_budget_policy
  for select to authenticated using ((select private.is_sarina_admin()));
grant all on public.sarina_ai_budget_policy, public.sarina_ai_budget_reservations to service_role;

create or replace function public.sarina_reserve_public_chat_budget(
  p_request_id uuid,
  p_user_id uuid
) returns table(allowed boolean, code text, reserved_amount numeric)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_policy public.sarina_ai_budget_policy%rowtype;
  v_month date := date_trunc('month', now())::date;
  v_spent numeric(20,10);
  v_reserved numeric(20,10);
  v_request_count bigint;
  v_reserve numeric(20,10);
begin
  perform pg_advisory_xact_lock(hashtext('sarina-ai-platform-monthly-budget'));
  select * into v_policy from public.sarina_ai_budget_policy where singleton = true;
  if not found or not v_policy.is_enabled or not v_policy.hard_limit_enabled then
    return query select false, 'BUDGET_POLICY_DISABLED'::text, 0::numeric; return;
  end if;

  delete from public.sarina_ai_budget_reservations
    where expires_at < now();

  select coalesce(sum(provider_cost_amount), 0) into v_spent
    from public.ai_usage_events
    where created_at >= v_month and created_at < (v_month + interval '1 month')
      and provider_cost_currency = 'USD'
      and provider_cost_amount is not null;

  select coalesce(sum(reserved_usd), 0) into v_reserved
    from public.sarina_ai_budget_reservations
    where month_start = v_month and expires_at >= now();

  select count(*) into v_request_count
    from public.sarina_ai_chat_requests
    where user_id = p_user_id and created_at >= now() - interval '1 hour';
  if v_request_count >= 20 then
    return query select false, 'RATE_LIMITED'::text, 0::numeric; return;
  end if;

  v_reserve := (
    v_policy.max_input_tokens * v_policy.input_usd_per_million
    + v_policy.max_output_tokens * v_policy.output_usd_per_million
  ) / 1000000.0;

  if v_spent + v_reserved + v_reserve > v_policy.monthly_budget_usd then
    return query select false, 'BUDGET_EXHAUSTED'::text, 0::numeric; return;
  end if;

  insert into public.sarina_ai_chat_requests(request_id, user_id)
    values (p_request_id, p_user_id);
  insert into public.sarina_ai_budget_reservations(
    request_id, user_id, month_start, reserved_usd, expires_at
  ) values (p_request_id, p_user_id, v_month, v_reserve, now() + interval '2 minutes');

  return query select true, 'RESERVED'::text, v_reserve;
end;
$$;

create or replace function public.sarina_settle_public_chat_budget(
  p_request_id uuid,
  p_input_tokens integer,
  p_output_tokens integer,
  p_latency_ms integer default null
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reservation public.sarina_ai_budget_reservations%rowtype;
  v_policy public.sarina_ai_budget_policy%rowtype;
  v_cost numeric(20,10);
begin
  perform pg_advisory_xact_lock(hashtext('sarina-ai-platform-monthly-budget'));
  if p_input_tokens < 0 or p_output_tokens < 0 then raise exception 'INVALID_TOKEN_USAGE'; end if;
  select * into v_reservation from public.sarina_ai_budget_reservations
    where request_id = p_request_id for update;
  if not found then raise exception 'BUDGET_RESERVATION_NOT_FOUND'; end if;
  select * into v_policy from public.sarina_ai_budget_policy where singleton = true;
  if p_input_tokens > v_policy.max_input_tokens or p_output_tokens > v_policy.max_output_tokens then
    raise exception 'TOKEN_LIMIT_EXCEEDED';
  end if;
  v_cost := (
    p_input_tokens * v_policy.input_usd_per_million
    + p_output_tokens * v_policy.output_usd_per_million
  ) / 1000000.0;
  if v_cost > v_reservation.reserved_usd then raise exception 'RESERVATION_OVERRUN'; end if;

  insert into public.ai_usage_events (
    request_id, user_id, provider_code, model_code, feature_code,
    usage_class, status, input_tokens, output_tokens,
    provider_cost_amount, provider_cost_currency, cost_basis,
    pricing_version, latency_ms, metadata
  ) values (
    p_request_id, v_reservation.user_id, v_policy.provider_code, v_policy.model_code,
    'public_conversation', 'casual_conversation', 'succeeded',
    p_input_tokens, p_output_tokens, v_cost, 'USD', 'actual',
    'groq-gpt-oss-20b-2026-11', p_latency_ms,
    jsonb_build_object('budget_month', v_reservation.month_start, 'budget_guard', 'hard_limit')
  );
  delete from public.sarina_ai_budget_reservations where request_id = p_request_id;
  return true;
end;
$$;

create or replace function public.sarina_release_public_chat_budget(p_request_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.sarina_ai_budget_reservations where request_id = p_request_id;
  select true;
$$;

revoke all on function public.sarina_reserve_public_chat_budget(uuid, uuid) from public, anon, authenticated;
revoke all on function public.sarina_settle_public_chat_budget(uuid, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.sarina_release_public_chat_budget(uuid) from public, anon, authenticated;
grant execute on function public.sarina_reserve_public_chat_budget(uuid, uuid) to service_role;
grant execute on function public.sarina_settle_public_chat_budget(uuid, integer, integer, integer) to service_role;
grant execute on function public.sarina_release_public_chat_budget(uuid) to service_role;

commit;
