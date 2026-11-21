-- Behavioral RLS regression for support evidence and utilization.
-- Run only in a disposable/dev database after Phase 1 and Phase 2 migrations.
-- Synthetic users, farms, allocations, metadata and storage rows are rolled back.

begin;

do $$
declare
  v_admin_auth uuid := '11000000-0000-0000-0000-000000000001';
  v_farmer_one_auth uuid := '11000000-0000-0000-0000-000000000002';
  v_farmer_two_auth uuid := '11000000-0000-0000-0000-000000000003';
  v_org_member_auth uuid := '11000000-0000-0000-0000-000000000004';
  v_outsider_auth uuid := '11000000-0000-0000-0000-000000000005';
  v_org_id uuid := '21000000-0000-0000-0000-000000000001';
  v_farm_one uuid := '31000000-0000-0000-0000-000000000001';
  v_farm_two uuid := '31000000-0000-0000-0000-000000000002';
  v_program_id uuid := '41000000-0000-0000-0000-000000000001';
  v_version_id uuid := '41000000-0000-0000-0000-000000000002';
  v_allocation_one uuid := '51000000-0000-0000-0000-000000000001';
  v_allocation_two uuid := '51000000-0000-0000-0000-000000000002';
  v_doc_one uuid := '61000000-0000-0000-0000-000000000001';
  v_doc_two uuid := '61000000-0000-0000-0000-000000000002';
  v_doc_three uuid := '61000000-0000-0000-0000-000000000003';
  v_admin_user uuid;
  v_farmer_one uuid;
  v_farmer_two uuid;
  v_org_member uuid;
  v_outsider uuid;
  v_path_one text := v_farmer_one_auth::text||'/'||v_farm_one::text||'/evidence-one.pdf';
  v_path_two text := v_farmer_two_auth::text||'/'||v_farm_two::text||'/evidence-two.pdf';
  v_path_three text := v_farmer_one_auth::text||'/'||v_farm_one::text||'/unlinked-evidence.pdf';
begin
  insert into auth.users (id,aud,role,email,email_confirmed_at,created_at,updated_at,raw_user_meta_data)
  values
    (v_admin_auth,'authenticated','authenticated','support-evidence-admin@example.invalid',now(),now(),now(),'{"full_name":"Support Evidence Test Admin"}'::jsonb),
    (v_farmer_one_auth,'authenticated','authenticated','support-evidence-farmer-one@example.invalid',now(),now(),now(),'{"full_name":"Support Evidence Farmer One"}'::jsonb),
    (v_farmer_two_auth,'authenticated','authenticated','support-evidence-farmer-two@example.invalid',now(),now(),now(),'{"full_name":"Support Evidence Farmer Two"}'::jsonb),
    (v_org_member_auth,'authenticated','authenticated','support-evidence-org-member@example.invalid',now(),now(),now(),'{"full_name":"Support Evidence Organization Member"}'::jsonb),
    (v_outsider_auth,'authenticated','authenticated','support-evidence-outsider@example.invalid',now(),now(),now(),'{"full_name":"Support Evidence Outsider"}'::jsonb);

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
  values (v_org_id,'Support Evidence Test Authority','Support Evidence Test Authority','government','verified');

  insert into public.farms (id,owner_user_id,farm_name,total_area)
  values
    (v_farm_one,v_farmer_one,'Support Evidence Test Farm One',2),
    (v_farm_two,v_farmer_two,'Support Evidence Test Farm Two',3);

  insert into public.organization_members (organization_id,user_id,membership_role,status,joined_at)
  values (v_org_id,v_org_member,'admin','active',now());

  insert into public.organization_capabilities (organization_id,capability_code,is_enabled,updated_by_user_id)
  values
    (v_org_id,'support.allocations.read',true,v_admin_user),
    (v_org_id,'support.allocations.write',true,v_admin_user);

  insert into public.organization_access_scopes (organization_id,scope_type,target_farm_id,label,created_by_user_id)
  values (v_org_id,'farm',v_farm_one,'Synthetic evidence scope',v_admin_user);

  insert into public.agricultural_support_programs
    (id,issuing_organization_id,program_code,status,created_by_user_id)
  values (v_program_id,v_org_id,'TEST-EVIDENCE-2026','active',v_admin_user);

  insert into public.agricultural_support_program_versions
    (id,program_id,version_number,program_name_fa,program_name_en,support_type,
     valid_from,legal_basis,source_reference,source_verified_at,verified_by_user_id,
     status,published_at,published_by_user_id,created_by_user_id)
  values
    (v_version_id,v_program_id,1,'برنامه آزمایشی شواهد','Synthetic evidence program','fertilizer',
     current_date,'Synthetic test-only legal basis','SYNTHETIC-EVIDENCE-SOURCE',now(),v_admin_user,
     'published',now(),v_admin_user,v_admin_user);

  insert into public.farm_support_allocations
    (id,organization_id,program_version_id,farm_id,support_item_label,support_type,
     approved_quantity,unit_code,approved_by_user_id)
  values
    (v_allocation_one,v_org_id,v_version_id,v_farm_one,'Synthetic fertilizer one','fertilizer',100,'kg',v_admin_user),
    (v_allocation_two,v_org_id,v_version_id,v_farm_two,'Synthetic fertilizer two','fertilizer',50,'kg',v_admin_user);

  insert into storage.objects (id,bucket_id,name,owner,owner_id,metadata)
  values
    ('71000000-0000-0000-0000-000000000001','farmer-documents',v_path_one,v_farmer_one_auth,v_farmer_one_auth::text,'{"mimetype":"application/pdf","size":100}'::jsonb),
    ('71000000-0000-0000-0000-000000000002','farmer-documents',v_path_two,v_farmer_two_auth,v_farmer_two_auth::text,'{"mimetype":"application/pdf","size":100}'::jsonb),
    ('71000000-0000-0000-0000-000000000003','farmer-documents',v_path_three,v_farmer_one_auth,v_farmer_one_auth::text,'{"mimetype":"application/pdf","size":100}'::jsonb);

  insert into public.farm_documents
    (id,farm_id,uploaded_by_user_id,document_type,file_name,storage_path,mime_type,file_size_bytes)
  values
    (v_doc_one,v_farm_one,v_farmer_one,'support_evidence','evidence-one.pdf',v_path_one,'application/pdf',100),
    (v_doc_two,v_farm_two,v_farmer_two,'support_evidence','evidence-two.pdf',v_path_two,'application/pdf',100),
    (v_doc_three,v_farm_one,v_farmer_one,'general','unlinked-evidence.pdf',v_path_three,'application/pdf',100);
