create table public.agricultural_admin_regions (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete restrict,
  parent_region_id uuid references public.agricultural_admin_regions(id) on delete restrict,
  region_level text not null check (region_level in ('national','province','county','district','service_center')),
  authority_namespace text not null check (length(trim(authority_namespace)) between 2 and 80),
  official_code text not null check (length(trim(official_code)) between 1 and 80),
  display_name text not null check (length(trim(display_name)) between 1 and 180),
  is_active boolean not null default true,
  valid_from date not null default current_date,
  valid_to date,
  source_reference text,
  source_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agricultural_admin_regions_code_unique unique (authority_namespace, official_code),
  constraint agricultural_admin_regions_validity_check check (valid_to is null or valid_to >= valid_from),
  constraint agricultural_admin_regions_not_own_parent check (parent_region_id is null or parent_region_id <> id)
);

create unique index agricultural_admin_regions_national_root_idx
  on public.agricultural_admin_regions(country_id, authority_namespace)
  where region_level = 'national' and parent_region_id is null;
create index agricultural_admin_regions_parent_idx
  on public.agricultural_admin_regions(parent_region_id, is_active);
create index agricultural_admin_regions_country_level_idx
  on public.agricultural_admin_regions(country_id, region_level, is_active);

create or replace function public.validate_agricultural_admin_region_parent()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_parent_level text;
  v_parent_country_id uuid;
  v_parent_namespace text;
  v_cycle boolean;
begin
  if new.parent_region_id is null then
    if new.region_level <> 'national' then
      raise exception 'Only a national administrative region may omit its parent';
    end if;
  else
    select r.region_level, r.country_id, r.authority_namespace
      into v_parent_level, v_parent_country_id, v_parent_namespace
    from public.agricultural_admin_regions r
    where r.id = new.parent_region_id;

    if not found then
      raise exception 'Parent administrative region does not exist';
    end if;

    if v_parent_country_id <> new.country_id then
      raise exception 'Parent and child administrative regions must belong to the same country';
    end if;

    if v_parent_namespace <> new.authority_namespace then
      raise exception 'Parent and child administrative regions must use the same authority namespace';
    end if;

    if not (
      (new.region_level = 'province' and v_parent_level = 'national')
      or (new.region_level = 'county' and v_parent_level = 'province')
      or (new.region_level = 'district' and v_parent_level = 'county')
      or (new.region_level = 'service_center' and v_parent_level in ('county','district'))
    ) then
      raise exception 'Invalid parent level for administrative region level %', new.region_level;
    end if;

    with recursive ancestors(id, parent_region_id) as (
      select r.id, r.parent_region_id
      from public.agricultural_admin_regions r
      where r.id = new.parent_region_id
      union
      select p.id, p.parent_region_id
      from public.agricultural_admin_regions p
      join ancestors a on p.id = a.parent_region_id
    )
    select exists(select 1 from ancestors where id = new.id) into v_cycle;

    if v_cycle then
      raise exception 'Administrative region hierarchy cannot contain a cycle';
    end if;
  end if;

  return new;
end;
$function$;

create trigger agricultural_admin_regions_parent_guard
before insert or update of parent_region_id, region_level, country_id, authority_namespace
on public.agricultural_admin_regions
for each row execute function public.validate_agricultural_admin_region_parent();

revoke all on function public.validate_agricultural_admin_region_parent() from public, anon, authenticated;

alter table public.farms
  add column admin_region_id uuid references public.agricultural_admin_regions(id) on delete restrict;
create index farms_admin_region_id_idx on public.farms(admin_region_id) where admin_region_id is not null;

alter table public.organization_access_scopes
  add column target_admin_region_id uuid references public.agricultural_admin_regions(id) on delete restrict;

alter table public.organization_access_scopes
  drop constraint organization_access_scopes_type_check,
  drop constraint organization_access_scopes_target_check;

alter table public.organization_access_scopes
  add constraint organization_access_scopes_type_check
    check (scope_type = any (array['global','country','user','farm','admin_region'])),
  add constraint organization_access_scopes_target_check
    check (
      (scope_type = 'global' and country_id is null and target_user_id is null and target_farm_id is null and target_admin_region_id is null)
      or (scope_type = 'country' and country_id is not null and target_user_id is null and target_farm_id is null and target_admin_region_id is null)
      or (scope_type = 'user' and target_user_id is not null and country_id is null and target_farm_id is null and target_admin_region_id is null)
      or (scope_type = 'farm' and target_farm_id is not null and country_id is null and target_user_id is null and target_admin_region_id is null)
      or (scope_type = 'admin_region' and target_admin_region_id is not null and country_id is null and target_user_id is null and target_farm_id is null)
    );

