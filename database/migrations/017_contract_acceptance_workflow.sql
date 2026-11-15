-- 017: trusted, atomic contract lifecycle transitions.
create or replace function public.transition_service_contract(
  p_contract_id uuid,
  p_actor_user_id uuid,
  p_action text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contract public.service_contracts%rowtype;
  v_is_farmer boolean;
  v_is_expert boolean;
  v_now timestamptz := now();
  v_new_status text;
begin
  if p_action not in ('propose','accept','cancel') then
    raise exception 'Unsupported contract action' using errcode = '22023';
  end if;

  select * into v_contract
  from public.service_contracts
  where id = p_contract_id
  for update;

  if not found then
    raise exception 'Contract not found' using errcode = 'P0002';
  end if;

  v_is_farmer := v_contract.farmer_user_id = p_actor_user_id;
  v_is_expert := false;

  if v_contract.expert_profile_id is not null then
    select exists(
      select 1 from public.expert_profiles ep
      where ep.id = v_contract.expert_profile_id
        and ep.user_id = p_actor_user_id
        and ep.verification_status = 'verified'
    ) into v_is_expert;
  end if;

  if p_action = 'propose' then
    if not v_is_farmer or v_contract.status <> 'draft' then
      raise exception 'Only the contract farmer can propose a draft' using errcode = '42501';
    end if;
    update public.service_contracts
      set status='proposed', proposed_at=v_now, updated_at=v_now
      where id=p_contract_id;
    insert into public.contract_audit_events(contract_id,actor_user_id,event_type,event_payload)
      values(p_contract_id,p_actor_user_id,'offer_proposed',
        jsonb_build_object('version',v_contract.version,'terms_snapshot',v_contract.terms_snapshot));
    v_new_status := 'proposed';

  elsif p_action = 'accept' then
    if not v_is_farmer and not v_is_expert then
      raise exception 'Actor is not a required contract party' using errcode = '42501';
    end if;
    if v_contract.status <> 'proposed' then
      raise exception 'Only proposed contracts can be accepted' using errcode = '22023';
    end if;

    if v_is_farmer then
      if v_contract.farmer_accepted_at is not null then
        raise exception 'Farmer has already accepted this version' using errcode = '22023';
      end if;
      update public.service_contracts set farmer_accepted_at=v_now, updated_at=v_now
        where id=p_contract_id;
      insert into public.contract_audit_events(contract_id,actor_user_id,event_type,event_payload)
        values(p_contract_id,p_actor_user_id,'farmer_accepted',
          jsonb_build_object('version',v_contract.version));
    else
      if v_contract.expert_accepted_at is not null then
        raise exception 'Expert has already accepted this version' using errcode = '22023';
      end if;
      update public.service_contracts set expert_accepted_at=v_now, updated_at=v_now
        where id=p_contract_id;
      insert into public.contract_audit_events(contract_id,actor_user_id,event_type,event_payload)
        values(p_contract_id,p_actor_user_id,'expert_accepted',
          jsonb_build_object('version',v_contract.version));
    end if;

    select * into v_contract from public.service_contracts where id=p_contract_id for update;
    if v_contract.farmer_accepted_at is not null
       and (v_contract.expert_profile_id is null or v_contract.expert_accepted_at is not null) then
      update public.service_contracts set status='accepted', updated_at=v_now
        where id=p_contract_id;
      insert into public.contract_audit_events(contract_id,actor_user_id,event_type,event_payload)
        values(p_contract_id,p_actor_user_id,'contract_fully_accepted',
          jsonb_build_object('version',v_contract.version));
      v_new_status := 'accepted';
    else
      v_new_status := 'proposed';
    end if;

  else
    if (not v_is_farmer and not v_is_expert) or v_contract.status not in ('draft','proposed') then
      raise exception 'Actor cannot cancel this contract' using errcode = '42501';
    end if;
    update public.service_contracts set status='cancelled',cancelled_at=v_now,updated_at=v_now
      where id=p_contract_id;
    insert into public.contract_audit_events(contract_id,actor_user_id,event_type,event_payload)
      values(p_contract_id,p_actor_user_id,'contract_cancelled',
        jsonb_build_object('version',v_contract.version));
    v_new_status := 'cancelled';
  end if;

  return jsonb_build_object('contract_id',p_contract_id,'status',v_new_status,'version',v_contract.version);
end;
$$;

revoke all on function public.transition_service_contract(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.transition_service_contract(uuid,uuid,text) to service_role;
