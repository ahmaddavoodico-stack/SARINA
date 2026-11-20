create schema if not exists private;
create or replace function private.marketplace_seller_is_verified(p_seller_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.marketplace_sellers s where s.id=p_seller_id and s.verification_status='verified');
$$;
create or replace function private.marketplace_seller_is_owner(p_seller_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.marketplace_sellers s join public.users u on u.id=s.owner_user_id where s.id=p_seller_id and u.auth_user_id=(select auth.uid()));
$$;
grant usage on schema private to anon,authenticated;
grant execute on function private.marketplace_seller_is_verified(uuid) to anon,authenticated;
grant execute on function private.marketplace_seller_is_owner(uuid) to authenticated;
revoke all on function private.marketplace_seller_is_verified(uuid) from public;
revoke all on function private.marketplace_seller_is_owner(uuid) from public;

drop policy if exists marketplace_sellers_read on public.marketplace_sellers;
create policy marketplace_sellers_read on public.marketplace_sellers for select to authenticated using(verification_status='verified' or private.marketplace_seller_is_owner(id));
drop policy if exists marketplace_sellers_insert on public.marketplace_sellers;
create policy marketplace_sellers_insert on public.marketplace_sellers for insert to authenticated with check(
 verification_status='pending' and exists(select 1 from public.users u where u.id=owner_user_id and u.auth_user_id=(select auth.uid()))
 and ((seller_type='farmer' and organization_id is null) or
 (seller_type='company' and exists(select 1 from public.organization_members om where om.organization_id=marketplace_sellers.organization_id and om.user_id=marketplace_sellers.owner_user_id and om.status='active')))
);
drop policy if exists marketplace_products_public_read on public.marketplace_products;
create policy marketplace_products_public_read on public.marketplace_products for select to anon,authenticated using(status='published' and private.marketplace_seller_is_verified(seller_id));
drop policy if exists marketplace_products_owner_read on public.marketplace_products;
create policy marketplace_products_owner_read on public.marketplace_products for select to authenticated using(private.marketplace_seller_is_owner(seller_id));
drop policy if exists marketplace_products_owner_insert on public.marketplace_products;
create policy marketplace_products_owner_insert on public.marketplace_products for insert to authenticated with check(
 private.marketplace_seller_is_owner(seller_id) and
 exists(select 1 from public.marketplace_categories c where c.id=marketplace_products.category_id and c.market_section=marketplace_products.market_section and c.is_active) and
 (status<>'published' or private.marketplace_seller_is_verified(seller_id))
);
drop policy if exists marketplace_products_owner_update on public.marketplace_products;
create policy marketplace_products_owner_update on public.marketplace_products for update to authenticated using(private.marketplace_seller_is_owner(seller_id)) with check(
 private.marketplace_seller_is_owner(seller_id) and
 exists(select 1 from public.marketplace_categories c where c.id=marketplace_products.category_id and c.market_section=marketplace_products.market_section and c.is_active) and
 (status<>'published' or private.marketplace_seller_is_verified(seller_id))
);
drop policy if exists marketplace_products_owner_delete on public.marketplace_products;
create policy marketplace_products_owner_delete on public.marketplace_products for delete to authenticated using(private.marketplace_seller_is_owner(seller_id) and status='draft');
drop policy if exists marketplace_cart_owner_all on public.marketplace_cart_items;
create policy marketplace_cart_owner_all on public.marketplace_cart_items for all to authenticated using(
 exists(select 1 from public.users u where u.id=buyer_user_id and u.auth_user_id=(select auth.uid()))
) with check(
 exists(select 1 from public.users u where u.id=buyer_user_id and u.auth_user_id=(select auth.uid()))
 and exists(select 1 from public.marketplace_products p where p.id=product_id and p.status='published' and p.pricing_model='fixed' and private.marketplace_seller_is_verified(p.seller_id))
);
drop policy if exists marketplace_orders_participant_read on public.marketplace_orders;
create policy marketplace_orders_participant_read on public.marketplace_orders for select to authenticated using(
 exists(select 1 from public.users u where u.id=buyer_user_id and u.auth_user_id=(select auth.uid())) or private.marketplace_seller_is_owner(seller_id)
);
drop policy if exists marketplace_order_items_participant_read on public.marketplace_order_items;
create policy marketplace_order_items_participant_read on public.marketplace_order_items for select to authenticated using(
 exists(select 1 from public.marketplace_orders o join public.users u on u.id=o.buyer_user_id where o.id=order_id and u.auth_user_id=(select auth.uid())) or
 exists(select 1 from public.marketplace_orders o where o.id=order_id and private.marketplace_seller_is_owner(o.seller_id))
);
drop policy if exists marketplace_invoices_participant_read on public.marketplace_invoices;
create policy marketplace_invoices_participant_read on public.marketplace_invoices for select to authenticated using(
 exists(select 1 from public.marketplace_orders o join public.users u on u.id=o.buyer_user_id where o.id=order_id and u.auth_user_id=(select auth.uid())) or
 exists(select 1 from public.marketplace_orders o where o.id=order_id and private.marketplace_seller_is_owner(o.seller_id))
);
drop policy if exists marketplace_shipments_participant_read on public.marketplace_shipments;
create policy marketplace_shipments_participant_read on public.marketplace_shipments for select to authenticated using(
 exists(select 1 from public.marketplace_orders o join public.users u on u.id=o.buyer_user_id where o.id=order_id and u.auth_user_id=(select auth.uid())) or private.marketplace_seller_is_owner(seller_id)
);
drop policy if exists marketplace_shipments_seller_insert on public.marketplace_shipments;
create policy marketplace_shipments_seller_insert on public.marketplace_shipments for insert to authenticated with check(private.marketplace_seller_is_owner(seller_id) and exists(select 1 from public.marketplace_orders o where o.id=order_id and o.seller_id=marketplace_shipments.seller_id));
drop policy if exists marketplace_shipments_seller_update on public.marketplace_shipments;
create policy marketplace_shipments_seller_update on public.marketplace_shipments for update to authenticated using(private.marketplace_seller_is_owner(seller_id)) with check(private.marketplace_seller_is_owner(seller_id) and exists(select 1 from public.marketplace_orders o where o.id=order_id and o.seller_id=marketplace_shipments.seller_id));
drop policy if exists marketplace_quotes_participant_read on public.marketplace_quote_requests;
create policy marketplace_quotes_participant_read on public.marketplace_quote_requests for select to authenticated using(
 exists(select 1 from public.users u where u.id=buyer_user_id and u.auth_user_id=(select auth.uid())) or private.marketplace_seller_is_owner(seller_id)
);
revoke select on public.marketplace_sellers from anon;
grant select on public.marketplace_sellers to authenticated;
