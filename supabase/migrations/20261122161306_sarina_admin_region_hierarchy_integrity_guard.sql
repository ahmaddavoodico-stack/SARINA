create or replace function public.validate_agricultural_admin_region_parent()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_parent_level text;
  v_parent_country_id uuid;
  v_parent_namespace text;
  v_cycle boolean;
begin
  if new.parent_region_id is null then
    if new.region_level <> 'national' then
      raise exception 'Only a national administrative region may omit its parent';
    end if;
  else
    select r.region_level, r.country_id, r.authority_namespace
      into v_parent_level, v_parent_country_id, v_parent_namespace
    from public.agricultural_admin_regions r
    where r.id = new.parent_region_id;

    if not found then
      raise exception 'Parent administrative region does not exist';
    end if;
    if v_parent_country_id <> new.country_id then
      raise exception 'Parent and child administrative regions must belong to the same country';
    end if;
    if v_parent_namespace <> new.authority_namespace then
      raise exception 'Parent and child administrative regions must use the same authority namespace';
    end if;
    if not (
      (new.region_level = 'province' and v_parent_level = 'national')
      or (new.region_level = 'county' and v_parent_level = 'province')
      or (new.region_level = 'district' and v_parent_level = 'county')
      or (new.region_level = 'service_center' and v_parent_level in ('county','district'))
    ) then
      raise exception 'Invalid parent level for administrative region level %', new.region_level;
    end if;

    with recursive ancestors(id, parent_region_id) as (
      select r.id, r.parent_region_id
      from public.agricultural_admin_regions r
      where r.id = new.parent_region_id
      union
      select p.id, p.parent_region_id
      from public.agricultural_admin_regions p
      join ancestors a on p.id = a.parent_region_id
    )
    select exists(select 1 from ancestors where id = new.id) into v_cycle;
    if v_cycle then
      raise exception 'Administrative region hierarchy cannot contain a cycle';
    end if;
  end if;

  if exists (
    select 1
    from public.agricultural_admin_regions child
    where child.parent_region_id = new.id
      and (
        child.country_id <> new.country_id
        or child.authority_namespace <> new.authority_namespace
        or not (
          (child.region_level = 'province' and new.region_level = 'national')
          or (child.region_level = 'county' and new.region_level = 'province')
          or (child.region_level = 'district' and new.region_level = 'county')
          or (child.region_level = 'service_center' and new.region_level in ('county','district'))
        )
      )
  ) then
    raise exception 'Administrative region update would invalidate one or more child regions';
  end if;

  return new;
end;
$function$;

create or replace function public.guard_farm_admin_region_assignment()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_region_country_id uuid;
  v_region_active boolean;
begin
  if new.admin_region_id is not null then
    select r.country_id,r.is_active
      into v_region_country_id,v_region_active
    from public.agricultural_admin_regions r
    where r.id = new.admin_region_id;

    if not found or not v_region_active then
      raise exception 'Farm administrative region must reference an active official region';
    end if;
    if new.country_id is not null and new.country_id <> v_region_country_id then
      raise exception 'Farm country and administrative region country must match';
    end if;
  end if;

  if (select auth.uid()) is not null
     and not public.is_sarina_admin() then
    if tg_op = 'INSERT' and new.admin_region_id is not null then
      raise exception 'Agricultural administrative region must be assigned by an authorized SARINA administrator';
    end if;
    if tg_op = 'UPDATE' and new.admin_region_id is distinct from old.admin_region_id then
      raise exception 'Agricultural administrative region cannot be changed by the farm owner or ordinary member';
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function public.validate_agricultural_admin_region_parent() from public, anon, authenticated;
revoke all on function public.guard_farm_admin_region_assignment() from public, anon, authenticated;