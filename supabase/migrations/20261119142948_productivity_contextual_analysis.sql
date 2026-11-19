-- Structured farm context observations and non-causal contextual analysis.
begin;
alter table public.farm_productivity_candidate_signals add column if not exists context_analysis jsonb not null default '{}'::jsonb;
create table if not exists public.farm_productivity_context_observations (
 id uuid primary key default gen_random_uuid(),
 farm_id uuid not null references public.farms(id) on delete cascade,
 field_id uuid,crop_cycle_id uuid,
 factor_code text not null check(factor_code in ('weather_temperature','rainfall','extreme_weather','irrigation_volume','irrigation_method','irrigation_water_ec','fertilizer_n','fertilizer_p','fertilizer_k','pesticide_use','soil_moisture','soil_ec','soil_ph','pest_pressure','disease_pressure','crop_stage','cultivar','action_adherence','labor_hours')),
 numeric_value numeric,text_value text,unit_code text,
 observed_at timestamptz not null default now(),period_start date,period_end date,
 source_type text not null default 'farmer_reported' check(source_type in ('farmer_reported','measured','laboratory','official','remote_estimate','modelled','inferred')),
 quality_label text not null default 'unknown' check(quality_label in ('high','medium','low','unknown')),
 confidence_score numeric check(confidence_score is null or (confidence_score>=0 and confidence_score<=1)),
 notes text,evidence_refs jsonb not null default '[]'::jsonb,recorded_by uuid,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 constraint farm_productivity_context_one_value check((numeric_value is not null and text_value is null) or (numeric_value is null and nullif(btrim(text_value),'') is not null)),
 constraint farm_productivity_context_period check(period_end is null or period_start is null or period_end>=period_start)
);
create index if not exists productivity_context_farm_factor_date_idx on public.farm_productivity_context_observations(farm_id,factor_code,observed_at desc);
create index if not exists productivity_context_scope_date_idx on public.farm_productivity_context_observations(farm_id,field_id,crop_cycle_id,observed_at desc);
alter table public.farm_productivity_context_observations enable row level security;
drop policy if exists productivity_context_owner_select on public.farm_productivity_context_observations;
create policy productivity_context_owner_select on public.farm_productivity_context_observations for select to authenticated using(exists(select 1 from public.farms f join public.users u on u.id=f.owner_user_id where f.id=farm_productivity_context_observations.farm_id and u.auth_user_id=(select auth.uid())));
drop policy if exists productivity_context_owner_insert on public.farm_productivity_context_observations;
create policy productivity_context_owner_insert on public.farm_productivity_context_observations for insert to authenticated with check(exists(select 1 from public.farms f join public.users u on u.id=f.owner_user_id where f.id=farm_productivity_context_observations.farm_id and u.auth_user_id=(select auth.uid())));
drop policy if exists productivity_context_owner_update on public.farm_productivity_context_observations;
create policy productivity_context_owner_update on public.farm_productivity_context_observations for update to authenticated using(exists(select 1 from public.farms f join public.users u on u.id=f.owner_user_id where f.id=farm_productivity_context_observations.farm_id and u.auth_user_id=(select auth.uid()))) with check(exists(select 1 from public.farms f join public.users u on u.id=f.owner_user_id where f.id=farm_productivity_context_observations.farm_id and u.auth_user_id=(select auth.uid())));
drop policy if exists productivity_context_owner_delete on public.farm_productivity_context_observations;
create policy productivity_context_owner_delete on public.farm_productivity_context_observations for delete to authenticated using(exists(select 1 from public.farms f join public.users u on u.id=f.owner_user_id where f.id=farm_productivity_context_observations.farm_id and u.auth_user_id=(select auth.uid())));
grant select,insert,update,delete on public.farm_productivity_context_observations to authenticated;

