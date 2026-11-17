create table public.marketplace_categories (
 id uuid primary key default gen_random_uuid(),
 market_section text not null check (market_section in ('farmer_products','company_supplies')),
 code text not null, name_fa text not null, name_en text not null,
 sort_order integer not null default 100, is_active boolean not null default true,
 created_at timestamptz not null default now(), unique(market_section,code)
);
insert into public.marketplace_categories(market_section,code,name_fa,name_en,sort_order) values
('farmer_products','fruits','میوه و محصولات باغی','Fruits & orchard produce',10),
('farmer_products','grains','غلات و محصولات زراعی','Grains & field crops',20),
('farmer_products','vegetables','سبزیجات و صیفی‌جات','Vegetables',30),
('farmer_products','dates','خرما و فرآورده‌های خرما','Dates & date products',40),
('farmer_products','other','سایر محصولات کشاورزی','Other farm products',90),
('company_supplies','fertilizers','کود و اصلاح‌کننده خاک','Fertilizers & soil amendments',10),
('company_supplies','crop_protection','سموم و کنترل آفات','Crop protection',20),
('company_supplies','seeds','بذر','Seeds',30),
('company_supplies','seedlings','نهال و نشا','Seedlings & nursery plants',40),
('company_supplies','irrigation','تجهیزات آبیاری','Irrigation equipment',50),
('company_supplies','machinery','ماشین‌آلات و ادوات','Machinery & implements',60),
('company_supplies','tools','ابزار و لوازم','Tools & supplies',70),
('company_supplies','technology','فناوری و تجهیزات هوشمند','Agricultural technology',80),
('company_supplies','other','سایر نهاده‌ها و تجهیزات','Other agricultural supplies',90)
on conflict(market_section,code) do nothing;

create table public.marketplace_sellers(
 id uuid primary key default gen_random_uuid(),
 seller_type text not null check(seller_type in ('farmer','company')),
 owner_user_id uuid not null references public.users(id) on delete restrict,
 organization_id uuid references public.organizations(id) on delete restrict,
 display_name text not null check(length(trim(display_name)) between 2 and 180),
 legal_name text, description text, country_code text, region text, city text,
 contact_email text, contact_phone text, website_url text,
 verification_status text not null default 'pending' check(verification_status in ('pending','verified','rejected','suspended')),
 verification_notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((seller_type='farmer' and organization_id is null) or (seller_type='company' and organization_id is not null))
);
create unique index marketplace_sellers_farmer_owner_uidx on public.marketplace_sellers(owner_user_id) where seller_type='farmer';
create unique index marketplace_sellers_company_owner_org_uidx on public.marketplace_sellers(owner_user_id,organization_id) where seller_type='company';
create index marketplace_sellers_public_idx on public.marketplace_sellers(seller_type,verification_status,display_name);

create table public.marketplace_products(
 id uuid primary key default gen_random_uuid(),
 seller_id uuid not null references public.marketplace_sellers(id) on delete restrict,
 category_id uuid not null references public.marketplace_categories(id) on delete restrict,
 market_section text not null check(market_section in ('farmer_products','company_supplies')),
 name text not null check(length(trim(name)) between 2 and 220),
 description text, specifications jsonb not null default '{}'::jsonb, sku text,
 pricing_model text not null default 'fixed' check(pricing_model in ('fixed','request_quote')),
 price numeric(18,4) check(price is null or price>=0), currency char(3) not null default 'USD',
 unit_label text not null default 'unit', minimum_order_qty numeric(18,4) not null default 1 check(minimum_order_qty>0),
 stock_qty numeric(18,4) check(stock_qty is null or stock_qty>=0),
 reserved_qty numeric(18,4) not null default 0 check(reserved_qty>=0),
 origin_country text, origin_region text, harvest_at date, available_until date, quality_grade text,
 image_urls jsonb not null default '[]'::jsonb, regulatory_metadata jsonb not null default '{}'::jsonb,
 license_reference text, regulated boolean not null default false,
 status text not null default 'draft' check(status in ('draft','published','archived')),
 published_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((pricing_model='fixed' and price is not null and stock_qty is not null) or pricing_model='request_quote'),
 check(reserved_qty<=coalesce(stock_qty,reserved_qty))
);
create index marketplace_products_catalog_idx on public.marketplace_products(market_section,status,category_id,created_at desc);
create index marketplace_products_seller_idx on public.marketplace_products(seller_id,status);
create index marketplace_products_search_idx on public.marketplace_products using gin(to_tsvector('simple',coalesce(name,'')||' '||coalesce(description,'')));

