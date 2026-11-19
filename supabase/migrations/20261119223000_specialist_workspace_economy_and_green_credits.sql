begin;

create table if not exists public.specialist_workspace_pricing (
  id smallint primary key default 1 check (id = 1),
  currency_code char(3) not null default 'USD',
  workspace_monthly_fee numeric(20,6) not null default 0 check (workspace_monthly_fee >= 0),
  included_monthly_credits integer not null default 0 check (included_monthly_credits >= 0),
  credit_unit_price numeric(20,6) not null default 0 check (credit_unit_price >= 0),
  ai_price_per_1k_tokens numeric(20,6) not null default 0 check (ai_price_per_1k_tokens >= 0),
  reward_multiplier numeric(8,3) not null default 1 check (reward_multiplier >= 0),
  grace_period_days integer not null default 0 check (grace_period_days between 0 and 365),
  overage_enabled boolean not null default false,
  billing_enabled boolean not null default false,
  reward_review_required boolean not null default true,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.specialist_workspace_pricing(id) values (1) on conflict (id) do nothing;

create table if not exists public.specialist_workspace_subscriptions (
  id uuid primary key default gen_random_uuid(),
  expert_profile_id uuid not null unique references public.expert_profiles(id) on delete cascade,
  plan_code text not null default 'professional',
  status text not null default 'trial'
    check (status in ('trial','active','past_due','suspended','cancelled','expired')),
  billing_status text not null default 'not_configured'
    check (billing_status in ('not_configured','pending','paid','failed','waived')),
  starts_at timestamptz not null default now(),
  current_period_start timestamptz,
  current_period_end timestamptz,
  next_billing_at timestamptz,
  external_customer_ref text,
  external_subscription_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_end is null or current_period_start is null or current_period_end > current_period_start)
);
create index if not exists specialist_workspace_subscriptions_status_idx
  on public.specialist_workspace_subscriptions(status, next_billing_at);

create table if not exists public.specialist_workspace_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  expert_profile_id uuid not null references public.expert_profiles(id) on delete cascade,
  delta_units integer not null check (delta_units <> 0),
  entry_type text not null check (entry_type in ('allowance','usage','product_reward','purchase','adjustment','reversal','expiry')),
  source_event_id uuid,
  idempotency_key text not null unique,
  description_code text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (entry_type <> 'usage' or delta_units < 0),
  unique(source_event_id)
);
create index if not exists specialist_workspace_credit_ledger_expert_created_idx
  on public.specialist_workspace_credit_ledger(expert_profile_id, created_at desc);

create table if not exists public.specialist_productivity_reward_rules (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  credit_units integer not null check (credit_units > 0),
  minimum_measurements integer not null default 1 check (minimum_measurements > 0),
  requires_expert_review boolean not null default true,
  is_active boolean not null default true,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  rule_notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_until > valid_from)
);
create unique index if not exists specialist_productivity_reward_rules_active_product_idx
  on public.specialist_productivity_reward_rules(product_id) where is_active;

create table if not exists public.specialist_productivity_reward_events (
  id uuid primary key default gen_random_uuid(),
  expert_profile_id uuid not null references public.expert_profiles(id) on delete cascade,
  farm_id uuid not null references public.farms(id) on delete cascade,
  product_id uuid not null references public.marketplace_products(id) on delete restrict,
  improvement_action_id uuid references public.farm_improvement_actions(id) on delete set null,
  measurement_id uuid references public.farm_productivity_measurements(id) on delete set null,
  evidence_summary jsonb not null default '{}'::jsonb,
  requested_credit_units integer not null check (requested_credit_units > 0),
  awarded_credit_units integer check (awarded_credit_units is null or awarded_credit_units > 0),
  status text not null default 'pending'
    check (status in ('pending','approved','credited','declined','cancelled')),
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'credited' or awarded_credit_units is not null)
);
create unique index if not exists specialist_productivity_reward_event_action_product_idx
  on public.specialist_productivity_reward_events(expert_profile_id, farm_id, product_id, improvement_action_id)
  where improvement_action_id is not null and status <> 'cancelled';
create index if not exists specialist_productivity_reward_events_expert_status_idx
  on public.specialist_productivity_reward_events(expert_profile_id, status, created_at desc);

alter table public.specialist_workspace_pricing enable row level security;
alter table public.specialist_workspace_subscriptions enable row level security;
alter table public.specialist_workspace_credit_ledger enable row level security;
alter table public.specialist_productivity_reward_rules enable row level security;
alter table public.specialist_productivity_reward_events enable row level security;

create policy specialist_workspace_pricing_read on public.specialist_workspace_pricing
 for select to authenticated using (billing_enabled or (select private.is_sarina_admin()));
create policy specialist_workspace_pricing_admin_update on public.specialist_workspace_pricing
 for update to authenticated using ((select private.is_sarina_admin()))
 with check ((select private.is_sarina_admin()));

create policy specialist_workspace_subscriptions_owner_read on public.specialist_workspace_subscriptions
 for select to authenticated using (
   exists (select 1 from public.expert_profiles ep
     where ep.id = specialist_workspace_subscriptions.expert_profile_id
       and ep.user_id = (select public.current_sarina_user_id()))
   or (select private.is_sarina_admin())
 );

