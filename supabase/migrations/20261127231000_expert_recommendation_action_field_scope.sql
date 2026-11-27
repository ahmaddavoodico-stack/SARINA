-- Add an explicit farm-field target to specialist recommendations so actions can be placed on the farmer's map.
alter table public.expert_recommendation_actions
  add column if not exists field_id uuid
  references public.farm_fields(id) on delete set null;

create index if not exists expert_recommendation_actions_field_schedule_idx
  on public.expert_recommendation_actions (farm_id, field_id, due_on);

create or replace function public.validate_expert_recommendation_action_field_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  related_farm_id uuid;
begin
  if new.field_id is null then
    return new;
  end if;

  select f.farm_id
    into related_farm_id
  from public.farm_fields f
  where f.id = new.field_id;

  if related_farm_id is null or related_farm_id <> new.farm_id then
    raise exception 'The selected field must belong to the same farm.';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_expert_recommendation_action_field_scope()
  from public, anon, authenticated;

drop trigger if exists validate_expert_recommendation_action_field_scope_before_write
  on public.expert_recommendation_actions;

create trigger validate_expert_recommendation_action_field_scope_before_write
before insert or update of field_id, farm_id
on public.expert_recommendation_actions
for each row
execute function public.validate_expert_recommendation_action_field_scope();
