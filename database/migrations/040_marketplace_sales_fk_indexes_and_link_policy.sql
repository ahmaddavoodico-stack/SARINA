-- Consolidate external-link read authorization and index child-side foreign keys.
create index if not exists marketplace_product_external_links_product_seller_idx
  on public.marketplace_product_external_links(product_id, seller_id);
create index if not exists marketplace_sales_leads_product_seller_idx
  on public.marketplace_sales_leads(product_id, seller_id)
  where product_id is not null;
create index if not exists marketplace_sales_tasks_product_seller_idx
  on public.marketplace_sales_tasks(product_id, seller_id)
  where product_id is not null;
create index if not exists marketplace_product_service_needs_product_seller_idx
  on public.marketplace_product_service_needs(product_id, seller_id)
  where product_id is not null;
create index if not exists marketplace_product_service_needs_organization_service_idx
  on public.marketplace_product_service_needs(organization_service_id)
  where organization_service_id is not null;

drop policy if exists marketplace_product_external_links_owner_all on public.marketplace_product_external_links;
drop policy if exists marketplace_product_external_links_public_read on public.marketplace_product_external_links;

create policy marketplace_product_external_links_select
  on public.marketplace_product_external_links for select to anon, authenticated
  using (
    private.marketplace_seller_is_owner(seller_id)
    or (
      is_public
      and exists (
        select 1 from public.marketplace_products p
        where p.id=product_id and p.seller_id=seller_id and p.status='published'
          and private.marketplace_seller_is_verified(p.seller_id)
      )
    )
  );

create policy marketplace_product_external_links_insert
  on public.marketplace_product_external_links for insert to authenticated
  with check (
    private.marketplace_seller_is_owner(seller_id)
    and exists (select 1 from public.marketplace_products p where p.id=product_id and p.seller_id=seller_id)
  );

create policy marketplace_product_external_links_update
  on public.marketplace_product_external_links for update to authenticated
  using (private.marketplace_seller_is_owner(seller_id))
  with check (
    private.marketplace_seller_is_owner(seller_id)
    and exists (select 1 from public.marketplace_products p where p.id=product_id and p.seller_id=seller_id)
  );

create policy marketplace_product_external_links_delete
  on public.marketplace_product_external_links for delete to authenticated
  using (private.marketplace_seller_is_owner(seller_id));
