-- Privilege and policy regression checks for Phase 2 support evidence.
-- Expected to pass after 20261122002000_agricultural_support_evidence_and_utilization.

do $$
declare
  v_privilege text;
  v_delete_policy text;
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='farm_support_allocation_documents'
      and c.relkind in ('r','p') and c.relrowsecurity
  ) then
    raise exception 'RLS missing on farm_support_allocation_documents';
  end if;

  foreach v_privilege in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
    if has_table_privilege('anon','public.farm_support_allocation_documents',v_privilege) then
      raise exception 'anon retains % on farm_support_allocation_documents',v_privilege;
    end if;
  end loop;

  if not has_table_privilege('authenticated','public.farm_support_allocation_documents','SELECT')
     or not has_table_privilege('authenticated','public.farm_support_allocation_documents','INSERT')
     or has_table_privilege('authenticated','public.farm_support_allocation_documents','UPDATE')
     or has_table_privilege('authenticated','public.farm_support_allocation_documents','DELETE')
     or has_table_privilege('authenticated','public.farm_support_allocation_documents','TRUNCATE')
     or has_table_privilege('authenticated','public.farm_support_allocation_documents','REFERENCES')
     or has_table_privilege('authenticated','public.farm_support_allocation_documents','TRIGGER') then
    raise exception 'Evidence link table must be SELECT/INSERT only for authenticated clients';
  end if;

  if not exists(select 1 from pg_policies where schemaname='public' and tablename='farm_support_allocation_documents' and policyname='farm_support_allocation_documents_farmer_insert' and cmd='INSERT')
     or not exists(select 1 from pg_policies where schemaname='public' and tablename='farm_support_allocation_documents' and policyname='farm_support_allocation_documents_participant_read' and cmd='SELECT')
     or not exists(select 1 from pg_policies where schemaname='public' and tablename='farm_documents' and policyname='farm_documents_support_allocation_read' and cmd='SELECT')
     or not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='farmer_documents_read_linked_support_evidence' and cmd='SELECT') then
    raise exception 'Required evidence-link or private storage read policies are missing';
  end if;

  select qual into v_delete_policy
    from pg_policies
   where schemaname='storage' and tablename='objects'
     and policyname='farmer_documents_delete_own_farm';
  if v_delete_policy is null or position('NOT (EXISTS' in upper(v_delete_policy))=0 then
    raise exception 'Linked support evidence must be protected from owner storage deletion';
  end if;

  if has_function_privilege('anon','sarina_internal.can_attach_farm_support_document(uuid,uuid,uuid)','EXECUTE')
     or not has_function_privilege('authenticated','sarina_internal.can_attach_farm_support_document(uuid,uuid,uuid)','EXECUTE') then
    raise exception 'Evidence attachment helper grants are incorrect';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.farm_support_allocation_events'::regclass
      and conname='farm_support_allocation_events_event_type_check'
      and pg_get_constraintdef(oid) like '%utilization_reported%'
  ) then
    raise exception 'Utilization event type is not enabled';
  end if;
end;
$$;
