-- SARINA AI usage, Green Credit and infrastructure-cost controls.
-- Additive foundation only: no allowance values, prices, budgets or routing rules are seeded.
-- This keeps farmer credit policy and provider pricing configurable rather than guessed.

begin;

create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  user_id uuid not null references public.users(id) on delete restrict,
  conversation_id uuid references public.ai_conversations(id) on delete set null,
  farm_id uuid references public.farms(id) on delete set null,
  provider_code varchar(80) not null,
  model_code varchar(160) not null,
  feature_code varchar(100) not null,
  usage_class varchar(32) not null default 'agricultural_assistance'
    check (usage_class in ('agricultural_assistance','casual_conversation','vision','file_analysis','other')),
  status varchar(20) not null
    check (status in ('succeeded','failed','blocked','timeout')),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  cached_input_tokens integer not null default 0
    check (cached_input_tokens >= 0 and cached_input_tokens <= input_tokens),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  reasoning_tokens integer not null default 0 check (reasoning_tokens >= 0),
  tool_calls integer not null default 0 check (tool_calls >= 0),
  image_units numeric(18,6) not null default 0 check (image_units >= 0),
  provider_cost_amount numeric(20,10) check (provider_cost_amount is null or provider_cost_amount >= 0),
  provider_cost_currency char(3) not null default 'USD',
  cost_basis varchar(16) not null default 'unavailable'
    check (cost_basis in ('actual','estimated','unavailable')),
  pricing_version varchar(80),
  farmer_credit_units integer check (farmer_credit_units is null or farmer_credit_units >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (
    (cost_basis = 'unavailable' and provider_cost_amount is null)
    or (cost_basis in ('actual','estimated') and provider_cost_amount is not null)
  )
);

create index ai_usage_events_user_created_idx
  on public.ai_usage_events(user_id, created_at desc);
create index ai_usage_events_feature_created_idx
  on public.ai_usage_events(feature_code, created_at desc);
create index ai_usage_events_model_created_idx
  on public.ai_usage_events(provider_code, model_code, created_at desc);

comment on table public.ai_usage_events is
  'Internal per-request AI usage and provider-cost ledger. Does not store prompts or message bodies.';
comment on column public.ai_usage_events.farmer_credit_units is
  'Farmer-facing credit consumption, kept separate from provider_cost_amount; NULL until the approved credit policy is configured.';

create table public.ai_model_pricing (
  id uuid primary key default gen_random_uuid(),
  provider_code varchar(80) not null,
  model_code varchar(160) not null,
  pricing_version varchar(80) not null,
  currency_code char(3) not null default 'USD',
  input_per_million numeric(20,10) check (input_per_million is null or input_per_million >= 0),
  cached_input_per_million numeric(20,10) check (cached_input_per_million is null or cached_input_per_million >= 0),
  output_per_million numeric(20,10) check (output_per_million is null or output_per_million >= 0),
  image_unit_price numeric(20,10) check (image_unit_price is null or image_unit_price >= 0),
  valid_from timestamptz not null,
  valid_until timestamptz,
  is_active boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique(provider_code, model_code, pricing_version),
  check (valid_until is null or valid_until > valid_from)
);

create index ai_model_pricing_lookup_idx
  on public.ai_model_pricing(provider_code, model_code, valid_from desc)
  where is_active = true;

comment on table public.ai_model_pricing is
  'Versioned provider pricing. No rates are seeded; activate only after verifying the provider tariff and effective date.';

create table public.ai_conversation_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete restrict,
  delta_units integer not null check (delta_units <> 0),
  entry_type varchar(20) not null
    check (entry_type in ('allowance','usage','bonus','adjustment','reversal','expiry')),
  idempotency_key varchar(180) not null unique,
  usage_event_id uuid references public.ai_usage_events(id) on delete set null,
  period_start date,
  period_end date,
  description_code varchar(80),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (period_end is null or period_start is null or period_end >= period_start),
  check (entry_type <> 'usage' or delta_units < 0)
);

create index ai_conversation_credit_ledger_user_created_idx
  on public.ai_conversation_credit_ledger(user_id, created_at desc);
create index ai_conversation_credit_ledger_period_idx
  on public.ai_conversation_credit_ledger(user_id, period_start, period_end);

comment on table public.ai_conversation_credit_ledger is
  'Append-only farmer AI conversation-credit ledger. It is not a service-access entitlement table.';

create table public.sarina_service_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  service_code varchar(120) not null,
  access_status varchar(20) not null default 'active'
    check (access_status in ('active','suspended','expired')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  source_code varchar(80) not null default 'platform',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, service_code),
  check (expires_at is null or expires_at > starts_at)
);

create index sarina_service_entitlements_user_status_idx
  on public.sarina_service_entitlements(user_id, access_status);

comment on table public.sarina_service_entitlements is
  'Non-conversational SARINA service access, stored independently from AI conversation credits. No existing service access is modified by this migration.';

