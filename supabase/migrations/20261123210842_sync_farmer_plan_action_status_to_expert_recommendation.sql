create or replace function public.sync_farm_plan_action_to_expert_recommendation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if new.source_recommendation_action_id is null
     or new.status is not distinct from old.status then
    return new;
  end if;

  v_status := case new.status
    when 'planned' then 'approved'
    when 'in_progress' then 'in_progress'
    when 'completed' then 'completed'
    when 'skipped' then 'needs_review'
    else null
  end;

  if v_status is not null then
    update public.expert_recommendation_actions
    set status = v_status,
        farmer_note = coalesce(nullif(new.outcome_notes, ''), farmer_note),
        completed_at = case when v_status = 'completed' then coalesce(new.completed_at, completed_at, now()) else null end,
        updated_at = now()
    where id = new.source_recommendation_action_id
      and status is distinct from v_status;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_farm_plan_action_to_expert_recommendation() from public, anon, authenticated;

drop trigger if exists sync_farm_plan_action_status_to_expert_recommendation_after_update
  on public.farm_improvement_actions;

create trigger sync_farm_plan_action_status_to_expert_recommendation_after_update
after update of status on public.farm_improvement_actions
for each row execute function public.sync_farm_plan_action_to_expert_recommendation();
