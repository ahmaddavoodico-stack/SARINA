-- Enforce same-farm references and actor identity for productivity records.
create or replace function public.validate_farm_productivity_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  related_farm_id uuid;
  actor_id uuid;
begin
  if to_jsonb(new)->>'field_id' is not null then
    select farm_id into related_farm_id from public.farm_fields where id=(to_jsonb(new)->>'field_id')::uuid;
    if related_farm_id is null or related_farm_id <> (to_jsonb(new)->>'farm_id')::uuid then
      raise exception 'The selected field must belong to the same farm.';
    end if;
  end if;

  if to_jsonb(new)->>'crop_cycle_id' is not null then
    select farm_id into related_farm_id from public.crop_cycles where id=(to_jsonb(new)->>'crop_cycle_id')::uuid;
    if related_farm_id is null or related_farm_id <> (to_jsonb(new)->>'farm_id')::uuid then
      raise exception 'The selected crop cycle must belong to the same farm.';
    end if;
  end if;

  if tg_table_name='farm_improvement_plans' and to_jsonb(new)->>'baseline_id' is not null then
    select farm_id into related_farm_id from public.farm_productivity_baselines where id=(to_jsonb(new)->>'baseline_id')::uuid;
    if related_farm_id is null or related_farm_id <> (to_jsonb(new)->>'farm_id')::uuid then
      raise exception 'The selected baseline must belong to the same farm.';
    end if;
  end if;

  actor_id := coalesce(
    nullif(to_jsonb(new)->>'created_by','')::uuid,
    nullif(to_jsonb(new)->>'reported_by','')::uuid
  );
  if actor_id is not null and not exists (
    select 1 from public.users u where u.id=actor_id and u.auth_user_id=(select auth.uid())
  ) then
    raise exception 'The recorded actor must match the authenticated user.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_productivity_measurement_scope on public.farm_productivity_measurements;
create trigger validate_productivity_measurement_scope
before insert or update on public.farm_productivity_measurements
for each row execute function public.validate_farm_productivity_scope();

drop trigger if exists validate_productivity_baseline_scope on public.farm_productivity_baselines;
create trigger validate_productivity_baseline_scope
before insert or update on public.farm_productivity_baselines
for each row execute function public.validate_farm_productivity_scope();

drop trigger if exists validate_improvement_plan_scope on public.farm_improvement_plans;
create trigger validate_improvement_plan_scope
before insert or update on public.farm_improvement_plans
for each row execute function public.validate_farm_productivity_scope();

drop trigger if exists validate_improvement_action_actor on public.farm_improvement_actions;
create trigger validate_improvement_action_actor
before insert or update on public.farm_improvement_actions
for each row execute function public.validate_farm_productivity_scope();