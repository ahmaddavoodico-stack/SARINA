drop policy if exists marketplace_products_public_read on public.marketplace_products;
drop policy if exists marketplace_products_owner_read on public.marketplace_products;
create policy marketplace_products_read on public.marketplace_products for select to anon,authenticated using(
 (status='published' and private.marketplace_seller_is_verified(seller_id)) or
 (auth.uid() is not null and private.marketplace_seller_is_owner(seller_id))
);
create policy marketplace_payment_events_service_all on public.marketplace_payment_events
 for all to service_role using(true) with check(true);
