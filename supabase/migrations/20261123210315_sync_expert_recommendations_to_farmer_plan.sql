-- Keep each explicitly approved specialist recommendation in the farmer's improvement plan.
alter table public.farm_improvement_actions
  add column if not exists source_recommendation_action_id uuid
  references public.expert_recommendation_actions(id) on delete cascade;

create unique index if not exists farm_improvement_actions_source_recommendation_uidx
  on public.farm_improvement_actions(source_recommendation_action_id)
  where source_recommendation_action_id is not null;

create or replace function public.sync_expert_recommendation_to_farm_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.expert_requests%rowtype;
  v_plan_id uuid;
  v_action_status text;
begin
  if tg_op = 'UPDATE' then
    v_action_status := case new.status
      when 'approved' then 'planned'
      when 'in_progress' then 'in_progress'
      when 'completed' then 'completed'
      when 'needs_review' then 'in_progress'
      else null
    end;

    if v_action_status is not null then
      update public.farm_improvement_actions
      set status = v_action_status,
          due_date = new.due_on,
          outcome_notes = coalesce(nullif(new.farmer_note, ''), outcome_notes),
          completed_at = case when v_action_status = 'completed' then coalesce(completed_at, new.completed_at, now()) else null end,
          updated_at = now()
      where source_recommendation_action_id = new.id;
    end if;
    return new;
  end if;

  select * into v_request
  from public.expert_requests
  where id = new.request_id;

  if not found or v_request.farm_id is distinct from new.farm_id then
    raise exception 'The recommendation must reference the farm attached to its case.';
  end if;

  if not exists (
    select 1
    from public.expert_request_assignments a
    join public.expert_profiles ep on ep.id = a.expert_profile_id
    where a.request_id = new.request_id
      and a.expert_profile_id = new.expert_profile_id
      and a.assignment_status = 'accepted'
      and ep.user_id = new.author_user_id
      and ep.verification_status = 'verified'
  ) then
    raise exception 'Only the verified specialist assigned to this case can publish its recommendation.';
  end if;

  insert into public.farm_improvement_plans (
    farm_id, field_id, title, description, priority, status, origin,
    target_metrics, requires_expert_review, created_by,
    source_request_id, source_consultation_id
  ) values (
    new.farm_id, v_request.field_id,
    'برنامه اجرایی توصیه‌های متخصص: ' || coalesce(nullif(v_request.subject, ''), 'پرونده مشاوره'),
    'اقدام‌های این برنامه از توصیه‌های صریحاً تأییدشده متخصص پرونده ایجاد می‌شوند.',
    new.priority, 'active', 'expert', '[]'::jsonb, false, new.author_user_id,
    new.request_id, new.consultation_id
  )
  on conflict (source_request_id) do nothing;

  select id into v_plan_id
  from public.farm_improvement_plans
  where source_request_id = new.request_id
    and farm_id = new.farm_id
  for update;

  if v_plan_id is null then
    raise exception 'The specialist improvement plan could not be linked to this case.';
  end if;

  v_action_status := case new.status
    when 'approved' then 'planned'
    when 'in_progress' then 'in_progress'
    when 'completed' then 'completed'
    else 'planned'
  end;

  insert into public.farm_improvement_actions (
    plan_id, title, description, due_date, status, created_by,
    source_recommendation_action_id, completed_at
  ) values (
    v_plan_id, new.title, new.instructions, new.due_on, v_action_status,
    new.author_user_id, new.id,
    case when v_action_status = 'completed' then coalesce(new.completed_at, now()) else null end
  )
  on conflict (source_recommendation_action_id)
  where source_recommendation_action_id is not null
  do nothing;

  insert into public.expert_case_notifications (
    recipient_user_id, actor_user_id, request_id, consultation_id, event_type, preview
  )
  values (
    v_request.requester_user_id, new.author_user_id, new.request_id, new.consultation_id,
    'expert_recommendation_approved',
    left('متخصص پرونده یک توصیه تخصصی را تأیید و به برنامه مزرعه شما اضافه کرد: ' || new.title, 240)
  );

  return new;
end;
$$;

revoke all on function public.sync_expert_recommendation_to_farm_plan() from public, anon, authenticated;

drop trigger if exists sync_expert_recommendation_to_farm_plan_after_write
  on public.expert_recommendation_actions;

create trigger sync_expert_recommendation_to_farm_plan_after_write
after insert or update of status, title, instructions, due_on, farmer_note, completed_at
on public.expert_recommendation_actions
for each row execute function public.sync_expert_recommendation_to_farm_plan();
