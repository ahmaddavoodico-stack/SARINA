-- Central, country-neutral institutional verification desk and farmer-scoped service discovery.
-- Additive only: no organization, member, scope, or farmer records are provisioned.

create table if not exists public.authority_onboarding_request_events (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.authority_onboarding_requests(id) on delete restrict,
 from_status text,
 to_status text not null,
 review_notes text,
 actor_user_id uuid references public.users(id) on delete set null,
 occurred_at timestamptz not null default now()
);
create index if not exists authority_onboarding_events_request_time_idx on public.authority_onboarding_request_events(request_id, occurred_at desc);
alter table public.authority_onboarding_request_events enable row level security;
revoke all on public.authority_onboarding_request_events from anon, authenticated;
grant select on public.authority_onboarding_request_events to authenticated;
drop policy if exists authority_onboarding_events_admin_read on public.authority_onboarding_request_events;
create policy authority_onboarding_events_admin_read on public.authority_onboarding_request_events for select to authenticated using (coalesce(public.is_sarina_admin(),false));

create or replace function public.capture_authority_onboarding_status_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if tg_op='INSERT' then
  insert into public.authority_onboarding_request_events(request_id,from_status,to_status,review_notes,actor_user_id)
  values(new.id,null,new.status,new.review_notes,public.current_sarina_user_id());
 elsif new.status is distinct from old.status or new.review_notes is distinct from old.review_notes then
  insert into public.authority_onboarding_request_events(request_id,from_status,to_status,review_notes,actor_user_id)
  values(new.id,old.status,new.status,new.review_notes,public.current_sarina_user_id());
 end if;
 return new;
end; $$;
drop trigger if exists authority_onboarding_status_audit on public.authority_onboarding_requests;
create trigger authority_onboarding_status_audit after insert or update of status,review_notes on public.authority_onboarding_requests for each row execute function public.capture_authority_onboarding_status_event();

create or replace function public.review_authority_onboarding_request(p_request_id uuid,p_new_status text,p_review_notes text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_request public.authority_onboarding_requests%rowtype; v_actor uuid; v_admin_user_id uuid;
begin
 if (select auth.uid()) is null or not coalesce(public.is_sarina_admin(),false) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_new_status not in ('under_review','needs_correction','approved','rejected') then raise exception 'invalid_review_status' using errcode='22023'; end if;
 if p_new_status in ('needs_correction','rejected') and nullif(btrim(p_review_notes),'') is null then raise exception 'review_notes_required' using errcode='22023'; end if;
 select * into v_request from public.authority_onboarding_requests where id=p_request_id for update;
 if not found then raise exception 'request_not_found' using errcode='P0002'; end if;
 if v_request.status in ('rejected','withdrawn') then raise exception 'request_is_closed' using errcode='55000'; end if;
 if p_new_status='approved' then
  select u.id into v_admin_user_id from public.users u
  where lower(btrim(u.email))=lower(btrim(v_request.proposed_admin_email))
    and u.auth_user_id is not null and u.account_status='active' limit 1;
  if v_admin_user_id is null then
   raise exception 'proposed_admin_account_not_verified' using errcode='23514',
   detail='Proposed administrator email must match an active authenticated SARINA account. No account or membership is created automatically.';
  end if;
 end if;
 v_actor:=public.current_sarina_user_id();
 update public.authority_onboarding_requests set status=p_new_status,review_notes=nullif(btrim(p_review_notes),''),reviewed_by_user_id=v_actor,reviewed_at=now(),updated_at=now() where id=p_request_id;
 return jsonb_build_object('ok',true,'request_id',p_request_id,'status',p_new_status,'matched_admin_user_id',case when p_new_status='approved' then v_admin_user_id else null end,'provisioned',false);
end; $$;
revoke execute on function public.review_authority_onboarding_request(uuid,text,text) from public,anon;
grant execute on function public.review_authority_onboarding_request(uuid,text,text) to authenticated;
revoke execute on function public.capture_authority_onboarding_status_event() from public,anon,authenticated;

create or replace function public.farmer_has_organization_service_scope(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 with recursive current_farmer as (
  select u.id as user_id from public.users u
  where u.auth_user_id=(select auth.uid()) and (select auth.uid()) is not null limit 1
 ), farmer_farms as (
  select f.id,f.country_id,f.admin_region_id,cf.user_id from public.farms f join current_farmer cf on cf.user_id=f.owner_user_id
 ), authorized_regions(id) as (
  select s.target_admin_region_id from public.organization_access_scopes s
  where s.organization_id=p_organization_id and s.scope_type='admin_region' and s.target_admin_region_id is not null
  union
  select child.id from public.agricultural_admin_regions child join authorized_regions parent on child.parent_region_id=parent.id where child.is_active=true
 )
 select exists (
  select 1 from public.organizations o
  join public.organization_access_scopes s on s.organization_id=o.id
  join farmer_farms f on (
   s.scope_type='global'
   or (s.scope_type='country' and s.country_id is not null and s.country_id=f.country_id)
   or (s.scope_type='user' and s.target_user_id=f.user_id)
   or (s.scope_type='farm' and s.target_farm_id=f.id)
   or (s.scope_type='admin_region' and f.admin_region_id in (select id from authorized_regions))
  )
  where o.id=p_organization_id and o.status='verified'
 );
$$;
revoke execute on function public.farmer_has_organization_service_scope(uuid) from public,anon;
grant execute on function public.farmer_has_organization_service_scope(uuid) to authenticated;
drop policy if exists organization_services_farmer_directory on public.organization_services;
drop policy if exists organization_services_read_active on public.organization_services;
drop policy if exists organization_services_farmer_scoped_directory on public.organization_services;
create policy organization_services_farmer_scoped_directory on public.organization_services for select to authenticated using (
 public.is_sarina_admin()
 or exists(select 1 from public.organization_members om where om.organization_id=organization_services.organization_id and om.user_id=public.current_sarina_user_id() and om.status='active')
 or (organization_services.status='active' and public.farmer_has_organization_service_scope(organization_services.organization_id))
);
comment on function public.farmer_has_organization_service_scope(uuid) is 'Boolean-only directory gate: farmers see active services only where a verified organization has an explicit scope intersecting one of their own farms. No farm or no matching scope means no directory visibility.';
