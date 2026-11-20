alter table public.marketplace_products
 add column regulatory_status text not null default 'not_reviewed' check(regulatory_status in ('not_reviewed','pending_review','verified','rejected')),
 add column regulatory_reviewed_at timestamptz;
alter table public.marketplace_orders
 add column reservation_expires_at timestamptz not null default(now()+interval '30 minutes');
create index marketplace_orders_reservation_idx on public.marketplace_orders(status,reservation_expires_at) where status='awaiting_payment';

create or replace function private.marketplace_seller_section_matches(p_seller_id uuid,p_section text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.marketplace_sellers s where s.id=p_seller_id and
 ((s.seller_type='farmer' and p_section='farmer_products') or (s.seller_type='company' and p_section='company_supplies')));
$$;
grant execute on function private.marketplace_seller_section_matches(uuid,text) to authenticated;
revoke all on function private.marketplace_seller_section_matches(uuid,text) from public;

drop policy if exists marketplace_sellers_update on public.marketplace_sellers;
create policy marketplace_sellers_update on public.marketplace_sellers for update to authenticated
using(private.marketplace_seller_is_owner(id))
with check(private.marketplace_seller_is_owner(id) and
 ((seller_type='farmer' and organization_id is null) or
 (seller_type='company' and exists(select 1 from public.organization_members om where om.organization_id=marketplace_sellers.organization_id and om.user_id=marketplace_sellers.owner_user_id and om.status='active'))));
revoke update(seller_type,owner_user_id,organization_id,verification_status,verification_notes) on public.marketplace_sellers from authenticated;

drop policy if exists marketplace_products_owner_insert on public.marketplace_products;
create policy marketplace_products_owner_insert on public.marketplace_products for insert to authenticated with check(
 private.marketplace_seller_is_owner(seller_id) and private.marketplace_seller_section_matches(seller_id,market_section) and
 exists(select 1 from public.marketplace_categories c where c.id=marketplace_products.category_id and c.market_section=marketplace_products.market_section and c.is_active) and
 (status<>'published' or (private.marketplace_seller_is_verified(seller_id) and
  (not regulated and not exists(select 1 from public.marketplace_categories c where c.id=category_id and c.code='crop_protection') or regulatory_status='verified')))
);
drop policy if exists marketplace_products_owner_update on public.marketplace_products;
create policy marketplace_products_owner_update on public.marketplace_products for update to authenticated using(private.marketplace_seller_is_owner(seller_id)) with check(
 private.marketplace_seller_is_owner(seller_id) and private.marketplace_seller_section_matches(seller_id,market_section) and
 exists(select 1 from public.marketplace_categories c where c.id=marketplace_products.category_id and c.market_section=marketplace_products.market_section and c.is_active) and
 (status<>'published' or (private.marketplace_seller_is_verified(seller_id) and
  (not regulated and not exists(select 1 from public.marketplace_categories c where c.id=category_id and c.code='crop_protection') or regulatory_status='verified')))
);
revoke insert(regulatory_status,regulatory_reviewed_at) on public.marketplace_products from authenticated;
revoke update(regulatory_status,regulatory_reviewed_at) on public.marketplace_products from authenticated;