create or replace function public.run_farm_productivity_context_analysis(p_farm_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c record;b record;factor record;v_end timestamptz;v_factors jsonb;v_actions jsonb;v_observed_domains text[];v_required_domains text[]:=array['climate','water','inputs','soil','crop_health','management'];v_missing_domains text[];v_observation_count integer;v_factor_count integer;v_processed integer:=0;
begin
 if not coalesce(public.is_sarina_admin(),false) then raise exception 'Administrator access required' using errcode='42501'; end if;
 for c in select s.id,s.farm_id,s.baseline_id,s.evidence_summary from public.farm_productivity_candidate_signals s where s.review_status='pending_review' and (p_farm_id is null or s.farm_id=p_farm_id) order by s.evaluated_at desc loop
  select id,farm_id,field_id,crop_cycle_id,baseline_date into b from public.farm_productivity_baselines where id=c.baseline_id;
  if not found then continue; end if;
  select max((item->>'observed_at')::timestamptz) into v_end from jsonb_array_elements(coalesce(c.evidence_summary->'metrics','[]'::jsonb)) item where nullif(item->>'observed_at','') is not null;
  if v_end is null then v_end:=b.baseline_date::timestamptz; end if;
  v_factors:='[]'::jsonb;v_factor_count:=0;v_observation_count:=0;
  for factor in
   select o.factor_code,count(*)::integer observations,count(o.numeric_value)::integer numeric_observations,avg(o.numeric_value) average_value,min(o.numeric_value) minimum_value,max(o.numeric_value) maximum_value,
    jsonb_agg(jsonb_build_object('value',coalesce(o.numeric_value::text,o.text_value),'unit',o.unit_code,'observed_at',o.observed_at,'source_type',o.source_type,'quality_label',o.quality_label,'confidence_score',o.confidence_score,'notes',o.notes) order by o.observed_at) samples,
    case when o.factor_code in ('weather_temperature','rainfall','extreme_weather') then 'climate' when o.factor_code in ('irrigation_volume','irrigation_method','irrigation_water_ec') then 'water' when o.factor_code in ('fertilizer_n','fertilizer_p','fertilizer_k','pesticide_use') then 'inputs' when o.factor_code in ('soil_moisture','soil_ec','soil_ph') then 'soil' when o.factor_code in ('pest_pressure','disease_pressure','crop_stage','cultivar') then 'crop_health' else 'management' end domain
   from public.farm_productivity_context_observations o
   where o.farm_id=b.farm_id and o.field_id is not distinct from b.field_id and o.crop_cycle_id is not distinct from b.crop_cycle_id and o.observed_at>b.baseline_date::timestamptz and o.observed_at<=v_end
   group by o.factor_code order by o.factor_code
  loop
   v_factor_count:=v_factor_count+1;v_observation_count:=v_observation_count+factor.observations;
   v_factors:=v_factors||jsonb_build_array(jsonb_build_object('factor_code',factor.factor_code,'domain',factor.domain,'observation_count',factor.observations,'numeric_observation_count',factor.numeric_observations,'average_value',factor.average_value,'minimum_value',factor.minimum_value,'maximum_value',factor.maximum_value,'samples',factor.samples));
  end loop;
  select coalesce(array_agg(distinct x.domain),'{}'::text[]) into v_observed_domains from (
   select case when factor_code in ('weather_temperature','rainfall','extreme_weather') then 'climate' when factor_code in ('irrigation_volume','irrigation_method','irrigation_water_ec') then 'water' when factor_code in ('fertilizer_n','fertilizer_p','fertilizer_k','pesticide_use') then 'inputs' when factor_code in ('soil_moisture','soil_ec','soil_ph') then 'soil' when factor_code in ('pest_pressure','disease_pressure','crop_stage','cultivar') then 'crop_health' else 'management' end domain
   from public.farm_productivity_context_observations where farm_id=b.farm_id and field_id is not distinct from b.field_id and crop_cycle_id is not distinct from b.crop_cycle_id and observed_at>b.baseline_date::timestamptz and observed_at<=v_end
  ) x;
  select coalesce(array_agg(d),'{}'::text[]) into v_missing_domains from unnest(v_required_domains) d where not(d=any(v_observed_domains));
  select jsonb_build_object('action_count',count(a.id),'completed_count',count(a.id) filter(where a.status='completed'),'in_progress_count',count(a.id) filter(where a.status='in_progress'),'planned_count',count(a.id) filter(where a.status='planned'),'skipped_count',count(a.id) filter(where a.status='skipped'),
   'actual_cost_by_currency',coalesce((select jsonb_agg(jsonb_build_object('currency_code',costs.currency_code,'total',costs.total)) from (select a2.currency_code,sum(a2.actual_cost) total from public.farm_improvement_actions a2 join public.farm_improvement_plans p2 on p2.id=a2.plan_id where p2.farm_id=b.farm_id and p2.baseline_id=b.id and coalesce(a2.completed_at,a2.created_at)<=v_end and coalesce(a2.completed_at,a2.created_at)>b.baseline_date::timestamptz group by a2.currency_code) costs),'[]'::jsonb)) into v_actions
  from public.farm_improvement_actions a join public.farm_improvement_plans p on p.id=a.plan_id
  where p.farm_id=b.farm_id and p.baseline_id=b.id and coalesce(a.completed_at,a.created_at)<=v_end and coalesce(a.completed_at,a.created_at)>b.baseline_date::timestamptz;
  update public.farm_productivity_candidate_signals set context_analysis=jsonb_build_object(
   'analysis_version','1.0','period_start',b.baseline_date,'period_end',v_end,'factor_count',v_factor_count,'observation_count',v_observation_count,
   'observed_domains',to_jsonb(v_observed_domains),'missing_domains',to_jsonb(v_missing_domains),'factors',v_factors,'improvement_actions',v_actions,
   'interpretation','این عوامل در بازه ارزیابی مشاهده شده‌اند؛ هم‌زمانی، رابطه آماری یا علت‌بودن را اثبات نمی‌کند.',
   'limitations',jsonb_build_array('تحلیل فعلی توصیفی و مبتنی بر ثبت‌های هم‌زمان است، نه مدل علّی.','داده ثبت‌نشده به معنی نبود آن عامل نیست.','برای تحلیل اثر آب‌وهوا و فصل به داده تاریخی معتبر و موقعیت مکانی نیاز است.','برای برآورد اثر مداخله به مقایسه چند دوره یا گروه شاهد همسان نیاز است.')
  ),updated_at=now() where id=c.id;
  v_processed:=v_processed+1;
 end loop;
 return jsonb_build_object('candidates_analyzed',v_processed,'analysis_version','1.0','causal_effect_estimated',false,'missing_context_is_not_absence',true);
end; $$;
revoke all on function public.run_farm_productivity_context_analysis(uuid) from public,anon;
grant execute on function public.run_farm_productivity_context_analysis(uuid) to authenticated;
comment on table public.farm_productivity_context_observations is 'Owner-entered or evidenced time-stamped context records for cautious interpretation of productivity changes.';
comment on function public.run_farm_productivity_context_analysis(uuid) is 'Admin-only descriptive contextual analysis. Co-occurrence is not causal attribution.';
commit;