create or replace function public.validate_farm_productivity_scope()
returns trigger
language plpgsql
set search_path = 'public'
as $function$
declare
  related_farm_id uuid;
  actor_id uuid;
begin
  if to_jsonb(new)->>'field_id' is not null then
    select farm_id into related_farm_id
    from public.farm_fields
    where id=(to_jsonb(new)->>'field_id')::uuid;
    if related_farm_id is null or related_farm_id <> (to_jsonb(new)->>'farm_id')::uuid then
      raise exception 'The selected field must belong to the same farm.';
    end if;
  end if;

  if to_jsonb(new)->>'crop_cycle_id' is not null then
    select farm_id into related_farm_id
    from public.crop_cycles
    where id=(to_jsonb(new)->>'crop_cycle_id')::uuid;
    if related_farm_id is null or related_farm_id <> (to_jsonb(new)->>'farm_id')::uuid then
      raise exception 'The selected crop cycle must belong to the same farm.';
    end if;
  end if;

  if tg_table_name='farm_improvement_plans' and to_jsonb(new)->>'baseline_id' is not null then
    select farm_id into related_farm_id
    from public.farm_productivity_baselines
    where id=(to_jsonb(new)->>'baseline_id')::uuid;
    if related_farm_id is null or related_farm_id <> (to_jsonb(new)->>'farm_id')::uuid then
      raise exception 'The selected baseline must belong to the same farm.';
    end if;
  end if;

  -- Preserve the original author when an authorized farmer or expert updates
  -- an existing plan/action. RLS remains the authorization boundary for UPDATE.
  if tg_op = 'UPDATE'
     and (to_jsonb(new)->>'created_by') is not distinct from (to_jsonb(old)->>'created_by') then
    actor_id := null;
  else
    actor_id := coalesce(
      nullif(to_jsonb(new)->>'created_by','')::uuid,
      nullif(to_jsonb(new)->>'reported_by','')::uuid
    );
  end if;

  if actor_id is not null and not exists (
    select 1 from public.users u
    where u.id=actor_id and u.auth_user_id=(select auth.uid())
  ) then
    raise exception 'The recorded actor must match the authenticated user.';
  end if;

  return new;
end;
$function$;
