-- Agricultural support registry and allocation ledger privilege regression checks.
-- Read-only assertions; expected to PASS after migration
-- 20261122001000_agricultural_support_registry_and_allocations.

do $$
declare
  v_table text;
  v_privilege text;
  v_tables text[] := array[
    'agricultural_support_programs',
    'agricultural_support_program_versions',
    'farm_support_allocations',
    'farm_support_allocation_events'
  ];
begin
  foreach v_table in array v_tables loop
    if not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=v_table
        and c.relkind in ('r','p') and c.relrowsecurity
    ) then
      raise exception 'RLS missing or table not found: public.%',v_table;
    end if;

    foreach v_privilege in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
      if has_table_privilege('anon',format('public.%I',v_table),v_privilege) then
        raise exception 'anon retains % on public.%',v_privilege,v_table;
      end if;
    end loop;
  end loop;

  if not has_table_privilege('authenticated','public.agricultural_support_programs','SELECT')
     or not has_table_privilege('authenticated','public.agricultural_support_program_versions','SELECT')
     or not has_table_privilege('authenticated','public.farm_support_allocations','SELECT')
     or not has_table_privilege('authenticated','public.farm_support_allocation_events','SELECT') then
    raise exception 'Authenticated SELECT grants are incomplete';
  end if;

  if not has_table_privilege('authenticated','public.agricultural_support_programs','INSERT')
     or not has_table_privilege('authenticated','public.agricultural_support_programs','UPDATE')
     or not has_table_privilege('authenticated','public.agricultural_support_programs','DELETE')
     or not has_table_privilege('authenticated','public.agricultural_support_program_versions','INSERT')
     or not has_table_privilege('authenticated','public.agricultural_support_program_versions','UPDATE')
     or not has_table_privilege('authenticated','public.agricultural_support_program_versions','DELETE') then
    raise exception 'Admin-managed program registry grants are incomplete';
  end if;

  if not has_table_privilege('authenticated','public.farm_support_allocations','INSERT')
     or has_table_privilege('authenticated','public.farm_support_allocations','UPDATE')
     or has_table_privilege('authenticated','public.farm_support_allocations','DELETE')
     or not has_table_privilege('authenticated','public.farm_support_allocation_events','INSERT')
     or has_table_privilege('authenticated','public.farm_support_allocation_events','UPDATE')
     or has_table_privilege('authenticated','public.farm_support_allocation_events','DELETE') then
    raise exception 'Allocations and event history must be insert-only for clients';
  end if;

  foreach v_table in array v_tables loop
    foreach v_privilege in array array['TRUNCATE','REFERENCES','TRIGGER'] loop
      if has_table_privilege('authenticated',format('public.%I',v_table),v_privilege) then
        raise exception 'authenticated retains % on public.%',v_privilege,v_table;
      end if;
    end loop;
  end loop;

  if not exists(select 1 from pg_policies where schemaname='public' and tablename='agricultural_support_programs' and policyname='agricultural_support_programs_admin_manage' and cmd='ALL')
     or not exists(select 1 from pg_policies where schemaname='public' and tablename='agricultural_support_program_versions' and policyname='agricultural_support_program_versions_admin_manage' and cmd='ALL')
     or not exists(select 1 from pg_policies where schemaname='public' and tablename='farm_support_allocations' and policyname='farm_support_allocations_farmer_read' and cmd='SELECT')
     or not exists(select 1 from pg_policies where schemaname='public' and tablename='farm_support_allocations' and policyname='farm_support_allocations_organization_insert' and cmd='INSERT')
     or not exists(select 1 from pg_policies where schemaname='public' and tablename='farm_support_allocation_events' and policyname='farm_support_allocation_events_farmer_insert' and cmd='INSERT')
     or not exists(select 1 from pg_policies where schemaname='public' and tablename='farm_support_allocation_events' and policyname='farm_support_allocation_events_organization_insert' and cmd='INSERT') then
    raise exception 'Required support registry/allocation RLS policies are missing';
  end if;

  if not exists(select 1 from pg_trigger where tgrelid='public.agricultural_support_program_versions'::regclass and tgname='agricultural_support_program_version_guard' and not tgisinternal)
     or not exists(select 1 from pg_trigger where tgrelid='public.farm_support_allocations'::regclass and tgname='farm_support_allocation_guard' and not tgisinternal)
     or not exists(select 1 from pg_trigger where tgrelid='public.farm_support_allocation_events'::regclass and tgname='farm_support_allocation_event_guard' and not tgisinternal) then
    raise exception 'Published-version or append-only guards are missing';
  end if;

  if has_schema_privilege('anon','sarina_internal','USAGE')
     or not has_schema_privilege('authenticated','sarina_internal','USAGE') then
    raise exception 'The internal helper schema must be private to authenticated policy evaluation';
  end if;

  if has_function_privilege('anon','sarina_internal.has_published_support_program_version(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','sarina_internal.has_published_support_program_version(uuid)','EXECUTE')
     or has_function_privilege('anon','sarina_internal.is_farm_support_allocation_owner(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','sarina_internal.is_farm_support_allocation_owner(uuid)','EXECUTE')
     or has_function_privilege('anon','sarina_internal.can_read_farm_support_allocation(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','sarina_internal.can_read_farm_support_allocation(uuid)','EXECUTE')
     or has_function_privilege('anon','sarina_internal.can_write_farm_support_allocation(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','sarina_internal.can_write_farm_support_allocation(uuid)','EXECUTE')
     or has_function_privilege('anon','sarina_internal.can_create_farm_support_allocation(uuid,uuid,uuid,uuid)','EXECUTE')
     or not has_function_privilege('authenticated','sarina_internal.can_create_farm_support_allocation(uuid,uuid,uuid,uuid)','EXECUTE') then
    raise exception 'Internal RLS helper grants are incorrect';
  end if;

  if has_function_privilege('anon','public.validate_agricultural_support_program_actor()','EXECUTE')
     or has_function_privilege('authenticated','public.validate_agricultural_support_program_actor()','EXECUTE')
     or has_function_privilege('anon','public.validate_agricultural_support_program_version()','EXECUTE')
     or has_function_privilege('authenticated','public.validate_agricultural_support_program_version()','EXECUTE')
     or has_function_privilege('anon','public.validate_farm_support_allocation()','EXECUTE')
     or has_function_privilege('authenticated','public.validate_farm_support_allocation()','EXECUTE')
     or has_function_privilege('anon','public.validate_farm_support_allocation_event()','EXECUTE')
     or has_function_privilege('authenticated','public.validate_farm_support_allocation_event()','EXECUTE') then
    raise exception 'Internal trigger validators must not be directly executable by client roles';
  end if;
end;
$$;
