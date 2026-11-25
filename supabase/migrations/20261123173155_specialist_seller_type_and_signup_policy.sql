-- Give specialists a dedicated seller type and enforce the signup declaration at the database boundary.
alter table public.marketplace_sellers drop constraint if exists marketplace_sellers_check;
alter table public.marketplace_sellers
  add constraint marketplace_sellers_check
  check (
    ((seller_type in ('farmer','individual','specialist')) and organization_id is null)
    or (seller_type = 'company' and organization_id is not null)
  );

alter table public.marketplace_sellers drop constraint if exists marketplace_sellers_seller_type_check;
alter table public.marketplace_sellers
  add constraint marketplace_sellers_seller_type_check
  check (seller_type = any (array['farmer','company','individual','specialist']::text[]));

drop policy if exists marketplace_sellers_insert on public.marketplace_sellers;
create policy marketplace_sellers_insert
on public.marketplace_sellers
for insert
to authenticated
with check (
  verification_status = 'pending'
  and exists (
    select 1 from public.users u
    where u.id = marketplace_sellers.owner_user_id
      and u.auth_user_id = (select auth.uid())
  )
  and (
    (seller_type = 'farmer' and organization_id is null)
    or (seller_type = 'individual' and organization_id is null)
    or (
      seller_type = 'specialist'
      and organization_id is null
      and exists (
        select 1
        from public.users u
        join public.expert_profiles ep on ep.user_id = u.id
        where u.id = marketplace_sellers.owner_user_id
          and u.auth_user_id = (select auth.uid())
          and u.has_shop is true
      )
    )
    or (seller_type = 'company' and private.marketplace_has_active_org_membership(organization_id, owner_user_id))
  )
);

drop policy if exists marketplace_sellers_update on public.marketplace_sellers;
create policy marketplace_sellers_update
on public.marketplace_sellers
for update
to authenticated
using (private.marketplace_seller_is_owner(id))
with check (
  private.marketplace_seller_is_owner(id)
  and (
    (seller_type = 'farmer' and organization_id is null)
    or (seller_type = 'individual' and organization_id is null)
    or (
      seller_type = 'specialist'
      and organization_id is null
      and exists (
        select 1
        from public.users u
        join public.expert_profiles ep on ep.user_id = u.id
        where u.id = marketplace_sellers.owner_user_id
          and u.auth_user_id = (select auth.uid())
          and u.has_shop is true
      )
    )
    or (seller_type = 'company' and private.marketplace_has_active_org_membership(organization_id, owner_user_id))
  )
);

create or replace function private.marketplace_seller_section_matches(p_seller_id uuid, p_section text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.marketplace_sellers s
    where s.id = p_seller_id
      and (
        (s.seller_type = 'farmer' and p_section = 'farmer_products')
        or (s.seller_type in ('company','specialist') and p_section = 'company_supplies')
      )
  );
$function$;

comment on function private.marketplace_seller_section_matches(uuid, text)
is 'Maps farmer sellers to farmer produce and company or approved specialist sellers to agricultural supplies.';
