alter table public.expert_impact_signals add column if not exists assessment_id uuid references public.expert_impact_assessments(id) on delete set null;
create unique index if not exists expert_impact_signals_assessment_uidx on public.expert_impact_signals (assessment_id) where assessment_id is not null;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.notify_expert_after_impact_assessment()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_record public.expert_impact_records%rowtype;
begin
  if new.attribution_confidence not in ('medium','high','verified') or new.assessed_by is null or new.assessed_at is null then return new; end if;
  select * into v_record from public.expert_impact_records where id=new.impact_record_id and status='submitted';
  if not found then return new; end if;
  insert into public.expert_impact_signals (expert_profile_id,impact_record_id,assessment_id,title,message,evidence_summary,attribution_confidence)
  values (
    v_record.expert_profile_id,v_record.id,new.id,
    'SARINA پیشرفت مرتبط با راهکار شما را شناسایی کرد',
    'بررسی مستند پرونده نشان می‌دهد نتیجه‌ای قابل‌اندازه‌گیری در ارتباط با راهکار ثبت‌شده شما ارزیابی شده است. لطفاً شواهد و سهم سایر عوامل را مرور کنید و در صورت تمایل، درخواست ثبت دستاورد حرفه‌ای ارائه دهید.',
    jsonb_build_object('baseline_metrics',v_record.baseline_metrics,'outcome_metrics',v_record.outcome_metrics,'technical_score',new.technical_score,'economic_score',new.economic_score,'innovation_score',new.innovation_score,'sustainability_score',new.sustainability_score,'confounding_factors',new.confounding_factors,'reviewer_notes',new.reviewer_notes,'assessment_version',new.assessment_version),
    new.attribution_confidence
  ) on conflict (assessment_id) where assessment_id is not null do nothing;
  return new;
end; $$;
revoke all on function private.notify_expert_after_impact_assessment() from public, anon, authenticated;
drop trigger if exists expert_impact_assessment_notify_expert on public.expert_impact_assessments;
create trigger expert_impact_assessment_notify_expert after insert or update of attribution_confidence,assessed_by,assessed_at,reviewer_notes on public.expert_impact_assessments for each row execute function private.notify_expert_after_impact_assessment();
comment on function private.notify_expert_after_impact_assessment() is 'Creates a SARINA inbox signal after a submitted expert impact record receives a completed medium-or-higher attribution assessment.';
