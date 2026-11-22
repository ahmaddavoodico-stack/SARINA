create or replace function public.lookup_farmer_by_public_code(
  p_organization_id uuid,
  p_public_code text
)
returns table (
  farmer_code text,
  farmer_name text,
  country_id uuid,
  visible_farm_count bigint,
  administrative_regions text[],
  consent_scopes text[],
  consent_expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    i.public_code,
    u.full_name,
    u.country_id,
    count(f.id)::bigint,
    coalesce(array_agg(distinct r.display_name) filter (where r.id is not null), array[]::text[]),
    c.consent_scopes,
    c.expires_at
  from public.farmer_public_identifiers i
  join public.users u on u.id = i.user_id and u.account_status = 'active'
  join public.farmer_authority_consents c
    on c.user_id = u.id
   and c.organization_id = p_organization_id
   and c.status = 'active'
   and (c.expires_at is null or c.expires_at > now())
   and 'identity_summary' = any(c.consent_scopes)
  left join public.farms f
    on f.owner_user_id = u.id
   and f.status = 'active'
   and 'farm_summary' = any(c.consent_scopes)
   and public.organization_has_scoped_access(p_organization_id, 'oversight.farm.read', u.id, u.country_id, f.id)
  left join public.agricultural_admin_regions r
    on r.id = f.admin_region_id
   and 'farm_summary' = any(c.consent_scopes)
  where i.public_code = upper(trim(p_public_code))
    and i.status = 'active'
    and public.organization_has_scoped_access(p_organization_id, 'farmer.identity.read', u.id, u.country_id, null)
  group by i.public_code, u.full_name, u.country_id, c.consent_scopes, c.expires_at;
$function$;

revoke all on function public.lookup_farmer_by_public_code(uuid,text) from public, anon;
grant execute on function public.lookup_farmer_by_public_code(uuid,text) to authenticated;

revoke update on public.farmer_authority_consents from authenticated;
drop policy if exists farmer_authority_consents_owner_revoke on public.farmer_authority_consents;

drop policy if exists farmer_authority_consents_owner_grant on public.farmer_authority_consents;
create policy farmer_authority_consents_owner_grant
  on public.farmer_authority_consents
  for insert to authenticated
  with check (
    user_id = (select public.current_sarina_user_id())
    and granted_by_user_id = (select public.current_sarina_user_id())
    and status = 'active'
    and (expires_at is null or expires_at > now())
    and purpose_code = 'jihad_farmer_support_oversight'
    and exists (
      select 1 from public.organizations o
      where o.id = farmer_authority_consents.organization_id
        and o.status = 'verified'
        and o.organization_type in ('government','regulator','support_agency','public_institution')
    )
  );

create or replace function public.revoke_my_farmer_authority_consent(p_consent_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_rows integer;
begin
  v_user_id := public.current_sarina_user_id();
  if v_user_id is null then
    raise exception 'Authenticated SARINA user profile is required';
  end if;

  update public.farmer_authority_consents
     set status = 'revoked',
         revoked_at = now()
   where id = p_consent_id
     and user_id = v_user_id
     and status = 'active';

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$function$;

revoke all on function public.revoke_my_farmer_authority_consent(uuid) from public, anon;
grant execute on function public.revoke_my_farmer_authority_consent(uuid) to authenticated;