create or replace function public.create_marketplace_order(p_seller_id uuid,p_shipping_address jsonb,p_buyer_note text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_buyer_id uuid; v_seller public.marketplace_sellers%rowtype; v_order_id uuid;
 v_currency char(3); v_subtotal numeric(18,4):=0; v_item record; v_line numeric(18,4); v_invoice_number text; v_expired record;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select id into v_buyer_id from public.users where auth_user_id=auth.uid() and account_status='active';
 if v_buyer_id is null then raise exception 'Active SARINA profile required'; end if;
 if jsonb_typeof(p_shipping_address)<>'object' or
  length(trim(coalesce(p_shipping_address->>'recipient','')))<2 or
  length(trim(coalesce(p_shipping_address->>'phone','')))<5 or
  length(trim(coalesce(p_shipping_address->>'address','')))<5 or
  length(trim(coalesce(p_shipping_address->>'city','')))<2 or
  length(trim(coalesce(p_shipping_address->>'country','')))<2 then
  raise exception 'Complete shipping recipient, phone, address, city and country';
 end if;
 for v_expired in
  select o.id,oi.product_id,oi.quantity from public.marketplace_orders o
  join public.marketplace_order_items oi on oi.order_id=o.id
  where o.status='awaiting_payment' and o.payment_status='unpaid' and o.reservation_expires_at<now()
  for update of o
 loop
  update public.marketplace_products set reserved_qty=greatest(0,reserved_qty-v_expired.quantity) where id=v_expired.product_id;
 end loop;
 update public.marketplace_orders set status='cancelled',fulfillment_status='not_arranged'
 where status='awaiting_payment' and payment_status='unpaid' and reservation_expires_at<now();
 select * into v_seller from public.marketplace_sellers where id=p_seller_id and verification_status='verified';
 if not found then raise exception 'Seller is not verified or unavailable'; end if;
 if not exists(select 1 from public.marketplace_cart_items where buyer_user_id=v_buyer_id) then raise exception 'Cart is empty'; end if;
 if exists(select 1 from public.marketplace_cart_items c join public.marketplace_products p on p.id=c.product_id where c.buyer_user_id=v_buyer_id and p.seller_id<>p_seller_id) then raise exception 'Checkout one seller at a time'; end if;
 if exists(select 1 from public.marketplace_cart_items c join public.marketplace_products p on p.id=c.product_id join public.marketplace_categories cat on cat.id=p.category_id
  where c.buyer_user_id=v_buyer_id and (p.seller_id<>p_seller_id or p.status<>'published' or p.pricing_model<>'fixed' or p.price is null or p.stock_qty is null or c.quantity<p.minimum_order_qty or ((p.regulated or cat.code='crop_protection') and p.regulatory_status<>'verified'))) then
  raise exception 'One or more cart items are not orderable';
 end if;
 select min(p.currency),sum(p.price*c.quantity) into v_currency,v_subtotal from public.marketplace_cart_items c join public.marketplace_products p on p.id=c.product_id where c.buyer_user_id=v_buyer_id and p.seller_id=p_seller_id;
 if exists(select 1 from public.marketplace_cart_items c join public.marketplace_products p on p.id=c.product_id where c.buyer_user_id=v_buyer_id and p.seller_id=p_seller_id and p.currency<>v_currency) then raise exception 'All items in one order must use the same currency'; end if;
 if v_subtotal is null or v_subtotal<=0 then raise exception 'Invalid order total'; end if;
 for v_item in select c.product_id,c.quantity,p.name from public.marketplace_cart_items c join public.marketplace_products p on p.id=c.product_id where c.buyer_user_id=v_buyer_id and p.seller_id=p_seller_id for update of p loop
  update public.marketplace_products set reserved_qty=reserved_qty+v_item.quantity where id=v_item.product_id and stock_qty-reserved_qty>=v_item.quantity;
  if not found then raise exception 'Insufficient available stock for product %',v_item.name; end if;
 end loop;
 insert into public.marketplace_orders(order_number,buyer_user_id,seller_id,currency,subtotal,total_amount,shipping_address,buyer_note,reservation_expires_at)
 values('SAR-MKT-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),v_buyer_id,p_seller_id,v_currency,v_subtotal,v_subtotal,p_shipping_address,nullif(trim(p_buyer_note),''),now()+interval '30 minutes')
 returning id into v_order_id;
 for v_item in select c.product_id,c.quantity,p.name,p.sku,p.unit_label,p.price,p.specifications,p.category_id,p.market_section,p.origin_country,p.quality_grade from public.marketplace_cart_items c join public.marketplace_products p on p.id=c.product_id where c.buyer_user_id=v_buyer_id and p.seller_id=p_seller_id loop
  v_line:=round(v_item.price*v_item.quantity,4);
  insert into public.marketplace_order_items(order_id,product_id,product_name_snapshot,sku_snapshot,quantity,unit_label,unit_price,line_total,product_snapshot)
  values(v_order_id,v_item.product_id,v_item.name,v_item.sku,v_item.quantity,v_item.unit_label,v_item.price,v_line,jsonb_build_object('specifications',v_item.specifications,'category_id',v_item.category_id,'market_section',v_item.market_section,'origin_country',v_item.origin_country,'quality_grade',v_item.quality_grade));
 end loop;
 v_invoice_number:='SAR-MKT-INV-'||to_char(now(),'YYYYMMDD')||'-'||lpad(nextval('public.marketplace_invoice_number_seq')::text,6,'0');
 insert into public.marketplace_invoices(order_id,invoice_number,currency,subtotal,total_amount,tax_status,tax_amount) values(v_order_id,v_invoice_number,v_currency,v_subtotal,v_subtotal,'not_configured',0);
 delete from public.marketplace_cart_items c using public.marketplace_products p where c.product_id=p.id and c.buyer_user_id=v_buyer_id and p.seller_id=p_seller_id;
 return v_order_id;
end; $$;

create or replace function public.cancel_marketplace_order(p_order_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_buyer_id uuid; v_order public.marketplace_orders%rowtype; v_item record;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select id into v_buyer_id from public.users where auth_user_id=auth.uid() and account_status='active';
 select * into v_order from public.marketplace_orders where id=p_order_id and buyer_user_id=v_buyer_id for update;
 if not found then raise exception 'Order not found'; end if;
 if v_order.status<>'awaiting_payment' or v_order.payment_status<>'unpaid' then raise exception 'Order can no longer be cancelled here'; end if;
 for v_item in select product_id,quantity from public.marketplace_order_items where order_id=p_order_id loop
  if v_item.product_id is not null then update public.marketplace_products set reserved_qty=greatest(0,reserved_qty-v_item.quantity) where id=v_item.product_id; end if;
 end loop;
 update public.marketplace_orders set status='cancelled' where id=p_order_id;
 update public.marketplace_invoices set status='void' where order_id=p_order_id and status='draft';
 return true;
end; $$;
grant execute on function public.cancel_marketplace_order(uuid) to authenticated;
revoke all on function public.cancel_marketplace_order(uuid) from public,anon;
