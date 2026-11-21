-- Behavioral RLS regression for agricultural support allocations.
-- Run only in a disposable/dev database after migration
-- 20261122001000_agricultural_support_registry_and_allocations.
-- Creates synthetic auth/farm/organization rows inside one transaction and rolls all back.

begin;

do $$
declare
  v_admin_auth uuid := '10000000-0000-0000-0000-000000000001';
  v_farmer_one_auth uuid := '10000000-0000-0000-0000-000000000002';
  v_farmer_two_auth uuid := '10000000-0000-0000-0000-000000000003';
  v_org_member_auth uuid := '10000000-0000-0000-0000-000000000004';
  v_outsider_auth uuid := '10000000-0000-0000-0000-000000000005';
  v_org_id uuid := '20000000-0000-0000-0000-000000000001';
  v_farm_one uuid := '30000000-0000-0000-0000-000000000001';
  v_farm_two uuid := '30000000-0000-0000-0000-000000000002';
  v_program_id uuid := '40000000-0000-0000-0000-000000000001';
  v_version_id uuid := '40000000-0000-0000-0000-000000000002';
  v_allocation_one uuid := '50000000-0000-0000-0000-000000000001';
  v_allocation_two uuid := '50000000-0000-0000-0000-000000000002';
  v_admin_user uuid;
  v_farmer_one uuid;
  v_farmer_two uuid;
  v_org_member uuid;
  v_outsider uuid;