create index organization_access_scopes_admin_region_idx
  on public.organization_access_scopes(organization_id, target_admin_region_id)
  where scope_type = 'admin_region';

create or replace function public.organization_has_scoped_access(
  p_organization_id uuid,
  p_capability_code text,
  p_target_user_id uuid default null,
  p_target_country_id uuid default null,
  p_target_farm_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  with recursive authorized_regions(id) as (
    select s.target_admin_region_id
    from public.organization_access_scopes s
    join public.agricultural_admin_regions root_region
      on root_region.id = s.target_admin_region_id
     and root_region.is_active = true
    where s.organization_id = p_organization_id
      and s.scope_type = 'admin_region'
    union
    select child.id
    from public.agricultural_admin_regions child
    join authorized_regions parent_region on child.parent_region_id = parent_region.id
    where child.is_active = true
  )
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.organization_members om
      join public.organization_capabilities oc
        on oc.organization_id = om.organization_id
      join public.organization_access_scopes s
        on s.organization_id = om.organization_id
      where om.organization_id = p_organization_id
        and om.user_id = public.current_sarina_user_id()
        and om.status = 'active'
        and oc.capability_code = p_capability_code
        and oc.is_enabled = true
        and (
          s.scope_type = 'global'
          or (s.scope_type = 'country' and p_target_country_id is not null and s.country_id = p_target_country_id)
          or (s.scope_type = 'user' and p_target_user_id is not null and s.target_user_id = p_target_user_id)
          or (s.scope_type = 'farm' and p_target_farm_id is not null and s.target_farm_id = p_target_farm_id)
          or (
            s.scope_type = 'admin_region'
            and exists (
              select 1
              from public.farms f
              where (
                (p_target_farm_id is not null and f.id = p_target_farm_id)
                or (p_target_farm_id is null and p_target_user_id is not null and f.owner_user_id = p_target_user_id)
              )
                and (p_target_user_id is null or f.owner_user_id = p_target_user_id)
                and f.admin_region_id in (select id from authorized_regions)
            )
          )
        )
    );
$function$;

revoke all on function public.organization_has_scoped_access(uuid,text,uuid,uuid,uuid) from public, anon;
grant execute on function public.organization_has_scoped_access(uuid,text,uuid,uuid,uuid) to authenticated;

create table public.farmer_public_identifiers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  public_code text not null unique
    check (public_code ~ '^SRN-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$'),
  status text not null default 'active' check (status in ('active','suspended','retired')),
  issued_at timestamptz not null default now(),
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  constraint farmer_public_identifiers_retirement_check
    check ((status = 'retired' and retired_at is not null) or (status <> 'retired' and retired_at is null))
);
create unique index farmer_public_identifiers_one_active_per_user_idx
  on public.farmer_public_identifiers(user_id) where status = 'active';
create index farmer_public_identifiers_user_history_idx
  on public.farmer_public_identifiers(user_id, issued_at desc);

alter table public.farmer_public_identifiers enable row level security;
revoke all on public.farmer_public_identifiers from anon, authenticated;
grant select on public.farmer_public_identifiers to authenticated;
create policy farmer_public_identifiers_owner_read
  on public.farmer_public_identifiers
  for select to authenticated
  using (user_id = (select public.current_sarina_user_id()));

create or replace function public.ensure_my_sarina_farmer_identifier()
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_account_status text;
  v_status text;
  v_code text;
begin
  v_user_id := public.current_sarina_user_id();
  if v_user_id is null then
    raise exception 'Authenticated SARINA user profile is required';
  end if;

  select u.account_status into v_account_status
  from public.users u
  where u.id = v_user_id
  for update;

  if not found or v_account_status <> 'active' then
    raise exception 'An active SARINA account is required';
  end if;

  select i.status, i.public_code into v_status, v_code
  from public.farmer_public_identifiers i
  where i.user_id = v_user_id and i.status in ('active','suspended')
  order by i.issued_at desc
  limit 1;

  if v_status = 'active' then
    return v_code;
  elsif v_status = 'suspended' then
    raise exception 'Farmer identifier is suspended; contact SARINA support';
  end if;

  loop
    v_code := 'SRN-' ||
      substr(upper(replace(gen_random_uuid()::text, '-', '')), 1, 4) || '-' ||
      substr(upper(replace(gen_random_uuid()::text, '-', '')), 5, 4) || '-' ||
      substr(upper(replace(gen_random_uuid()::text, '-', '')), 9, 4) || '-' ||
      substr(upper(replace(gen_random_uuid()::text, '-', '')), 13, 4);
    insert into public.farmer_public_identifiers(user_id, public_code)
    values (v_user_id, v_code)
    on conflict (public_code) do nothing;
    if found then
      return v_code;
    end if;
  end loop;
