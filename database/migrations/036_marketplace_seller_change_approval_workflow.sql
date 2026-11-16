-- SARINA | Migration 036: owner-submitted seller edits and administrator approval
create or replace function public.submit_marketplace_seller_change_request(
  p_seller_id uuid,
  p_proposed_changes jsonb,
  p_reason text default null
) returns uuid
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_profile_id uuid; v_request_id uuid; v_seller public.marketplace_sellers%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if jsonb_typeof(p_proposed_changes) <> 'object'
     or p_proposed_changes = '{}'::jsonb then raise exception 'INVALID_CHANGES'; end if;
  if exists (
    select 1 from jsonb_object_keys(p_proposed_changes) k
    where k not in ('display_name','legal_name','description','country_code','region','city','contact_email','contact_phone','website_url')
  ) then raise exception 'UNSUPPORTED_FIELD'; end if;
  select id into v_profile_id from public.users where auth_user_id=auth.uid();
  if v_profile_id is null then raise exception 'PROFILE_NOT_FOUND'; end if;
  select * into v_seller from public.marketplace_sellers
    where id=p_seller_id and owner_user_id=v_profile_id for update;
  if not found then raise exception 'SELLER_NOT_FOUND'; end if;
  if exists(select 1 from public.marketplace_seller_change_requests
    where seller_id=p_seller_id and status in ('pending','under_review')) then
    raise exception 'OPEN_CHANGE_REQUEST_EXISTS';
  end if;
  insert into public.marketplace_seller_change_requests(seller_id,requested_by,proposed_changes,reason)
  values(p_seller_id,v_profile_id,p_proposed_changes,left(nullif(trim(p_reason),''),1000))
  returning id into v_request_id;
  return v_request_id;
end;
$$;
revoke all on function public.submit_marketplace_seller_change_request(uuid,jsonb,text) from public,anon;
grant execute on function public.submit_marketplace_seller_change_request(uuid,jsonb,text) to authenticated;

create or replace function public.list_my_marketplace_seller_change_requests(p_seller_id uuid)
returns table(id uuid,proposed_changes jsonb,reason text,status text,review_note text,created_at timestamptz,reviewed_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_profile_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  select id into v_profile_id from public.users where auth_user_id=auth.uid();
  if v_profile_id is null then raise exception 'PROFILE_NOT_FOUND'; end if;
  if not exists(select 1 from public.marketplace_sellers where id=p_seller_id and owner_user_id=v_profile_id) then
    raise exception 'SELLER_NOT_FOUND';
  end if;
  return query select r.id,r.proposed_changes,r.reason,r.status,r.review_note,r.created_at,r.reviewed_at
    from public.marketplace_seller_change_requests r where r.seller_id=p_seller_id
    order by r.created_at desc limit 30;
end;
$$;
revoke all on function public.list_my_marketplace_seller_change_requests(uuid) from public,anon;
grant execute on function public.list_my_marketplace_seller_change_requests(uuid) to authenticated;

create or replace function public.review_marketplace_seller_change_request(
  p_request_id uuid,p_decision text,p_review_note text default null
) returns boolean
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_profile_id uuid; v_request public.marketplace_seller_change_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  select id into v_profile_id from public.users where auth_user_id=auth.uid();
  if v_profile_id is null or not exists(
    select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
    where ur.user_id=v_profile_id and ur.scope_type='global' and ur.scope_id is null and r.code='admin'
  ) then raise exception 'ADMIN_REQUIRED'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'INVALID_DECISION'; end if;
  select * into v_request from public.marketplace_seller_change_requests
    where id=p_request_id for update;
  if not found or v_request.status not in ('pending','under_review') then
    raise exception 'REQUEST_NOT_REVIEWABLE';
  end if;
  if p_decision='approved' then
    update public.marketplace_sellers s set
      display_name=coalesce(v_request.proposed_changes->>'display_name',s.display_name),
      legal_name=case when v_request.proposed_changes ? 'legal_name' then nullif(v_request.proposed_changes->>'legal_name','') else s.legal_name end,
      description=case when v_request.proposed_changes ? 'description' then nullif(v_request.proposed_changes->>'description','') else s.description end,
      country_code=case when v_request.proposed_changes ? 'country_code' then nullif(v_request.proposed_changes->>'country_code','') else s.country_code end,
      region=case when v_request.proposed_changes ? 'region' then nullif(v_request.proposed_changes->>'region','') else s.region end,
      city=case when v_request.proposed_changes ? 'city' then nullif(v_request.proposed_changes->>'city','') else s.city end,
      contact_email=case when v_request.proposed_changes ? 'contact_email' then nullif(v_request.proposed_changes->>'contact_email','') else s.contact_email end,
      contact_phone=case when v_request.proposed_changes ? 'contact_phone' then nullif(v_request.proposed_changes->>'contact_phone','') else s.contact_phone end,
      website_url=case when v_request.proposed_changes ? 'website_url' then nullif(v_request.proposed_changes->>'website_url','') else s.website_url end,
      updated_at=now()
    where s.id=v_request.seller_id;
  end if;
  update public.marketplace_seller_change_requests set status=p_decision,
    reviewed_by=v_profile_id,reviewed_at=now(),review_note=left(nullif(trim(p_review_note),''),2000),updated_at=now()
  where id=p_request_id;
  return true;
end;
$$;
revoke all on function public.review_marketplace_seller_change_request(uuid,text,text) from public,anon;
grant execute on function public.review_marketplace_seller_change_request(uuid,text,text) to authenticated;
