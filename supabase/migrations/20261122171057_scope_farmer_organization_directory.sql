-- Extend farmer scope isolation to organization directories, not only service cards.
drop policy if exists organizations_verified_read on public.organizations;
drop policy if exists organizations_farmer_scoped_directory on public.organizations;
create policy organizations_farmer_scoped_directory
 on public.organizations for select to authenticated
 using (
  public.is_sarina_admin()
  or exists (
    select 1 from public.organization_members om
    where om.organization_id=organizations.id
      and om.user_id=public.current_sarina_user_id()
      and om.status='active'
  )
  or public.farmer_has_organization_service_scope(organizations.id)
 );
-- Require the root administrative region to be active before it can authorize descendants.
create or replace function public.farmer_has_organization_service_scope(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 with recursive current_farmer as (
  select u.id as user_id from public.users u
  where u.auth_user_id=(select auth.uid()) and (select auth.uid()) is not null limit 1
 ), farmer_farms as (
  select f.id,f.country_id,f.admin_region_id,cf.user_id from public.farms f join current_farmer cf on cf.user_id=f.owner_user_id
 ), authorized_regions(id) as (
  select s.target_admin_region_id
  from public.organization_access_scopes s
  join public.agricultural_admin_regions root on root.id=s.target_admin_region_id and root.is_active=true
  where s.organization_id=p_organization_id and s.scope_type='admin_region'
  union
  select child.id from public.agricultural_admin_regions child
  join authorized_regions parent on child.parent_region_id=parent.id
  where child.is_active=true
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
comment on policy organizations_farmer_scoped_directory on public.organizations is
 'Farmers see only verified organizations with an explicit scope matching one of their own farms; admins and active organization members retain their authorized access.';