begin
  insert into auth.users (id,aud,role,email,email_confirmed_at,created_at,updated_at,raw_user_meta_data)
  values
    (v_admin_auth,'authenticated','authenticated','support-ledger-admin@example.invalid',now(),now(),now(),'{"full_name":"Support Ledger Test Admin"}'::jsonb),
    (v_farmer_one_auth,'authenticated','authenticated','support-ledger-farmer-one@example.invalid',now(),now(),now(),'{"full_name":"Support Ledger Farmer One"}'::jsonb),
    (v_farmer_two_auth,'authenticated','authenticated','support-ledger-farmer-two@example.invalid',now(),now(),now(),'{"full_name":"Support Ledger Farmer Two"}'::jsonb),
    (v_org_member_auth,'authenticated','authenticated','support-ledger-org-member@example.invalid',now(),now(),now(),'{"full_name":"Support Ledger Organization Member"}'::jsonb),
    (v_outsider_auth,'authenticated','authenticated','support-ledger-outsider@example.invalid',now(),now(),now(),'{"full_name":"Support Ledger Outsider"}'::jsonb);

  select id into v_admin_user from public.users where auth_user_id=v_admin_auth;
  select id into v_farmer_one from public.users where auth_user_id=v_farmer_one_auth;
  select id into v_farmer_two from public.users where auth_user_id=v_farmer_two_auth;
  select id into v_org_member from public.users where auth_user_id=v_org_member_auth;
  select id into v_outsider from public.users where auth_user_id=v_outsider_auth;

  if v_admin_user is null or v_farmer_one is null or v_farmer_two is null
     or v_org_member is null or v_outsider is null then
    raise exception 'Synthetic auth users were not provisioned into public.users';
  end if;

  perform set_config('request.jwt.claim.sub',v_admin_auth::text,true);

  insert into public.organizations (id,legal_name,display_name,organization_type,status)
  values (v_org_id,'Support Ledger Test Authority','Support Ledger Test Authority','government','verified');

  insert into public.farms (id,owner_user_id,farm_name,total_area)
  values
    (v_farm_one,v_farmer_one,'Support Ledger Test Farm One',2),
    (v_farm_two,v_farmer_two,'Support Ledger Test Farm Two',3);

  insert into public.organization_members (organization_id,user_id,membership_role,status,joined_at)
  values (v_org_id,v_org_member,'admin','active',now());

  insert into public.organization_capabilities (organization_id,capability_code,is_enabled,updated_by_user_id)
  values
    (v_org_id,'support.allocations.read',true,v_admin_user),
    (v_org_id,'support.allocations.write',true,v_admin_user);

  insert into public.organization_access_scopes (organization_id,scope_type,target_farm_id,label,created_by_user_id)
  values (v_org_id,'farm',v_farm_one,'Synthetic test scope',v_admin_user);

  insert into public.agricultural_support_programs
    (id,issuing_organization_id,program_code,status,created_by_user_id)
  values (v_program_id,v_org_id,'TEST-SUPPORT-2026','active',v_admin_user);

  insert into public.agricultural_support_program_versions
    (id,program_id,version_number,program_name_fa,program_name_en,support_type,
     valid_from,legal_basis,source_reference,source_verified_at,verified_by_user_id,
     status,published_at,published_by_user_id,created_by_user_id)
  values
    (v_version_id,v_program_id,1,'برنامه آزمایشی حمایت','Synthetic support program','fertilizer',
     current_date,'Synthetic test-only legal basis','SYNTHETIC-TEST-SOURCE',now(),v_admin_user,
     'published',now(),v_admin_user,v_admin_user);

  -- Seed a second allocation outside the organization's farm scope as the DB owner.
  insert into public.farm_support_allocations
    (id,organization_id,program_version_id,farm_id,support_item_label,support_type,
     approved_quantity,unit_code,approved_by_user_id)
  values
    (v_allocation_two,v_org_id,v_version_id,v_farm_two,'Synthetic fertilizer','fertilizer',50,'kg',v_admin_user);

  -- Organization member can create only within the explicitly scoped farm.
  perform set_config('request.jwt.claim.sub',v_org_member_auth::text,true);
  execute 'set local role authenticated';

  insert into public.farm_support_allocations
    (id,organization_id,program_version_id,farm_id,support_item_label,support_type,
     approved_quantity,unit_code,approved_by_user_id)
  values
    (v_allocation_one,v_org_id,v_version_id,v_farm_one,'Synthetic fertilizer','fertilizer',100,'kg',v_org_member);

  insert into public.farm_support_allocation_events
    (allocation_id,event_type,event_quantity,unit_code,actor_user_id,note)
  values
    (v_allocation_one,'delivered',100,'kg',v_org_member,'Synthetic delivery event');

  if (select count(*) from public.farm_support_allocations) <> 1 then
    raise exception 'Organization member can read only allocations inside their farm scope';
  end if;

  -- An organization member cannot create an allocation outside the approved scope.
  begin
    insert into public.farm_support_allocations
      (organization_id,program_version_id,farm_id,support_item_label,support_type,
       approved_quantity,unit_code,approved_by_user_id)
    values
      (v_org_id,v_version_id,v_farm_two,'Out of scope item','fertilizer',1,'kg',v_org_member);
    raise exception 'Expected RLS to reject out-of-scope allocation creation';
  exception when insufficient_privilege then
    null;
  end;

  reset role;
  perform set_config('request.jwt.claim.sub',v_farmer_one_auth::text,true);
  execute 'set local role authenticated';

  if (select count(*) from public.farm_support_allocations) <> 1 then
    raise exception 'Farmer one must see their own allocation';
  end if;
  if (select count(*) from public.farm_support_allocation_events) <> 1 then
    raise exception 'Farmer one must see the lifecycle event for their allocation';
  end if;

  insert into public.farm_support_allocation_events
    (allocation_id,event_type,actor_user_id,note)
  values
    (v_allocation_one,'farmer_acknowledged',v_farmer_one,'Synthetic farmer acknowledgement');

  -- Farmer one cannot acknowledge or inspect farmer two's allocation.
  begin
    insert into public.farm_support_allocation_events
      (allocation_id,event_type,actor_user_id,note)
    values
      (v_allocation_two,'farmer_acknowledged',v_farmer_one,'Must be rejected');
    raise exception 'Expected RLS to reject acknowledgement on another farmer allocation';
  exception when insufficient_privilege then
    null;
  end;

  reset role;
  perform set_config('request.jwt.claim.sub',v_farmer_two_auth::text,true);
  execute 'set local role authenticated';
  if (select count(*) from public.farm_support_allocations) <> 1 then
    raise exception 'Farmer two must see only their own allocation';
  end if;

  reset role;
  perform set_config('request.jwt.claim.sub',v_outsider_auth::text,true);
  execute 'set local role authenticated';
  if (select count(*) from public.farm_support_allocations) <> 0
     or (select count(*) from public.farm_support_allocation_events) <> 0 then
    raise exception 'Unrelated user must not see support allocations or events';
  end if;

  reset role;
end;
$$;

rollback;