end;
$$;

-- Farmer one attaches only their own document to their own support allocation,
-- then records a self-reported utilization event.
select set_config('request.jwt.claim.sub','11000000-0000-0000-0000-000000000002',true);
set local role authenticated;

do $$
declare
  v_farmer uuid := public.current_sarina_user_id();
begin
  insert into public.farm_support_allocation_documents
    (allocation_id,farm_document_id,attached_by_user_id,note)
  values
    ('51000000-0000-0000-0000-000000000001',
     '61000000-0000-0000-0000-000000000001',
     v_farmer,'Synthetic evidence attachment');

  insert into public.farm_support_allocation_events
    (allocation_id,event_type,event_quantity,unit_code,disposition_code,actor_user_id,note)
  values
    ('51000000-0000-0000-0000-000000000001','utilization_reported',25,'kg',
     'used_as_intended',v_farmer,'Synthetic farmer-reported utilization');

  if (select count(*) from public.farm_documents) <> 2 then
    raise exception 'Farmer one must see both own documents';
  end if;
  if (select count(*) from public.farm_support_allocation_documents) <> 1 then
    raise exception 'Farmer one must see their allocation evidence link';
  end if;

  begin
    insert into public.farm_support_allocation_documents
      (allocation_id,farm_document_id,attached_by_user_id)
    values
      ('51000000-0000-0000-0000-000000000001',
       '61000000-0000-0000-0000-000000000002',
       v_farmer);
    raise exception 'Expected RLS to reject linking another farmer document';
  exception when insufficient_privilege then
    null;
  end;

  begin
    delete from public.farm_documents
     where id='61000000-0000-0000-0000-000000000001';
    raise exception 'Expected linked farm document deletion to be blocked by its foreign key';
  exception when foreign_key_violation then
    null;
  end;
end;
$$;

reset role;

-- Issuing organization can read only the explicitly linked document and object,
-- not every document in the farmer's file.
select set_config('request.jwt.claim.sub','11000000-0000-0000-0000-000000000004',true);
set local role authenticated;

do $$
begin
  if (select count(*) from public.farm_support_allocation_documents) <> 1 then
    raise exception 'Organization should see only evidence linked to its in-scope allocation';
  end if;
  if (select count(*) from public.farm_documents) <> 1 then
    raise exception 'Organization must not see unlinked farmer documents';
  end if;
  if (select count(*) from storage.objects where bucket_id='farmer-documents') <> 1 then
    raise exception 'Organization must download only the linked evidence object';
  end if;
  if (select count(*) from public.farm_support_allocation_events where event_type='utilization_reported') <> 1 then
    raise exception 'Organization should see the farmer-reported utilization event';
  end if;
end;
$$;

reset role;

-- Farmer two sees their own unlinked document, but not farmer one's file.
select set_config('request.jwt.claim.sub','11000000-0000-0000-0000-000000000003',true);
set local role authenticated;

do $$
begin
  if (select count(*) from public.farm_documents) <> 1
     or (select count(*) from public.farm_support_allocation_documents) <> 0
     or (select count(*) from storage.objects where bucket_id='farmer-documents') <> 1 then
    raise exception 'Farmer two must see only their own unlinked document and no other farmer evidence';
  end if;
end;
$$;

reset role;

-- Unrelated user cannot see any farm document, evidence link or object.
select set_config('request.jwt.claim.sub','11000000-0000-0000-0000-000000000005',true);
set local role authenticated;

do $$
begin
  if (select count(*) from public.farm_documents) <> 0
     or (select count(*) from public.farm_support_allocation_documents) <> 0
     or (select count(*) from storage.objects where bucket_id='farmer-documents') <> 0 then
    raise exception 'Unrelated user must not see private farm evidence';
  end if;
end;
$$;

reset role;
rollback;
