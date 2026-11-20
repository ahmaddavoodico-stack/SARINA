drop policy if exists organization_profiles_deny_client_access on public.organization_profiles;
create policy organization_profiles_deny_client_access
on public.organization_profiles
for all to anon, authenticated
using (false)
with check (false);
