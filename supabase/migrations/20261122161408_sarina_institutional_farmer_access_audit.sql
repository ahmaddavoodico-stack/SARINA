create table public.institutional_access_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_user_id uuid not null references public.users(id) on delete restrict,
  action_code text not null check (action_code in ('farmer.identity.lookup','farmer.profile.view','farmer.support.view','farmer.productivity.view','institutional.directive.publish','institutional.recognition.issue','institutional.report.export')),
  resource_type text not null check (resource_type in ('farmer_profile','farm','support_record','directive','recognition','report')),
  resource_user_id uuid references public.users(id) on delete set null,
  resource_farm_id uuid references public.farms(id) on delete set null,
  country_id uuid references public.countries(id) on delete set null,
  purpose_code text not null,
  access_decision text not null check (access_decision in ('granted','not_found','invalid_request','consent_missing_or_expired','scope_denied','capability_denied')),
  request_id uuid not null default gen_random_uuid(),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=4096),
  created_at timestamptz not null default now()
);

create index institutional_access_audit_org_time_idx
  on public.institutional_access_audit_events(organization_id,created_at desc);
create index institutional_access_audit_actor_time_idx
  on public.institutional_access_audit_events(actor_user_id,created_at desc);
create index institutional_access_audit_subject_time_idx
  on public.institutional_access_audit_events(resource_user_id,created_at desc)
  where resource_user_id is not null;

alter table public.institutional_access_audit_events enable row level security;
revoke all on public.institutional_access_audit_events from anon,authenticated;
grant select on public.institutional_access_audit_events to authenticated;
grant all on public.institutional_access_audit_events to service_role;

create policy institutional_access_audit_admin_read
  on public.institutional_access_audit_events
  for select to authenticated
  using ((select public.is_sarina_admin()));

create policy institutional_access_audit_org_scoped_read
  on public.institutional_access_audit_events
  for select to authenticated
  using (
    public.organization_has_scoped_access(
      organization_id,
      'oversight.audit.read',
      resource_user_id,
      country_id,
      resource_farm_id
    )
  );

alter table public.organization_capabilities
  drop constraint organization_capabilities_code_check;
alter table public.organization_capabilities
  add constraint organization_capabilities_code_check
  check (capability_code = any (array[
    'oversight.farmer.read',
    'oversight.farm.read',
    'oversight.expert.read',
    'oversight.productivity.read',
    'oversight.audit.read',
    'farmer.identity.read',
    'farmer.profile.summary.read',
    'oversight.support.read',
    'oversight.support.manage',
    'oversight.directive.publish',
    'oversight.directive.review',
    'oversight.recognition.issue',
    'oversight.reports.export',
    'farmer_credential.review',
    'expert_credential.review',
    'farmer_award.issue',
    'expert_award.issue',
    'reports.view',
    'services.manage',
    'service.requests.manage',
    'authority.registry.manage',
    'integrations.manage'
  ]));

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
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid;
  v_public_code text;
  v_target_user_id uuid;
  v_farmer_name text;
  v_country_id uuid;
  v_consent_scopes text[];
  v_consent_expires_at timestamptz;
  v_purpose_code text := 'jihad_farmer_support_oversight';
  v_farm_count bigint := 0;
  v_regions text[] := array[]::text[];
begin
  v_actor_user_id := public.current_sarina_user_id();
  if v_actor_user_id is null or (select auth.uid()) is null then
    raise exception 'Authenticated SARINA organization user is required';
  end if;

  if p_organization_id is null or not exists (
    select 1 from public.organizations o
    where o.id = p_organization_id
      and o.status = 'verified'
      and o.organization_type in ('government','regulator','support_agency','public_institution')
  ) then
    return;
  end if;

  v_public_code := upper(trim(coalesce(p_public_code,'')));
  if v_public_code !~ '^SRN-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$' then
    insert into public.institutional_access_audit_events(
      organization_id,actor_user_id,action_code,resource_type,purpose_code,access_decision
    ) values (
      p_organization_id,v_actor_user_id,'farmer.identity.lookup','farmer_profile',
      v_purpose_code,'invalid_request'
    );
    return;
  end if;

  select i.user_id,u.full_name,u.country_id
    into v_target_user_id,v_farmer_name,v_country_id
  from public.farmer_public_identifiers i
  join public.users u on u.id=i.user_id and u.account_status='active'
  where i.public_code=v_public_code and i.status='active'
  limit 1;

  if not found then
    insert into public.institutional_access_audit_events(
      organization_id,actor_user_id,action_code,resource_type,purpose_code,access_decision
    ) values (
      p_organization_id,v_actor_user_id,'farmer.identity.lookup','farmer_profile',
      v_purpose_code,'not_found'
    );
    return;
  end if;

  select c.consent_scopes,c.expires_at,c.purpose_code
    into v_consent_scopes,v_consent_expires_at,v_purpose_code
  from public.farmer_authority_consents c
  where c.user_id=v_target_user_id
    and c.organization_id=p_organization_id
    and c.status='active'
    and (c.expires_at is null or c.expires_at>now())
    and 'identity_summary'=any(c.consent_scopes)
  order by c.granted_at desc
  limit 1;

  if not found then
    insert into public.institutional_access_audit_events(
      organization_id,actor_user_id,action_code,resource_type,resource_user_id,country_id,purpose_code,access_decision
    ) values (
      p_organization_id,v_actor_user_id,'farmer.identity.lookup','farmer_profile',
      v_target_user_id,v_country_id,'jihad_farmer_support_oversight','consent_missing_or_expired'
    );
    return;
  end if;

  if not public.organization_has_scoped_access(
    p_organization_id,'farmer.identity.read',v_target_user_id,v_country_id,null
  ) then
    insert into public.institutional_access_audit_events(
      organization_id,actor_user_id,action_code,resource_type,resource_user_id,country_id,purpose_code,access_decision
    ) values (
      p_organization_id,v_actor_user_id,'farmer.identity.lookup','farmer_profile',
      v_target_user_id,v_country_id,v_purpose_code,'scope_denied'
    );
    return;
  end if;

  if 'farm_summary'=any(v_consent_scopes) then
    select count(f.id)::bigint,
      coalesce(array_agg(distinct r.display_name) filter (where r.id is not null),array[]::text[])
      into v_farm_count,v_regions
    from public.farms f
    left join public.agricultural_admin_regions r on r.id=f.admin_region_id
    where f.owner_user_id=v_target_user_id
      and f.status='active'
      and public.organization_has_scoped_access(
        p_organization_id,'oversight.farm.read',v_target_user_id,v_country_id,f.id
      );
  end if;

  insert into public.institutional_access_audit_events(
    organization_id,actor_user_id,action_code,resource_type,resource_user_id,country_id,purpose_code,access_decision
  ) values (
    p_organization_id,v_actor_user_id,'farmer.identity.lookup','farmer_profile',
    v_target_user_id,v_country_id,v_purpose_code,'granted'
  );

  return query
  select v_public_code,v_farmer_name,v_country_id,v_farm_count,v_regions,v_consent_scopes,v_consent_expires_at;
end;
$function$;

revoke all on function public.lookup_farmer_by_public_code(uuid,text) from public,anon;
grant execute on function public.lookup_farmer_by_public_code(uuid,text) to authenticated;

comment on table public.institutional_access_audit_events is
  'Private append-only audit of organization access to farmer identity and institutional resources. Raw farmer codes and message contents are never stored.';