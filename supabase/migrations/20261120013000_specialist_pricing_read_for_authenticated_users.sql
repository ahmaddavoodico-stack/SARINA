begin;
drop policy if exists specialist_workspace_pricing_authenticated_read on public.specialist_workspace_pricing;
create policy specialist_workspace_pricing_authenticated_read
  on public.specialist_workspace_pricing for select to authenticated using (true);
comment on policy specialist_workspace_pricing_authenticated_read on public.specialist_workspace_pricing is
  'Specialists may read workspace pricing and credit allowance configuration; only central admins may update it.';
commit;