create table public.marketplace_cart_items(
 id uuid primary key default gen_random_uuid(),
 buyer_user_id uuid not null references public.users(id) on delete cascade,
 product_id uuid not null references public.marketplace_products(id) on delete cascade,
 quantity numeric(18,4) not null check(quantity>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(buyer_user_id,product_id)
);
create index marketplace_cart_buyer_idx on public.marketplace_cart_items(buyer_user_id);

create table public.marketplace_orders(
 id uuid primary key default gen_random_uuid(), order_number text not null unique,
 buyer_user_id uuid not null references public.users(id) on delete restrict,
 seller_id uuid not null references public.marketplace_sellers(id) on delete restrict,
 status text not null default 'awaiting_payment' check(status in ('awaiting_payment','confirmed','processing','shipped','delivered','cancelled','disputed')),
 payment_status text not null default 'unpaid' check(payment_status in ('unpaid','pending','paid','failed','partially_refunded','refunded')),
 fulfillment_status text not null default 'not_arranged' check(fulfillment_status in ('not_arranged','preparing','shipped','delivered','returned')),
 currency char(3) not null, subtotal numeric(18,4) not null check(subtotal>=0),
 shipping_amount numeric(18,4) not null default 0 check(shipping_amount>=0),
 discount_amount numeric(18,4) not null default 0 check(discount_amount>=0),
 total_amount numeric(18,4) not null check(total_amount>=0),
 shipping_address jsonb not null default '{}'::jsonb, buyer_note text, seller_note text,
 placed_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index marketplace_orders_buyer_idx on public.marketplace_orders(buyer_user_id,placed_at desc);
create index marketplace_orders_seller_idx on public.marketplace_orders(seller_id,placed_at desc);

create table public.marketplace_order_items(
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.marketplace_orders(id) on delete cascade,
 product_id uuid references public.marketplace_products(id) on delete set null,
 product_name_snapshot text not null, sku_snapshot text, quantity numeric(18,4) not null check(quantity>0),
 unit_label text not null, unit_price numeric(18,4) not null check(unit_price>=0),
 line_total numeric(18,4) not null check(line_total>=0), product_snapshot jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index marketplace_order_items_order_idx on public.marketplace_order_items(order_id);

create sequence public.marketplace_invoice_number_seq;
create table public.marketplace_invoices(
 id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.marketplace_orders(id) on delete restrict,
 invoice_number text not null unique, status text not null default 'draft' check(status in ('draft','issued','partially_paid','paid','void')),
 currency char(3) not null, subtotal numeric(18,4) not null, tax_amount numeric(18,4) not null default 0,
 tax_status text not null default 'not_configured' check(tax_status in ('not_configured','reviewed')),
 total_amount numeric(18,4) not null, issued_at timestamptz, created_at timestamptz not null default now()
);
create table public.marketplace_payment_events(
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.marketplace_orders(id) on delete restrict,
 provider text not null, provider_event_id text not null, event_type text not null,
 amount numeric(18,4) not null, currency char(3) not null, verified_at timestamptz not null,
 raw_reference jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
 unique(provider,provider_event_id)
);
create table public.marketplace_shipments(
 id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.marketplace_orders(id) on delete cascade,
 seller_id uuid not null references public.marketplace_sellers(id) on delete restrict,
 carrier_name text, tracking_number text, tracking_url text,
 status text not null default 'preparing' check(status in ('preparing','shipped','delivered','returned')),
 estimated_delivery date, shipped_at timestamptz, delivered_at timestamptz, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.marketplace_quote_requests(
 id uuid primary key default gen_random_uuid(), buyer_user_id uuid not null references public.users(id) on delete restrict,
 seller_id uuid not null references public.marketplace_sellers(id) on delete restrict,
 product_id uuid references public.marketplace_products(id) on delete set null,
 quantity numeric(18,4) check(quantity is null or quantity>0), unit_label text,
 message text not null check(length(trim(message))>=3),
 status text not null default 'open' check(status in ('open','responded','accepted','declined','closed')),
 seller_response text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index marketplace_quotes_buyer_idx on public.marketplace_quote_requests(buyer_user_id,created_at desc);
create index marketplace_quotes_seller_idx on public.marketplace_quote_requests(seller_id,created_at desc);

create or replace function public.marketplace_touch_updated_at()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin new.updated_at=now(); return new; end; $$;
create trigger marketplace_sellers_touch before update on public.marketplace_sellers for each row execute function public.marketplace_touch_updated_at();
create trigger marketplace_products_touch before update on public.marketplace_products for each row execute function public.marketplace_touch_updated_at();
create trigger marketplace_cart_touch before update on public.marketplace_cart_items for each row execute function public.marketplace_touch_updated_at();
create trigger marketplace_orders_touch before update on public.marketplace_orders for each row execute function public.marketplace_touch_updated_at();
create trigger marketplace_shipments_touch before update on public.marketplace_shipments for each row execute function public.marketplace_touch_updated_at();
create trigger marketplace_quotes_touch before update on public.marketplace_quote_requests for each row execute function public.marketplace_touch_updated_at();

create or replace function public.create_marketplace_order(p_seller_id uuid,p_shipping_address jsonb,p_buyer_note text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_buyer_id uuid; v_seller public.marketplace_sellers%rowtype; v_order_id uuid;
 v_currency char(3); v_subtotal numeric(18,4):=0; v_item record; v_line numeric(18,4); v_invoice_number text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select id into v_buyer_id from public.users where auth_user_id=auth.uid() and account_status='active';
 if v_buyer_id is null then raise exception 'Active SARINA profile required'; end if;
 select * into v_seller from public.marketplace_sellers where id=p_seller_id and verification_status='verified';
 if not found then raise exception 'Seller is not verified or unavailable'; end if;
 if not exists(select 1 from public.marketplace_cart_items where buyer_user_id=v_buyer_id) then raise exception 'Cart is empty'; end if;
 if exists(select 1 from public.marketplace_cart_items c join public.marketplace_products p on p.id=c.product_id where c.buyer_user_id=v_buyer_id and p.seller_id<>p_seller_id) then raise exception 'Checkout one seller at a time'; end if;
 if exists(select 1 from public.marketplace_cart_items c join public.marketplace_products p on p.id=c.product_id where c.buyer_user_id=v_buyer_id and (p.seller_id<>p_seller_id or p.status<>'published' or p.pricing_model<>'fixed' or p.price is null or p.stock_qty is null or c.quantity<p.minimum_order_qty or p.currency is null)) then raise exception 'One or more cart items are not orderable'; end if;
 select min(p.currency),sum(p.price*c.quantity) into v_currency,v_subtotal from public.marketplace_cart_items c join public.marketplace_products p on p.id=c.product_id where c.buyer_user_id=v_buyer_id and p.seller_id=p_seller_id;
 if exists(select 1 from public.marketplace_cart_items c join public.marketplace_products p on p.id=c.product_id where c.buyer_user_id=v_buyer_id and p.seller_id=p_seller_id and p.currency<>v_currency) then raise exception 'All items in one order must use the same currency'; end if;
 if v_subtotal is null or v_subtotal<=0 then raise exception 'Invalid order total'; end if;
 for v_item in select c.product_id,c.quantity,p.name from public.marketplace_cart_items c join public.marketplace_products p on p.id=c.product_id where c.buyer_user_id=v_buyer_id and p.seller_id=p_seller_id for update of p loop
  update public.marketplace_products set reserved_qty=reserved_qty+v_item.quantity where id=v_item.product_id and stock_qty-reserved_qty>=v_item.quantity;
  if not found then raise exception 'Insufficient available stock for product %',v_item.name; end if;
 end loop;
 insert into public.marketplace_orders(order_number,buyer_user_id,seller_id,currency,subtotal,total_amount,shipping_address,buyer_note)
 values('SAR-MKT-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),v_buyer_id,p_seller_id,v_currency,v_subtotal,v_subtotal,coalesce(p_shipping_address,'{}'::jsonb),nullif(trim(p_buyer_note),'')) returning id into v_order_id;
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

create or replace function public.create_marketplace_quote_request(p_seller_id uuid,p_product_id uuid,p_quantity numeric,p_unit_label text,p_message text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_buyer_id uuid; v_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select id into v_buyer_id from public.users where auth_user_id=auth.uid() and account_status='active';
 if v_buyer_id is null then raise exception 'Active SARINA profile required'; end if;
 if not exists(select 1 from public.marketplace_sellers where id=p_seller_id and verification_status='verified') then raise exception 'Seller unavailable'; end if;
 if p_product_id is not null and not exists(select 1 from public.marketplace_products where id=p_product_id and seller_id=p_seller_id and status='published' and pricing_model='request_quote') then raise exception 'Product unavailable for quote'; end if;
 insert into public.marketplace_quote_requests(buyer_user_id,seller_id,product_id,quantity,unit_label,message) values(v_buyer_id,p_seller_id,p_product_id,p_quantity,p_unit_label,nullif(trim(p_message),'')) returning id into v_id;
 return v_id;
end; $$;

alter table public.marketplace_categories enable row level security;
alter table public.marketplace_sellers enable row level security;
alter table public.marketplace_products enable row level security;
alter table public.marketplace_cart_items enable row level security;
alter table public.marketplace_orders enable row level security;
alter table public.marketplace_order_items enable row level security;
alter table public.marketplace_invoices enable row level security;
alter table public.marketplace_payment_events enable row level security;
alter table public.marketplace_shipments enable row level security;
alter table public.marketplace_quote_requests enable row level security;

create policy marketplace_categories_read on public.marketplace_categories for select to anon,authenticated using(is_active);
create policy marketplace_sellers_read on public.marketplace_sellers for select to anon,authenticated using(verification_status='verified' or exists(select 1 from public.users u where u.id=owner_user_id and u.auth_user_id=(select auth.uid())));
create policy marketplace_sellers_insert on public.marketplace_sellers for insert to authenticated with check(verification_status='pending' and exists(select 1 from public.users u where u.id=owner_user_id and u.auth_user_id=(select auth.uid())) and ((seller_type='farmer' and organization_id is null) or (seller_type='company' and exists(select 1 from public.organization_members om where om.organization_id=organization_id and om.user_id=owner_user_id and om.status='active'))));
create policy marketplace_sellers_update on public.marketplace_sellers for update to authenticated using(exists(select 1 from public.users u where u.id=owner_user_id and u.auth_user_id=(select auth.uid()))) with check(exists(select 1 from public.users u where u.id=owner_user_id and u.auth_user_id=(select auth.uid())));
create policy marketplace_products_public_read on public.marketplace_products for select to anon,authenticated using(status='published' and exists(select 1 from public.marketplace_sellers s where s.id=seller_id and s.verification_status='verified'));
create policy marketplace_products_owner_read on public.marketplace_products for select to authenticated using(exists(select 1 from public.marketplace_sellers s join public.users u on u.id=s.owner_user_id where s.id=seller_id and u.auth_user_id=(select auth.uid())));
create policy marketplace_products_owner_insert on public.marketplace_products for insert to authenticated with check(exists(select 1 from public.marketplace_sellers s join public.users u on u.id=s.owner_user_id where s.id=seller_id and u.auth_user_id=(select auth.uid())) and exists(select 1 from public.marketplace_categories c where c.id=category_id and c.market_section=market_section and c.is_active) and (status<>'published' or exists(select 1 from public.marketplace_sellers s where s.id=seller_id and s.verification_status='verified')));
create policy marketplace_products_owner_update on public.marketplace_products for update to authenticated using(exists(select 1 from public.marketplace_sellers s join public.users u on u.id=s.owner_user_id where s.id=seller_id and u.auth_user_id=(select auth.uid()))) with check(exists(select 1 from public.marketplace_sellers s join public.users u on u.id=s.owner_user_id where s.id=seller_id and u.auth_user_id=(select auth.uid())) and exists(select 1 from public.marketplace_categories c where c.id=category_id and c.market_section=market_section and c.is_active) and (status<>'published' or exists(select 1 from public.marketplace_sellers s where s.id=seller_id and s.verification_status='verified')));
create policy marketplace_products_owner_delete on public.marketplace_products for delete to authenticated using(exists(select 1 from public.marketplace_sellers s join public.users u on u.id=s.owner_user_id where s.id=seller_id and u.auth_user_id=(select auth.uid())) and status='draft');
create policy marketplace_cart_owner_all on public.marketplace_cart_items for all to authenticated using(exists(select 1 from public.users u where u.id=buyer_user_id and u.auth_user_id=(select auth.uid()))) with check(exists(select 1 from public.users u where u.id=buyer_user_id and u.auth_user_id=(select auth.uid())) and exists(select 1 from public.marketplace_products p join public.marketplace_sellers s on s.id=p.seller_id where p.id=product_id and p.status='published' and p.pricing_model='fixed' and s.verification_status='verified'));
create policy marketplace_orders_participant_read on public.marketplace_orders for select to authenticated using(exists(select 1 from public.users u where u.id=buyer_user_id and u.auth_user_id=(select auth.uid())) or exists(select 1 from public.marketplace_sellers s join public.users u on u.id=s.owner_user_id where s.id=seller_id and u.auth_user_id=(select auth.uid())));
create policy marketplace_order_items_participant_read on public.marketplace_order_items for select to authenticated using(exists(select 1 from public.marketplace_orders o join public.users u on u.id=o.buyer_user_id where o.id=order_id and u.auth_user_id=(select auth.uid())) or exists(select 1 from public.marketplace_orders o join public.marketplace_sellers s on s.id=o.seller_id join public.users u on u.id=s.owner_user_id where o.id=order_id and u.auth_user_id=(select auth.uid())));
create policy marketplace_invoices_participant_read on public.marketplace_invoices for select to authenticated using(exists(select 1 from public.marketplace_orders o join public.users u on u.id=o.buyer_user_id where o.id=order_id and u.auth_user_id=(select auth.uid())) or exists(select 1 from public.marketplace_orders o join public.marketplace_sellers s on s.id=o.seller_id join public.users u on u.id=s.owner_user_id where o.id=order_id and u.auth_user_id=(select auth.uid())));
create policy marketplace_shipments_participant_read on public.marketplace_shipments for select to authenticated using(exists(select 1 from public.marketplace_orders o join public.users u on u.id=o.buyer_user_id where o.id=order_id and u.auth_user_id=(select auth.uid())) or exists(select 1 from public.marketplace_sellers s join public.users u on u.id=s.owner_user_id where s.id=seller_id and u.auth_user_id=(select auth.uid())));
create policy marketplace_shipments_seller_insert on public.marketplace_shipments for insert to authenticated with check(exists(select 1 from public.marketplace_sellers s join public.users u on u.id=s.owner_user_id where s.id=seller_id and u.auth_user_id=(select auth.uid())) and exists(select 1 from public.marketplace_orders o where o.id=order_id and o.seller_id=seller_id));
create policy marketplace_shipments_seller_update on public.marketplace_shipments for update to authenticated using(exists(select 1 from public.marketplace_sellers s join public.users u on u.id=s.owner_user_id where s.id=seller_id and u.auth_user_id=(select auth.uid()))) with check(exists(select 1 from public.marketplace_sellers s join public.users u on u.id=s.owner_user_id where s.id=seller_id and u.auth_user_id=(select auth.uid())) and exists(select 1 from public.marketplace_orders o where o.id=order_id and o.seller_id=seller_id));
create policy marketplace_quotes_participant_read on public.marketplace_quote_requests for select to authenticated using(exists(select 1 from public.users u where u.id=buyer_user_id and u.auth_user_id=(select auth.uid())) or exists(select 1 from public.marketplace_sellers s join public.users u on u.id=s.owner_user_id where s.id=seller_id and u.auth_user_id=(select auth.uid())));

revoke all on public.marketplace_payment_events from anon,authenticated;
revoke all on public.marketplace_invoices from anon,authenticated;
revoke insert,update,delete on public.marketplace_orders from anon,authenticated;
revoke insert,update,delete on public.marketplace_order_items from anon,authenticated;
revoke update(verification_status,verification_notes) on public.marketplace_sellers from authenticated;
grant select on public.marketplace_categories,public.marketplace_sellers,public.marketplace_products to anon,authenticated;
grant insert,update,delete on public.marketplace_sellers to authenticated;
grant insert,update,delete on public.marketplace_products to authenticated;
grant select,insert,update,delete on public.marketplace_cart_items to authenticated;
grant select on public.marketplace_orders,public.marketplace_order_items,public.marketplace_invoices,public.marketplace_shipments,public.marketplace_quote_requests to authenticated;
grant insert,update on public.marketplace_shipments to authenticated;
grant usage,select on sequence public.marketplace_invoice_number_seq to service_role;
grant select,insert,update,delete on public.marketplace_categories,public.marketplace_sellers,public.marketplace_products,public.marketplace_cart_items,public.marketplace_orders,public.marketplace_order_items,public.marketplace_invoices,public.marketplace_payment_events,public.marketplace_shipments,public.marketplace_quote_requests to service_role;
grant execute on function public.create_marketplace_order(uuid,jsonb,text) to authenticated;
grant execute on function public.create_marketplace_quote_request(uuid,uuid,numeric,text,text) to authenticated;
revoke all on function public.create_marketplace_order(uuid,jsonb,text) from public,anon;
revoke all on function public.create_marketplace_quote_request(uuid,uuid,numeric,text,text) from public,anon;
