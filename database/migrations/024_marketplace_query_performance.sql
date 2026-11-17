create index marketplace_cart_product_idx on public.marketplace_cart_items(product_id);
create index marketplace_order_items_product_idx on public.marketplace_order_items(product_id);
create index marketplace_payment_events_order_idx on public.marketplace_payment_events(order_id);
create index marketplace_products_category_idx on public.marketplace_products(category_id);
create index marketplace_quotes_product_idx on public.marketplace_quote_requests(product_id);
create index marketplace_sellers_organization_idx on public.marketplace_sellers(organization_id);
create index marketplace_shipments_seller_idx on public.marketplace_shipments(seller_id);

drop policy if exists marketplace_products_read on public.marketplace_products;
create policy marketplace_products_read on public.marketplace_products for select to anon,authenticated using(
 (status='published' and private.marketplace_seller_is_verified(seller_id)) or
 ((select auth.uid()) is not null and private.marketplace_seller_is_owner(seller_id))
);
