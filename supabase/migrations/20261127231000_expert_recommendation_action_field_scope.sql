-- Link each specialist recommendation and its farmer-plan mirror to a real field.
alter table public.expert_recommendation_actions
  add column if not exists field_id uuid
  references public.farm_fields(id) on delete set null;

alter table public.farm_improvement_actions
  add column if not exists field_id uuid
  references public.farm_fields(id) on delete set null;

create index if not exists expert_recommendation_actions_field_schedule_idx
  on public.expert_recommendation_actions (farm_id, field_id, due_on);

create index if not exists farm_improvement_actions_field_schedule_idx
  on public.farm_improvement_actions (field_id, due_date);

-- The target field must belong to the farm that owns the recommendation or plan.
create or replace function public.validate_recommendation_field_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  related_farm_id uuid;
  expected_farm_id uuid;
begin
  if new.field_id is null then
    return new;
  end if;

  select f.farm_id
    into related_farm_id
  from public.farm_fields f
  where f.id = new.field_id;

  if tg_table_name = 'expert_recommendation_actions' then
    expected_farm_id := new.farm_id;
  elsif tg_table_name = 'farm_improvement_actions' then
    select p.farm_id
      into expected_farm_id
    from public.farm_improvement_plans p
    where p.id = new.plan_id;
  else
    raise exception 'Unsupported recommendation target table.';
  end if;

  if related_farm_id is null or expected_farm_id is null or related_farm_id <> expected_farm_id then
    raise exception 'The selected field must belong to the same farm.';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_recommendation_field_scope()
  from public, anon, authenticated;

drop trigger if exists validate_expert_recommendation_action_field_scope_before_write
  on public.expert_recommendation_actions;
create trigger validate_expert_recommendation_action_field_scope_before_write
before insert or update of field_id, farm_id
on public.expert_recommendation_actions
for each row execute function public.validate_recommendation_field_scope();

drop trigger if exists validate_farm_improvement_action_field_scope_before_write
  on public.farm_improvement_actions;
create trigger validate_farm_improvement_action_field_scope_before_write
before insert or update of field_id, plan_id
on public.farm_improvement_actions
for each row execute function public.validate_recommendation_field_scope();

-- Preserve the existing bidirectional task lifecycle while copying the target field
-- to the canonical farmer-plan action. Do not create a second task record.
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
          field_id = new.field_id,
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
    new.farm_id, coalesce(new.field_id, v_request.field_id),
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

  update public.farm_improvement_plans
  set field_id = coalesce(field_id, new.field_id)
  where id = v_plan_id
    and new.field_id is not null;

  v_action_status := case new.status
    when 'approved' then 'planned'
    when 'in_progress' then 'in_progress'
    when 'completed' then 'completed'
    else 'planned'
  end;

  insert into public.farm_improvement_actions (
    plan_id, field_id, title, description, due_date, status, created_by,
    source_recommendation_action_id, completed_at
  ) values (
    v_plan_id, new.field_id, new.title, new.instructions, new.due_on, v_action_status,
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

revoke all on function public.sync_expert_recommendation_to_farm_plan()
  from public, anon, authenticated;

drop trigger if exists sync_expert_recommendation_to_farm_plan_after_write
  on public.expert_recommendation_actions;
create trigger sync_expert_recommendation_to_farm_plan_after_write
after insert or update of status, title, instructions, due_on, farmer_note, completed_at, field_id
on public.expert_recommendation_actions
for each row execute function public.sync_expert_recommendation_to_farm_plan();
