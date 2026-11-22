create or replace function public.guard_farm_admin_region_assignment()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
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

create trigger farms_admin_region_assignment_guard
before insert or update of admin_region_id
on public.farms
for each row execute function public.guard_farm_admin_region_assignment();

revoke all on function public.guard_farm_admin_region_assignment() from public, anon, authenticated;