create table public.ai_platform_budgets (
  id uuid primary key default gen_random_uuid(),
  budget_scope varchar(20) not null
    check (budget_scope in ('platform','provider','feature')),
  scope_code varchar(120) not null default 'all',
  budget_month date not null,
  budget_amount numeric(20,6) not null check (budget_amount > 0),
  currency_code char(3) not null default 'USD',
  warning_threshold_percent smallint not null default 80
    check (warning_threshold_percent between 1 and 100),
  hard_limit_enabled boolean not null default false,
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(budget_scope, scope_code, budget_month),
  check (extract(day from budget_month) = 1)
);

create table public.ai_infrastructure_cost_entries (
  id uuid primary key default gen_random_uuid(),
  service_category varchar(32) not null
    check (service_category in ('ai_api','hosting_compute','database','storage','bandwidth_egress',
      'email_sms_notifications','maps_geospatial','monitoring_logging','other')),
  provider_code varchar(120) not null,
  service_code varchar(160) not null,
  amount numeric(20,6) not null check (amount >= 0),
  currency_code char(3) not null,
  cost_basis varchar(16) not null default 'estimated'
    check (cost_basis in ('actual','estimated')),
  period_start date not null,
  period_end date not null,
  source_reference varchar(240),
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create index ai_infrastructure_cost_entries_period_idx
  on public.ai_infrastructure_cost_entries(period_start, period_end, service_category);

create table public.ai_model_routing_rules (
  id uuid primary key default gen_random_uuid(),
  request_class varchar(32) not null unique
    check (request_class in ('simple_low_risk','agricultural_assistance','complex_reasoning',
      'safety_critical','vision','file_analysis','general_conversation')),
  preferred_model_code varchar(160),
  fallback_model_code varchar(160),
  max_input_tokens integer check (max_input_tokens is null or max_input_tokens > 0),
  max_output_tokens integer check (max_output_tokens is null or max_output_tokens > 0),
  allow_fallback boolean not null default true,
  is_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on table public.ai_model_routing_rules is
  'Admin-managed model routing policy. Rules remain disabled until provider credentials, model availability and safety tests are verified.';

-- All new tables are protected. Farmers can read only their own credit ledger and
-- non-chat entitlements; internal provider usage, costs, budgets, prices and routing
-- are visible only to authorized SARINA administrators.
alter table public.ai_usage_events enable row level security;
alter table public.ai_model_pricing enable row level security;
alter table public.ai_conversation_credit_ledger enable row level security;
alter table public.sarina_service_entitlements enable row level security;
alter table public.ai_platform_budgets enable row level security;
alter table public.ai_infrastructure_cost_entries enable row level security;
alter table public.ai_model_routing_rules enable row level security;

create policy ai_usage_events_admin_read
  on public.ai_usage_events for select to authenticated
  using ((select private.is_sarina_admin()));

create policy ai_model_pricing_admin_read
  on public.ai_model_pricing for select to authenticated
  using ((select private.is_sarina_admin()));

create policy ai_conversation_credit_ledger_owner_or_admin_read
  on public.ai_conversation_credit_ledger for select to authenticated
  using (
    user_id = (select u.id from public.users u where u.auth_user_id = (select auth.uid()) limit 1)
    or (select private.is_sarina_admin())
  );

create policy sarina_service_entitlements_owner_or_admin_read
  on public.sarina_service_entitlements for select to authenticated
  using (
    user_id = (select u.id from public.users u where u.auth_user_id = (select auth.uid()) limit 1)
    or (select private.is_sarina_admin())
  );

create policy ai_platform_budgets_admin_read
  on public.ai_platform_budgets for select to authenticated
  using ((select private.is_sarina_admin()));

create policy ai_infrastructure_cost_entries_admin_read
  on public.ai_infrastructure_cost_entries for select to authenticated
  using ((select private.is_sarina_admin()));

create policy ai_model_routing_rules_admin_read
  on public.ai_model_routing_rules for select to authenticated
  using ((select private.is_sarina_admin()));

revoke all on public.ai_usage_events, public.ai_model_pricing,
  public.ai_conversation_credit_ledger, public.sarina_service_entitlements,
  public.ai_platform_budgets, public.ai_infrastructure_cost_entries,
  public.ai_model_routing_rules from anon;

revoke insert, update, delete, truncate, references, trigger on
  public.ai_usage_events, public.ai_model_pricing,
  public.ai_conversation_credit_ledger, public.sarina_service_entitlements,
  public.ai_platform_budgets, public.ai_infrastructure_cost_entries,
  public.ai_model_routing_rules from authenticated;

grant select on public.ai_usage_events, public.ai_model_pricing,
  public.ai_conversation_credit_ledger, public.sarina_service_entitlements,
  public.ai_platform_budgets, public.ai_infrastructure_cost_entries,
  public.ai_model_routing_rules to authenticated;

grant all on public.ai_usage_events, public.ai_model_pricing,
  public.ai_conversation_credit_ledger, public.sarina_service_entitlements,
  public.ai_platform_budgets, public.ai_infrastructure_cost_entries,
  public.ai_model_routing_rules to service_role;

commit;
