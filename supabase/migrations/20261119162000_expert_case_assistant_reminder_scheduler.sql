-- Schedule hourly checks with a 24-hour per-case reminder throttle and escalation.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
alter table public.expert_case_assistant_cases
  add column if not exists last_reminded_at timestamptz,
  add column if not exists reminder_count integer not null default 0,
  add column if not exists escalated_at timestamptz;
create or replace function private.notify_stale_expert_case_assistants()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_case record; v_processed integer := 0;
begin
  for v_case in
    select ac.id,ac.request_id,ac.reminder_count,ep.user_id as expert_user_id
    from public.expert_case_assistant_cases ac
    join public.expert_requests er on er.id=ac.request_id
    join public.expert_profiles ep on ep.id=er.assigned_expert_profile_id
    where ac.assistant_status in ('received','initial_review','awaiting_expert')
      and er.status in ('submitted','assigned','in_progress')
      and ep.verification_status='verified'
      and coalesce(ac.last_reminded_at,ac.received_at)<=now()-interval '24 hours'
      and (ac.reminder_count<3 or ac.escalated_at is null)
    order by ac.received_at asc limit 100 for update of ac skip locked
  loop
    if v_case.reminder_count<3 then
      insert into public.expert_case_notifications(recipient_user_id,actor_user_id,request_id,event_type,preview)
      values(v_case.expert_user_id,null,v_case.request_id,'case_assistant_reminder',
        'یادآوری SARINA: پرونده‌ای در انتظار بررسی اولیه یا اقدام شماست. لطفاً وضعیت آن را به‌روزرسانی کنید.');
      update public.expert_case_assistant_cases
        set reminder_count=reminder_count+1,last_reminded_at=now(),updated_at=now() where id=v_case.id;
    else
      insert into public.expert_case_notifications(recipient_user_id,actor_user_id,request_id,event_type,preview)
      select ur.user_id,null,v_case.request_id,'case_assistant_escalation',
        'پرونده مشاوره بیش از سه یادآوری بدون بررسی تخصصی باقی مانده و نیازمند پیگیری مدیریتی است.'
      from public.user_roles ur join public.roles r on r.id=ur.role_id
      where r.code='admin' and ur.scope_type='global' and ur.scope_id is null;
      update public.expert_case_assistant_cases
        set escalated_at=now(),last_reminded_at=now(),updated_at=now() where id=v_case.id;
    end if;
    v_processed:=v_processed+1;
  end loop;
  return v_processed;
end; $$;
revoke all on function private.notify_stale_expert_case_assistants() from public,anon,authenticated;
do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname='expert-case-assistant-reminders' limit 1;
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule('expert-case-assistant-reminders','0 * * * *','select private.notify_stale_expert_case_assistants();');
end; $$;
