-- Preliminary, evidence-aware productivity evaluation engine.
begin;
create table if not exists public.farm_productivity_metric_evaluation_rules (
 metric_code text primary key references public.farm_productivity_metric_definitions(metric_code) on delete cascade,
 preferred_direction text not null check (preferred_direction in ('higher','lower')),
 evaluation_enabled boolean not null default false,
 rationale text not null,
 updated_at timestamptz not null default now()
);
insert into public.farm_productivity_metric_evaluation_rules(metric_code,preferred_direction,evaluation_enabled,rationale) values
('marketable_yield','higher',true,'عملکرد قابل فروش در واحد سطح؛ فقط در همان مزرعه، واحد و چرخه/محدوده قابل تطبیق.'),
('gross_revenue','higher',true,'درآمد ناخالص در واحد سطح؛ به‌تنهایی سود خالص یا اثر علّی را اثبات نمی‌کند.'),
('soil_organic_matter','higher',true,'روند ماده آلی خاک؛ فقط با روش و واحد یکسان و شواهد قابل قبول.'),
('marketable_loss_rate','lower',true,'کاهش نرخ ضایعات؛ فقط با تعریف و روش اندازه‌گیری یکسان.')
on conflict(metric_code) do update set preferred_direction=excluded.preferred_direction,rationale=excluded.rationale,updated_at=now();

create table if not exists public.farm_productivity_candidate_signals (
 id uuid primary key default gen_random_uuid(),
 farm_id uuid not null references public.farms(id) on delete cascade,
 baseline_id uuid not null references public.farm_productivity_baselines(id) on delete cascade,
 signal_type text not null check(signal_type in ('positive','negative','mixed','insufficient_evidence')),
 comparable_metric_count integer not null default 0 check(comparable_metric_count>=0),
 positive_metric_count integer not null default 0 check(positive_metric_count>=0),
 negative_metric_count integer not null default 0 check(negative_metric_count>=0),
 evidence_summary jsonb not null default '{}'::jsonb,
 methodology_version text not null default '1.0',
 review_status text not null default 'pending_review' check(review_status in ('pending_review','converted_to_review','dismissed')),
 evaluated_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(baseline_id)
);
create index if not exists farm_productivity_candidate_queue_idx on public.farm_productivity_candidate_signals(review_status,signal_type,evaluated_at desc);
create index if not exists farm_productivity_candidate_farm_idx on public.farm_productivity_candidate_signals(farm_id,evaluated_at desc);
alter table public.farm_productivity_metric_evaluation_rules enable row level security;
alter table public.farm_productivity_candidate_signals enable row level security;
drop policy if exists productivity_metric_rules_admin_read on public.farm_productivity_metric_evaluation_rules;
create policy productivity_metric_rules_admin_read on public.farm_productivity_metric_evaluation_rules for select to authenticated using((select public.is_sarina_admin()));
drop policy if exists productivity_candidate_admin_all on public.farm_productivity_candidate_signals;
create policy productivity_candidate_admin_all on public.farm_productivity_candidate_signals for all to authenticated using((select public.is_sarina_admin())) with check((select public.is_sarina_admin()));
grant select on public.farm_productivity_metric_evaluation_rules to authenticated;
grant select,insert,update,delete on public.farm_productivity_candidate_signals to authenticated;

