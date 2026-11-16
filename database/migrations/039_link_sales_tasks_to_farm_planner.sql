-- Link sales work to the farmer's farm planner without exposing another user's farm.
alter table public.marketplace_sales_tasks
  add column if not exists farm_id uuid references public.farms(id) on delete set null;
create index if not exists marketplace_sales_tasks_farm_due_idx
  on public.marketplace_sales_tasks(farm_id, due_at, status) where farm_id is not null;
drop policy if exists marketplace_sales_tasks_owner_all on public.marketplace_sales_tasks;
create policy marketplace_sales_tasks_owner_all on public.marketplace_sales_tasks for all to authenticated
  using (private.marketplace_seller_is_owner(seller_id))
  with check (
    private.marketplace_seller_is_owner(seller_id)
    and (product_id is null or exists (select 1 from public.marketplace_products p where p.id=product_id and p.seller_id=seller_id))
    and (lead_id is null or exists (select 1 from public.marketplace_sales_leads l where l.id=lead_id and l.seller_id=seller_id))
    and (farm_id is null or exists (
      select 1 from public.farms f where f.id=farm_id
        and f.owner_user_id=(select u.id from public.users u where u.auth_user_id=(select auth.uid()))
    ))
  );