create policy specialist_workspace_credit_ledger_owner_read on public.specialist_workspace_credit_ledger
 for select to authenticated using (
   exists (select 1 from public.expert_profiles ep
     where ep.id = specialist_workspace_credit_ledger.expert_profile_id
       and ep.user_id = (select public.current_sarina_user_id()))
   or (select private.is_sarina_admin())
 );

create policy specialist_productivity_reward_rules_read on public.specialist_productivity_reward_rules
 for select to authenticated using (is_active or (select private.is_sarina_admin()));
create policy specialist_productivity_reward_rules_admin_all on public.specialist_productivity_reward_rules
 for all to authenticated using ((select private.is_sarina_admin()))
 with check ((select private.is_sarina_admin()));

create policy specialist_productivity_reward_events_owner_read on public.specialist_productivity_reward_events
 for select to authenticated using (
   exists (select 1 from public.expert_profiles ep
     where ep.id = specialist_productivity_reward_events.expert_profile_id
       and ep.user_id = (select public.current_sarina_user_id()))
   or (select private.is_sarina_admin())
 );
create policy specialist_productivity_reward_events_expert_insert on public.specialist_productivity_reward_events
 for insert to authenticated with check (
   status = 'pending'
   and reviewed_by is null
   and exists (select 1 from public.expert_profiles ep
     where ep.id = specialist_productivity_reward_events.expert_profile_id
       and ep.user_id = (select public.current_sarina_user_id())
       and ep.verification_status = 'verified')
   and public.is_current_user_active_expert_for_farm(farm_id)
   and exists (select 1 from public.specialist_productivity_reward_rules r
     where r.product_id = specialist_productivity_reward_events.product_id
       and r.is_active and now() >= r.valid_from
       and (r.valid_until is null or now() < r.valid_until)
       and r.credit_units = specialist_productivity_reward_events.requested_credit_units)
 );

create or replace function public.review_specialist_productivity_reward(
  p_reward_event_id uuid,
  p_approve boolean,
  p_review_note text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.specialist_productivity_reward_events%rowtype;
  v_admin_user_id uuid;
  v_ledger_id uuid;
begin
  if not (select private.is_sarina_admin()) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  select id into v_admin_user_id from public.users
   where auth_user_id = (select auth.uid()) limit 1;
  select * into v_event from public.specialist_productivity_reward_events
   where id = p_reward_event_id for update;
  if not found then raise exception 'reward_event_not_found'; end if;
  if v_event.status <> 'pending' then raise exception 'reward_event_already_reviewed'; end if;
  if p_approve then
    insert into public.specialist_workspace_credit_ledger(
      expert_profile_id, delta_units, entry_type, source_event_id,
      idempotency_key, description_code, metadata
    ) values (
      v_event.expert_profile_id,
      v_event.requested_credit_units,
      'product_reward',
      v_event.id,
      'specialist-product-reward:' || v_event.id::text,
      'premium_product_productivity_reward',
      jsonb_build_object('farm_id',v_event.farm_id,'product_id',v_event.product_id,'improvement_action_id',v_event.improvement_action_id,'measurement_id',v_event.measurement_id)
    ) returning id into v_ledger_id;
    update public.specialist_productivity_reward_events
       set status='credited', awarded_credit_units=v_event.requested_credit_units,
           reviewed_by=v_admin_user_id, reviewed_at=now(), review_note=p_review_note, updated_at=now()
     where id=v_event.id;
  else
    update public.specialist_productivity_reward_events
       set status='declined', reviewed_by=v_admin_user_id,
           reviewed_at=now(), review_note=p_review_note, updated_at=now()
     where id=v_event.id;
  end if;
  return v_event.id;
end;
$$;
revoke all on function public.review_specialist_productivity_reward(uuid,boolean,text) from public, anon;
grant execute on function public.review_specialist_productivity_reward(uuid,boolean,text) to authenticated;

revoke all on public.specialist_workspace_pricing,
  public.specialist_workspace_subscriptions,
  public.specialist_workspace_credit_ledger,
  public.specialist_productivity_reward_rules,
  public.specialist_productivity_reward_events from anon;
revoke insert, update, delete, truncate, references, trigger on
  public.specialist_workspace_subscriptions,
  public.specialist_workspace_credit_ledger from authenticated;
grant select on public.specialist_workspace_pricing,
  public.specialist_workspace_subscriptions,
  public.specialist_workspace_credit_ledger,
  public.specialist_productivity_reward_rules,
  public.specialist_productivity_reward_events to authenticated;
grant update on public.specialist_workspace_pricing to authenticated;
grant insert, update, delete on public.specialist_productivity_reward_rules to authenticated;
grant insert on public.specialist_productivity_reward_events to authenticated;
grant execute on function public.review_specialist_productivity_reward(uuid,boolean,text) to authenticated;
grant all on public.specialist_workspace_pricing,
  public.specialist_workspace_subscriptions,
  public.specialist_workspace_credit_ledger,
  public.specialist_productivity_reward_rules,
  public.specialist_productivity_reward_events to service_role;

comment on table public.specialist_workspace_pricing is
 'Admin-adjustable specialist workspace pricing and credit policy. Billing remains disabled until a payment provider is configured.';
comment on table public.specialist_workspace_credit_ledger is
 'Append-only specialist credit ledger. Positive entries include allowances and verified premium-product rewards; usage entries are negative.';
comment on table public.specialist_productivity_reward_events is
 'Auditable requests to reward specialists for evidence-backed use of SARINA premium products in farm productivity plans. Rewards require admin approval.';

commit;