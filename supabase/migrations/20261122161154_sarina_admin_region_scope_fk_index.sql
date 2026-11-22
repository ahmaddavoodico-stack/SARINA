create index if not exists organization_access_scopes_target_admin_region_id_idx
  on public.organization_access_scopes(target_admin_region_id)
  where target_admin_region_id is not null;