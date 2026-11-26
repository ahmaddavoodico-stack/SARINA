-- Read-only regression assertions for farmer-consent authorization.
-- Run after 20261126130000_expert_handover_farmer_authorization.sql.
do $$
declare
  v_policy text;
  v_definition text;
  v_oid oid;
begin
  select with_check
    into v_policy
  from pg_policies
  where schemaname = 'public'
    and tablename = 'expert_case_handovers'
    and policyname = 'expert_case_handovers_assigned_expert_insert'
    and cmd = 'INSERT';

  if v_policy is null then
    raise exception 'Missing assigned-specialist handover INSERT policy';
  end if;

  if position('er.requester_user_id = expert_case_handovers.requester_user_id' in v_policy) = 0 then
    raise exception 'Handover INSERT policy must bind the row requester to the canonical request owner';
  end if;

  if position('er.requester_user_id = er.requester_user_id' in v_policy) > 0 then
    raise exception 'Tautological requester comparison remains in handover INSERT policy';
  end if;

  v_oid := to_regprocedure('public.respond_to_expert_case_handover(uuid,boolean)');
  if v_oid is null then
    raise exception 'Missing farmer handover response RPC';
  end if;

  select pg_get_functiondef(v_oid) into v_definition;

  if position('er.requester_user_id = h.requester_user_id' in v_definition) = 0
     or position('er.requester_user_id = (select public.current_sarina_user_id())' in v_definition) = 0
     or position('er.assigned_expert_profile_id = h.from_expert_profile_id' in v_definition) = 0 then
    raise exception 'Handover response RPC is missing canonical farmer/current-assignee binding';
  end if;

  if not (select prosecdef from pg_proc where oid = v_oid) then
    raise exception 'Handover response RPC must retain SECURITY DEFINER for its controlled write workflow';
  end if;

  if has_function_privilege('anon', v_oid, 'EXECUTE') then
    raise exception 'Anonymous/PUBLIC execution must remain revoked';
  end if;

  if not has_function_privilege('authenticated', v_oid, 'EXECUTE') then
    raise exception 'Authenticated farmer RPC execution grant is missing';
  end if;
end;
$$;
