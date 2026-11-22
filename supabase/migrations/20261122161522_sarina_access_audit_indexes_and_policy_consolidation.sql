create index if not exists institutional_access_audit_farm_time_idx
  on public.institutional_access_audit_events(resource_farm_id,created_at desc)
  where resource_farm_id is not null;
create index if not exists institutional_access_audit_country_time_idx
  on public.institutional_access_audit_events(country_id,created_at desc)
  where country_id is not null;

drop policy if exists institutional_access_audit_admin_read on public.institutional_access_audit_events;
drop policy if exists institutional_access_audit_org_scoped_read on public.institutional_access_audit_events;

create policy institutional_access_audit_select
  on public.institutional_access_audit_events
  for select to authenticated
  using (
    (select public.is_sarina_admin())
    or public.organization_has_scoped_access(
      organization_id,
      'oversight.audit.read',
      resource_user_id,
      country_id,
      resource_farm_id
    )
  );