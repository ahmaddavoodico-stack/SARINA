-- SARINA Farm Productivity Intelligence: baselines, measurements, verified benchmarks and improvement plans.
begin;

create table if not exists public.farm_productivity_metric_definitions (
  metric_code text primary key,
  metric_family text not null check (metric_family in ('production','resource_efficiency','economics','soil','sustainability')),
  label_fa text not null,
  label_en text not null,
  default_unit text not null,
  description_fa text,
  is_core boolean not null default false,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.farm_productivity_metric_definitions
(metric_code,metric_family,label_fa,label_en,default_unit,description_fa,is_core,sort_order)
values
('marketable_yield','production','عملکرد محصول قابل فروش','Marketable yield','kg/ha','مقدار محصول قابل فروش در واحد سطح و دوره مشخص',true,10),
('water_applied','resource_efficiency','آب مصرف‌شده','Water applied','m3/ha','حجم آب مصرف‌شده در واحد سطح و دوره مشخص',true,20),
('input_cost','economics','هزینه نهاده‌ها','Input cost','local_currency/ha','هزینه نهاده‌ها در واحد سطح؛ کد ارز را در توضیح ثبت کنید',true,30),
('gross_revenue','economics','درآمد ناخالص','Gross revenue','local_currency/ha','درآمد ناخالص محصول در واحد سطح و دوره مشخص',false,40),
('soil_ec','soil','هدایت الکتریکی خاک','Soil electrical conductivity','dS/m','مقدار EC همراه با عمق نمونه‌برداری و تاریخ آزمایش',false,50),
('soil_organic_matter','soil','ماده آلی خاک','Soil organic matter','%','درصد ماده آلی بر اساس آزمایش خاک',false,60),
('marketable_loss_rate','production','نرخ ضایعات محصول','Marketable loss rate','%','درصد محصول از دست‌رفته یا غیرقابل فروش',false,70),
('labor_hours','economics','ساعت کار نیروی انسانی','Labor hours','hours/ha','ساعات نیروی انسانی مصرف‌شده در واحد سطح',false,80)
on conflict (metric_code) do update set
 metric_family=excluded.metric_family,label_fa=excluded.label_fa,label_en=excluded.label_en,
 default_unit=excluded.default_unit,description_fa=excluded.description_fa,
 is_core=excluded.is_core,sort_order=excluded.sort_order,is_active=true;

create table if not exists public.farm_productivity_measurements (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  field_id uuid references public.farm_fields(id) on delete set null,
  crop_cycle_id uuid references public.crop_cycles(id) on delete set null,
  metric_code text not null references public.farm_productivity_metric_definitions(metric_code),
  observed_at timestamptz not null default now(),
  period_start date,
  period_end date,
  metric_value numeric not null check (metric_value >= 0),
  unit_code text not null,
  source_type text not null default 'farmer_reported'
    check (source_type in ('farmer_reported','measured','laboratory','official','remote_estimate','modelled','inferred')),
  confidence_score numeric(4,3) check (confidence_score is null or confidence_score between 0 and 1),
  quality_label text not null default 'unknown'
    check (quality_label in ('high','medium','low','unknown')),
  notes text,
  evidence_refs jsonb not null default '[]'::jsonb,
  reported_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (period_start is null or period_end is null or period_end >= period_start)
);

create index if not exists farm_productivity_measurements_farm_metric_date_idx
 on public.farm_productivity_measurements(farm_id,metric_code,observed_at desc);
create index if not exists farm_productivity_measurements_field_idx
 on public.farm_productivity_measurements(field_id) where field_id is not null;

create table if not exists public.farm_productivity_baselines (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  field_id uuid references public.farm_fields(id) on delete set null,
  crop_cycle_id uuid references public.crop_cycles(id) on delete set null,
  baseline_date date not null default current_date,
  period_start date,
  period_end date,
  status text not null default 'draft' check (status in ('draft','confirmed','superseded')),
  completeness_percent smallint not null default 0 check (completeness_percent between 0 and 100),
  missing_metric_codes text[] not null default '{}',
  metrics_snapshot jsonb not null default '{}'::jsonb,
  methodology_version text not null default '1.0',
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (period_start is null or period_end is null or period_end >= period_start)
);
create index if not exists farm_productivity_baselines_farm_date_idx
 on public.farm_productivity_baselines(farm_id,baseline_date desc);

create table if not exists public.farm_productivity_benchmarks (
  id uuid primary key default gen_random_uuid(),
  metric_code text not null references public.farm_productivity_metric_definitions(metric_code),
  crop_code text,
  variety_code text,
  production_system text,
  country_code char(2),
  region_code text,
  climate_zone text,
  soil_texture text,
  irrigation_type text,
  statistic_type text not null check (statistic_type in ('mean','median','p10','p25','p75','p90','range')),
  metric_value numeric not null check (metric_value >= 0),
  unit_code text not null,
  period_start date,
  period_end date,
  sample_size integer check (sample_size is null or sample_size > 0),
  source_name text not null,
  source_url text,
  source_license text,
  geographic_resolution text,
  uncertainty jsonb not null default '{}'::jsonb,
  quality_label text not null default 'unknown' check (quality_label in ('high','medium','low','unknown')),
  status text not null default 'draft' check (status in ('draft','verified','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_start is null or period_end is null or period_end >= period_start),
  check (status <> 'published' or (source_url is not null and source_license is not null and sample_size is not null))
);
create index if not exists farm_productivity_benchmarks_lookup_idx
 on public.farm_productivity_benchmarks(metric_code,country_code,region_code,crop_code,status);

create table if not exists public.farm_improvement_plans (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  field_id uuid references public.farm_fields(id) on delete set null,
  baseline_id uuid references public.farm_productivity_baselines(id) on delete set null,
  title text not null,
  description text,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'draft' check (status in ('draft','active','paused','completed','cancelled')),
  origin text not null default 'farmer' check (origin in ('farmer','sarina','expert')),
  target_metrics jsonb not null default '[]'::jsonb,
  requires_expert_review boolean not null default false,
  start_date date,
  target_date date,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date is null or target_date is null or target_date >= start_date)
);
create index if not exists farm_improvement_plans_farm_status_idx
 on public.farm_improvement_plans(farm_id,status,created_at desc);

create table if not exists public.farm_improvement_actions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.farm_improvement_plans(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  status text not null default 'planned' check (status in ('planned','in_progress','completed','skipped')),
  completed_at timestamptz,
  actual_cost numeric check (actual_cost is null or actual_cost >= 0),
  currency_code char(3),
  outcome_notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists farm_improvement_actions_plan_idx
 on public.farm_improvement_actions(plan_id,status,due_date);

alter table public.farm_productivity_metric_definitions enable row level security;
alter table public.farm_productivity_measurements enable row level security;
alter table public.farm_productivity_baselines enable row level security;
alter table public.farm_productivity_benchmarks enable row level security;
alter table public.farm_improvement_plans enable row level security;
alter table public.farm_improvement_actions enable row level security;

drop policy if exists productivity_metric_definitions_read on public.farm_productivity_metric_definitions;
create policy productivity_metric_definitions_read on public.farm_productivity_metric_definitions
 for select to authenticated using (is_active);

drop policy if exists productivity_benchmarks_read_published on public.farm_productivity_benchmarks;
create policy productivity_benchmarks_read_published on public.farm_productivity_benchmarks
 for select to authenticated using (status = 'published');

-- Farm-owned records inherit the verified owner mapping from farms -> users.auth_user_id.
drop policy if exists productivity_measurements_owner_select on public.farm_productivity_measurements;
create policy productivity_measurements_owner_select on public.farm_productivity_measurements
 for select to authenticated using (exists (
   select 1 from public.farms f join public.users u on u.id=f.owner_user_id
   where f.id=farm_productivity_measurements.farm_id and u.auth_user_id=(select auth.uid())
 ));
drop policy if exists productivity_measurements_owner_insert on public.farm_productivity_measurements;
create policy productivity_measurements_owner_insert on public.farm_productivity_measurements
 for insert to authenticated with check (exists (
   select 1 from public.farms f join public.users u on u.id=f.owner_user_id
   where f.id=farm_productivity_measurements.farm_id and u.auth_user_id=(select auth.uid())
 ));
drop policy if exists productivity_measurements_owner_update on public.farm_productivity_measurements;
create policy productivity_measurements_owner_update on public.farm_productivity_measurements
 for update to authenticated
 using (exists (select 1 from public.farms f join public.users u on u.id=f.owner_user_id where f.id=farm_productivity_measurements.farm_id and u.auth_user_id=(select auth.uid())))
 with check (exists (select 1 from public.farms f join public.users u on u.id=f.owner_user_id where f.id=farm_productivity_measurements.farm_id and u.auth_user_id=(select auth.uid())));
drop policy if exists productivity_measurements_owner_delete on public.farm_productivity_measurements;
create policy productivity_measurements_owner_delete on public.farm_productivity_measurements
 for delete to authenticated using (exists (
   select 1 from public.farms f join public.users u on u.id=f.owner_user_id
   where f.id=farm_productivity_measurements.farm_id and u.auth_user_id=(select auth.uid())
 ));

drop policy if exists productivity_baselines_owner_all on public.farm_productivity_baselines;
create policy productivity_baselines_owner_all on public.farm_productivity_baselines
 for all to authenticated
 using (exists (select 1 from public.farms f join public.users u on u.id=f.owner_user_id where f.id=farm_productivity_baselines.farm_id and u.auth_user_id=(select auth.uid())))
 with check (exists (select 1 from public.farms f join public.users u on u.id=f.owner_user_id where f.id=farm_productivity_baselines.farm_id and u.auth_user_id=(select auth.uid())));

drop policy if exists improvement_plans_owner_all on public.farm_improvement_plans;
create policy improvement_plans_owner_all on public.farm_improvement_plans
 for all to authenticated
 using (exists (select 1 from public.farms f join public.users u on u.id=f.owner_user_id where f.id=farm_improvement_plans.farm_id and u.auth_user_id=(select auth.uid())))
 with check (exists (select 1 from public.farms f join public.users u on u.id=f.owner_user_id where f.id=farm_improvement_plans.farm_id and u.auth_user_id=(select auth.uid())));

drop policy if exists improvement_actions_owner_all on public.farm_improvement_actions;
create policy improvement_actions_owner_all on public.farm_improvement_actions
 for all to authenticated
 using (exists (
   select 1 from public.farm_improvement_plans p
   join public.farms f on f.id=p.farm_id
   join public.users u on u.id=f.owner_user_id
   where p.id=farm_improvement_actions.plan_id and u.auth_user_id=(select auth.uid())
 ))
 with check (exists (
   select 1 from public.farm_improvement_plans p
   join public.farms f on f.id=p.farm_id
   join public.users u on u.id=f.owner_user_id
   where p.id=farm_improvement_actions.plan_id and u.auth_user_id=(select auth.uid())
 ));

grant select on public.farm_productivity_metric_definitions to authenticated;
grant select,insert,update,delete on public.farm_productivity_measurements to authenticated;
grant select,insert,update,delete on public.farm_productivity_baselines to authenticated;
grant select on public.farm_productivity_benchmarks to authenticated;
grant select,insert,update,delete on public.farm_improvement_plans to authenticated;
grant select,insert,update,delete on public.farm_improvement_actions to authenticated;

comment on table public.farm_productivity_measurements is 'Dated farm productivity observations with explicit source, unit, quality and confidence.';
comment on table public.farm_productivity_baselines is 'Versioned farm baseline snapshots; missing metrics remain explicitly missing.';
comment on table public.farm_productivity_benchmarks is 'Curated regional benchmarks; only traceable, licensed published rows are visible to farmers.';
comment on table public.farm_improvement_plans is 'Farmer-owned improvement plans linked to farm baselines and measurable targets.';
comment on table public.farm_improvement_actions is 'Trackable actions belonging to an owner-scoped farm improvement plan.';

commit;