-- SARINA Phase Zero access-hardening regression assertions.
-- Read-only: this file checks grants, RLS and function/policy definitions.
-- It does not create fixtures or change production data.
-- Run only after the companion patch has been applied to an isolated test database.

do $$
declare
  v_table text;
  v_privilege text;
  v_policy text;
  v_function text;
  v_backend_tables text[] := array[
    'ai_conversations',
    'ai_messages',
    'ai_analysis_runs',
    'ai_message_feedback',
    'ai_models',
    'ai_providers',
    'ai_model_routing_rules',
    'communication_logs',
    'siacp_key_registry',
    'messaging_channels',
    'messaging_connections'
  ];
begin
  -- 1. No client role may retain DDL-like privileges on public application tables.
  foreach v_table in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r','p')
  loop
    foreach v_privilege in array array['MAINTAIN','TRUNCATE','REFERENCES','TRIGGER'] loop
      if has_table_privilege('anon', format('public.%I', v_table), v_privilege) then
        raise exception 'anon retains % on public.%', v_privilege, v_table;
      end if;
      if has_table_privilege('authenticated', format('public.%I', v_table), v_privilege) then
        raise exception 'authenticated retains % on public.%', v_privilege, v_table;
      end if;
    end loop;
  end loop;

  -- 2. Future public tables, sequences and functions must not inherit client grants.
  if exists (
    select 1
    from pg_default_acl d
    cross join lateral aclexplode(d.defaclacl) a
    where d.defaclnamespace = 'public'::regnamespace
      and d.defaclobjtype in ('r','S','f')
      and d.defaclrole in ('postgres'::regrole, 'supabase_admin'::regrole)
      and a.grantee in ('anon'::regrole, 'authenticated'::regrole)
  ) then
    raise exception 'Broad default privileges for anon/authenticated remain in public schema';
  end if;

  -- 3. Backend-owned tables remain RLS-enabled and are inaccessible directly
  -- to anon/authenticated until explicit user-facing policies are designed.
  foreach v_table in array v_backend_tables loop
    if to_regclass(format('public.%I', v_table)) is null then
      raise exception 'Expected backend-owned table is missing: public.%', v_table;
    end if;

    if not (
      select c.relrowsecurity
      from pg_class c
      where c.oid = to_regclass(format('public.%I', v_table))
    ) then
      raise exception 'RLS must remain enabled on public.%', v_table;
    end if;

    foreach v_privilege in array array['SELECT','INSERT','UPDATE','REFERENCES'] loop
      if has_table_privilege('anon', format('public.%I', v_table), v_privilege)
         or has_any_column_privilege('anon', format('public.%I', v_table), v_privilege) then
        raise exception 'anon retains % on backend-owned public.%', v_privilege, v_table;
      end if;
      if has_table_privilege('authenticated', format('public.%I', v_table), v_privilege)
         or has_any_column_privilege('authenticated', format('public.%I', v_table), v_privilege) then
        raise exception 'authenticated retains % on backend-owned public.%', v_privilege, v_table;
      end if;
    end loop;

    foreach v_privilege in array array['DELETE','TRUNCATE','TRIGGER','MAINTAIN'] loop
      if has_table_privilege('anon', format('public.%I', v_table), v_privilege)
         or has_table_privilege('authenticated', format('public.%I', v_table), v_privilege) then
        raise exception 'Client role retains % on backend-owned public.%', v_privilege, v_table;
      end if;
    end loop;
  end loop;

  -- 4. Handover RLS must bind the request owner to the outer handover row.
  if not (
    select c.relrowsecurity
    from pg_class c
    where c.oid = 'public.expert_case_handovers'::regclass
  ) then
    raise exception 'RLS is disabled on expert_case_handovers';
  end if;

  select with_check into v_policy
  from pg_policies
  where schemaname = 'public'
    and tablename = 'expert_case_handovers'
    and policyname = 'expert_case_handovers_assigned_expert_insert'
    and cmd = 'INSERT';

  if v_policy is null
     or position('expert_case_handovers.requester_user_id' in v_policy) = 0
     or position('er.requester_user_id = er.requester_user_id' in v_policy) > 0 then
    raise exception 'Handover INSERT policy does not explicitly bind the actual request owner';
  end if;

  if not has_table_privilege('authenticated','public.expert_case_handovers','SELECT')
     or not has_table_privilege('authenticated','public.expert_case_handovers','INSERT')
     or has_table_privilege('authenticated','public.expert_case_handovers','UPDATE')
     or has_table_privilege('authenticated','public.expert_case_handovers','DELETE')
     or has_table_privilege('anon','public.expert_case_handovers','SELECT')
     or has_table_privilege('anon','public.expert_case_handovers','INSERT') then
    raise exception 'Handover table grants are not SELECT/INSERT-only for authenticated';
  end if;

  -- 5. Consent RPC independently verifies the real request owner.
  select pg_get_functiondef(
    'public.respond_to_expert_case_handover(uuid,boolean)'::regprocedure
  ) into v_function;

  if position('er.requester_user_id = public.current_sarina_user_id()' in lower(v_function)) = 0
     or position('h.requester_user_id = er.requester_user_id' in lower(v_function)) = 0 then
    raise exception 'Handover consent RPC does not independently bind caller to request owner';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.respond_to_expert_case_handover(uuid,boolean)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.respond_to_expert_case_handover(uuid,boolean)',
       'EXECUTE'
     ) then
    raise exception 'Handover consent RPC EXECUTE grants are incorrect';
  end if;

  -- 6. Notifications remain recipient-scoped and clients can update only read_at.
  if not (
    select c.relrowsecurity
    from pg_class c
    where c.oid = 'public.expert_case_notifications'::regclass
  ) then
    raise exception 'RLS is disabled on expert_case_notifications';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'expert_case_notifications'
      and policyname = 'expert_case_notifications_recipient_read'
      and cmd = 'SELECT'
      and qual like '%recipient_user_id%'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'expert_case_notifications'
      and policyname = 'expert_case_notifications_recipient_mark_read'
      and cmd = 'UPDATE'
      and qual like '%recipient_user_id%'
      and with_check like '%recipient_user_id%'
  ) then
    raise exception 'Recipient-scoped notification policies are missing';
  end if;

  if has_table_privilege('anon','public.expert_case_notifications','SELECT')
     or has_table_privilege('authenticated','public.expert_case_notifications','INSERT')
     or has_table_privilege('authenticated','public.expert_case_notifications','DELETE')
     or has_table_privilege('authenticated','public.expert_case_notifications','UPDATE')
     or not has_table_privilege('authenticated','public.expert_case_notifications','SELECT')
     or not has_column_privilege('authenticated','public.expert_case_notifications','read_at','UPDATE')
     or has_column_privilege('authenticated','public.expert_case_notifications','preview','UPDATE') then
    raise exception 'Notification grants are not limited to SELECT and UPDATE(read_at)';
  end if;
end
$$;
