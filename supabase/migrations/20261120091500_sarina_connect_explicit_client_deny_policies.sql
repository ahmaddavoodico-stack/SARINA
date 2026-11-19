-- Explicit deny policies make the server-only boundary visible to the RLS advisor.
begin;
create policy sarina_connect_routes_deny_client_access
  on public.sarina_connect_channel_routes for all to anon, authenticated
  using (false) with check (false);
create policy sarina_connect_delivery_deny_client_access
  on public.sarina_connect_delivery_jobs for all to anon, authenticated
  using (false) with check (false);
create policy sarina_connect_events_deny_client_access
  on public.sarina_connect_provider_events for all to anon, authenticated
  using (false) with check (false);
create policy sarina_connect_consent_deny_client_access
  on public.sarina_connect_consent_events for all to anon, authenticated
  using (false) with check (false);
commit;