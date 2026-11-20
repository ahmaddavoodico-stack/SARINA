create or replace function private.marketplace_has_active_org_membership(p_organization_id uuid,p_profile_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(
  select 1 from public.organization_members om
  join public.users u on u.id=om.user_id
  where om.organization_id=p_organization_id and om.user_id=p_profile_id
   and om.status='active' and u.auth_user_id=(select auth.uid())
 );
$$;
grant execute on function private.marketplace_has_active_org_membership(uuid,uuid) to authenticated;
revoke all on function private.marketplace_has_active_org_membership(uuid,uuid) from public;

drop policy if exists marketplace_sellers_insert on public.marketplace_sellers;
create policy marketplace_sellers_insert on public.marketplace_sellers for insert to authenticated with check(
 verification_status='pending' and exists(select 1 from public.users u where u.id=owner_user_id and u.auth_user_id=(select auth.uid()))
 and ((seller_type='farmer' and organization_id is null) or
      (seller_type='company' and private.marketplace_has_active_org_membership(organization_id,owner_user_id)))
);
drop policy if exists marketplace_sellers_update on public.marketplace_sellers;
create policy marketplace_sellers_update on public.marketplace_sellers for update to authenticated
using(private.marketplace_seller_is_owner(id))
with check(private.marketplace_seller_is_owner(id) and
 ((seller_type='farmer' and organization_id is null) or
  (seller_type='company' and private.marketplace_has_active_org_membership(organization_id,owner_user_id))));
create or replace function public.list_my_marketplace_organizations()
returns table(organization_id uuid,display_name text)
language sql stable security definer set search_path=public,pg_temp as $$
 select o.id,o.display_name::text
 from public.organization_members om
 join public.organizations o on o.id=om.organization_id
 join public.users u on u.id=om.user_id
 where u.auth_user_id=(select auth.uid()) and om.status='active'
 order by o.display_name;
$$;
grant execute on function public.list_my_marketplace_organizations() to authenticated;
revoke all on function public.list_my_marketplace_organizations() from public,anon;