create or replace function public.run_farm_productivity_evaluation(p_farm_id uuid default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare
 b record; rule_row record; base_json jsonb; latest_row record;
 base_value numeric; delta_value numeric; delta_pct numeric;
 positive_count integer; negative_count integer; comparable_count integer;
 evidence jsonb; signal text; processed integer:=0; pending integer:=0;
begin
 if not coalesce(public.is_sarina_admin(),false) then
  raise exception 'Administrator access required' using errcode='42501';
 end if;
 for b in select id,farm_id,field_id,crop_cycle_id,baseline_date,completeness_percent,metrics_snapshot
          from public.farm_productivity_baselines
          where status='confirmed' and (p_farm_id is null or farm_id=p_farm_id)
          order by baseline_date desc
 loop
  positive_count:=0; negative_count:=0; comparable_count:=0; evidence:='[]'::jsonb;
  for rule_row in select metric_code,preferred_direction from public.farm_productivity_metric_evaluation_rules where evaluation_enabled order by metric_code
  loop
   base_json:=b.metrics_snapshot->rule_row.metric_code;
   if base_json is null or base_json='null'::jsonb or nullif(base_json->>'value','') is null then continue; end if;
   begin base_value:=(base_json->>'value')::numeric; exception when others then continue; end;
   select m.id,m.metric_value,m.unit_code,m.observed_at,m.source_type,m.quality_label,m.confidence_score
    into latest_row
   from public.farm_productivity_measurements m
   where m.farm_id=b.farm_id and m.metric_code=rule_row.metric_code
    and m.unit_code=base_json->>'unit'
    and m.observed_at>coalesce(nullif(base_json->>'observed_at','')::timestamptz,b.baseline_date::timestamptz)
    and m.field_id is not distinct from b.field_id
    and m.crop_cycle_id is not distinct from b.crop_cycle_id
    and m.quality_label in ('high','medium')
    and (m.confidence_score is null or m.confidence_score>=0.60)
   order by m.observed_at desc limit 1;
   if not found then continue; end if;
   delta_value:=latest_row.metric_value-base_value;
   delta_pct:=case when base_value=0 then null else (delta_value/abs(base_value))*100 end;
   comparable_count:=comparable_count+1;
   if (rule_row.preferred_direction='higher' and delta_value>0) or (rule_row.preferred_direction='lower' and delta_value<0) then
    positive_count:=positive_count+1;
   elsif (rule_row.preferred_direction='higher' and delta_value<0) or (rule_row.preferred_direction='lower' and delta_value>0) then
    negative_count:=negative_count+1;
   end if;
   evidence:=evidence||jsonb_build_array(jsonb_build_object(
    'metric_code',rule_row.metric_code,'baseline_value',base_value,'current_value',latest_row.metric_value,
    'unit',latest_row.unit_code,'delta',delta_value,'delta_percent',delta_pct,
    'preferred_direction',rule_row.preferred_direction,'measurement_id',latest_row.id,
    'observed_at',latest_row.observed_at,'source_type',latest_row.source_type,
    'quality_label',latest_row.quality_label,'confidence_score',latest_row.confidence_score));
  end loop;
  if comparable_count=0 then signal:='insufficient_evidence';
  elsif positive_count>0 and negative_count=0 then signal:='positive';
  elsif negative_count>0 and positive_count=0 then signal:='negative';
  elsif positive_count>0 and negative_count>0 then signal:='mixed';
  else signal:='insufficient_evidence'; end if;
  insert into public.farm_productivity_candidate_signals
   (farm_id,baseline_id,signal_type,comparable_metric_count,positive_metric_count,negative_metric_count,evidence_summary,methodology_version,evaluated_at)
  values(b.farm_id,b.id,signal,comparable_count,positive_count,negative_count,
   jsonb_build_object('metrics',evidence,'baseline_completeness_percent',b.completeness_percent,
    'scope',jsonb_build_object('field_id',b.field_id,'crop_cycle_id',b.crop_cycle_id),
    'limitations',jsonb_build_array(
     'جهت تغییر شاخص به‌تنهایی اثبات‌کننده اثر علّی مداخله نیست.',
     'فقط شاخص‌های هم‌واحد، هم‌مزرعه، هم‌محدوده و با کیفیت متوسط یا بالا مقایسه شده‌اند.',
     'عوامل فصل، آب‌وهوا، شدت نهاده و سایر عوامل مخدوش‌کننده هنوز تعدیل نشده‌اند.',
     'این خروجی نشانه اولیه است و طبقه‌بندی نهایی نیازمند بازبینی انسانی است.'
    )),'1.0',now())
  on conflict(baseline_id) do update set
   signal_type=excluded.signal_type,comparable_metric_count=excluded.comparable_metric_count,
   positive_metric_count=excluded.positive_metric_count,negative_metric_count=excluded.negative_metric_count,
   evidence_summary=excluded.evidence_summary,methodology_version=excluded.methodology_version,
   evaluated_at=now(),updated_at=now()
  where farm_productivity_candidate_signals.review_status='pending_review';
  processed:=processed+1;
 end loop;
 select count(*) into pending from public.farm_productivity_candidate_signals
 where review_status='pending_review' and (p_farm_id is null or farm_id=p_farm_id);
 return jsonb_build_object('baselines_evaluated',processed,'pending_candidates',pending,
  'methodology_version','1.0','final_classification_created',false,'causal_attribution_created',false);
end; $$;
revoke all on function public.run_farm_productivity_evaluation(uuid) from public,anon;
grant execute on function public.run_farm_productivity_evaluation(uuid) to authenticated;
comment on table public.farm_productivity_metric_evaluation_rules is 'Explicit metric direction rules for preliminary non-causal productivity signals.';
comment on table public.farm_productivity_candidate_signals is 'Machine-generated preliminary signals; never a final farm outcome classification.';
comment on function public.run_farm_productivity_evaluation(uuid) is 'Admin-only preliminary evaluation of compatible baseline/follow-up measurements. Human review is required.';
commit;