end;
$function$;

revoke all on function public.ensure_my_sarina_farmer_identifier() from public, anon;
grant execute on function public.ensure_my_sarina_farmer_identifier() to authenticated;

create table public.farmer_authority_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  granted_by_user_id uuid not null references public.users(id) on delete restrict,
  consent_scopes text[] not null
    check (
      cardinality(consent_scopes) > 0
      and consent_scopes <@ array[
        'identity_summary','farm_summary','assigned_specialist',
        'institutional_support_history','productivity_metrics',
        'outcome_summary','directive_delivery'
      ]::text[]
    ),
  purpose_code text not null check (length(trim(purpose_code)) between 3 and 100),
  consent_version text not null check (length(trim(consent_version)) between 1 and 40),
  status text not null default 'active' check (status in ('active','revoked','expired')),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint farmer_authority_consents_expiry_check check (expires_at is null or expires_at > granted_at),
  constraint farmer_authority_consents_revocation_check
    check ((status = 'revoked' and revoked_at is not null) or (status <> 'revoked' and revoked_at is null))
);
create unique index farmer_authority_consents_one_active_purpose_idx
  on public.farmer_authority_consents(user_id, organization_id, purpose_code)
  where status = 'active';
create index farmer_authority_consents_org_active_idx
  on public.farmer_authority_consents(organization_id, user_id, expires_at)
  where status = 'active';
create index farmer_authority_consents_user_history_idx
  on public.farmer_authority_consents(user_id, created_at desc);

alter table public.farmer_authority_consents enable row level security;
revoke all on public.farmer_authority_consents from anon, authenticated;
grant select, insert, update on public.farmer_authority_consents to authenticated;

create policy farmer_authority_consents_owner_read
  on public.farmer_authority_consents
  for select to authenticated
  using (user_id = (select public.current_sarina_user_id()));

create policy farmer_authority_consents_owner_grant
  on public.farmer_authority_consents
  for insert to authenticated
  with check (
    user_id = (select public.current_sarina_user_id())
    and granted_by_user_id = (select public.current_sarina_user_id())
    and status = 'active'
    and exists (
      select 1 from public.organizations o
      where o.id = farmer_authority_consents.organization_id
        and o.status = 'verified'
        and o.organization_type in ('government','regulator','support_agency','public_institution')
    )
  );

create policy farmer_authority_consents_owner_revoke
  on public.farmer_authority_consents
  for update to authenticated
  using (
    user_id = (select public.current_sarina_user_id())
    and status = 'active'
  )
  with check (
    user_id = (select public.current_sarina_user_id())
    and status = 'revoked'
    and revoked_at is not null
  );

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
   and public.organization_has_scoped_access(p_organization_id, 'oversight.farm.read', u.id, u.country_id, f.id)
  left join public.agricultural_admin_regions r on r.id = f.admin_region_id
  where i.public_code = upper(trim(p_public_code))
    and i.status = 'active'
    and public.organization_has_scoped_access(p_organization_id, 'farmer.identity.read', u.id, u.country_id, null)
  group by i.public_code, u.full_name, u.country_id, c.consent_scopes, c.expires_at;
$function$;

revoke all on function public.lookup_farmer_by_public_code(uuid,text) from public, anon;
grant execute on function public.lookup_farmer_by_public_code(uuid,text) to authenticated;

alter table public.agricultural_admin_regions enable row level security;
revoke all on public.agricultural_admin_regions from anon, authenticated;
grant select on public.agricultural_admin_regions to authenticated;
grant all on public.agricultural_admin_regions to service_role;
create policy agricultural_admin_regions_active_read
  on public.agricultural_admin_regions
  for select to authenticated
  using (is_active = true);

comment on table public.agricultural_admin_regions is
  'Official agricultural administrative geography. Separate from deployment_regions, which only models infrastructure/data residency.';
comment on column public.farms.admin_region_id is
  'Verified agricultural administrative region; distinct from the technical home_region_id.';
comment on column public.organization_access_scopes.target_admin_region_id is
  'Root administrative region for an organization scope; descendants are resolved server-side.';
comment on table public.farmer_public_identifiers is
  'Opaque, non-secret SARINA farmer lookup codes. Never use as an authentication credential or official government ID.';
comment on table public.farmer_authority_consents is
  'Farmer-granted, organization-specific, purpose-limited data sharing consent with revocation history.';
