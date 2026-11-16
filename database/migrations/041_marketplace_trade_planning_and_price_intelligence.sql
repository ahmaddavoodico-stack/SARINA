-- SARINA | 041: farmer-facing trade planning, price evidence and export readiness
create table if not exists public.marketplace_price_observations (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.marketplace_sellers(id) on delete cascade,
  product_id uuid not null,
  destination_country text not null check (length(trim(destination_country)) between 2 and 120),
  market_region text,
  source_name text not null check (length(trim(source_name)) between 1 and 180),
  source_url text check (source_url is null or source_url ~* '^https?://'),
  observed_at date not null,
  price_min numeric(18,4) not null check (price_min >= 0),
  price_max numeric(18,4) not null check (price_max >= price_min),
  currency char(3) not null default 'USD',
  unit_label text not null,
  quality_grade text,
  trade_basis text not null default 'wholesale' check (trade_basis in ('farm_gate','wholesale','retail','export_offer','fob','cif','other')),
  notes text,
  source_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_price_observations_product_seller_fk
    foreign key (product_id,seller_id) references public.marketplace_products(id,seller_id) on delete cascade
);
create index if not exists marketplace_price_observations_product_market_date_idx
  on public.marketplace_price_observations(product_id,destination_country,observed_at desc);

create table if not exists public.marketplace_trade_cost_models (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.marketplace_sellers(id) on delete cascade,
  product_id uuid not null,
  destination_country text not null check (length(trim(destination_country)) between 2 and 120),
  currency char(3) not null default 'USD',
  unit_label text not null,
  farmgate_cost numeric(18,4) not null default 0 check (farmgate_cost >= 0),
  grading_cost numeric(18,4) not null default 0 check (grading_cost >= 0),
  packaging_cost numeric(18,4) not null default 0 check (packaging_cost >= 0),
  certification_cost numeric(18,4) not null default 0 check (certification_cost >= 0),
  storage_cost numeric(18,4) not null default 0 check (storage_cost >= 0),
  inland_transport_cost numeric(18,4) not null default 0 check (inland_transport_cost >= 0),
  international_freight_cost numeric(18,4) not null default 0 check (international_freight_cost >= 0),
  customs_cost numeric(18,4) not null default 0 check (customs_cost >= 0),
  insurance_cost numeric(18,4) not null default 0 check (insurance_cost >= 0),
  other_cost numeric(18,4) not null default 0 check (other_cost >= 0),
  contingency_percent numeric(6,3) not null default 0 check (contingency_percent between 0 and 100),
  platform_fee_percent numeric(6,3) not null default 0 check (platform_fee_percent between 0 and 50),
  target_margin_percent numeric(6,3) not null default 15 check (target_margin_percent between 0 and 80),
  calculated_unit_cost numeric(18,4) not null check (calculated_unit_cost >= 0),
  suggested_unit_price numeric(18,4) not null check (suggested_unit_price >= 0),
  assumptions jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_trade_cost_models_product_seller_fk
    foreign key (product_id,seller_id) references public.marketplace_products(id,seller_id) on delete cascade
);
create index if not exists marketplace_trade_cost_models_product_country_idx
  on public.marketplace_trade_cost_models(product_id,destination_country,created_at desc);

create table if not exists public.marketplace_trade_routes (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.marketplace_sellers(id) on delete cascade,
  product_id uuid not null,
  destination_country text not null check (length(trim(destination_country)) between 2 and 120),
  target_buyer_type text not null default 'importer',
  shipment_mode text not null default 'not_decided' check (shipment_mode in ('road','sea','air','rail','multimodal','not_decided')),
  incoterm text,
  hs_code text,
  target_quantity numeric(18,3) check (target_quantity is null or target_quantity >= 0),
  unit_label text,
  status text not null default 'researching' check (status in ('researching','preparing','ready_for_quote','in_negotiation','paused','closed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_trade_routes_product_seller_fk
    foreign key (product_id,seller_id) references public.marketplace_products(id,seller_id) on delete cascade,
  constraint marketplace_trade_routes_id_seller_unique unique(id,seller_id)
);
create index if not exists marketplace_trade_routes_seller_country_idx
  on public.marketplace_trade_routes(seller_id,destination_country,status);

create table if not exists public.marketplace_trade_checklist_items (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null,
  seller_id uuid not null references public.marketplace_sellers(id) on delete cascade,
  category text not null,
  item_code text not null,
  title text not null,
  status text not null default 'to_check' check (status in ('to_check','in_progress','done','not_applicable')),
  source_url text check (source_url is null or source_url ~* '^https?://'),
  provider_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_trade_checklist_route_seller_fk
    foreign key (route_id,seller_id) references public.marketplace_trade_routes(id,seller_id) on delete cascade,
  constraint marketplace_trade_checklist_route_code_unique unique(route_id,item_code)
);
create index if not exists marketplace_trade_checklist_route_status_idx
  on public.marketplace_trade_checklist_items(route_id,status);

alter table public.marketplace_price_observations enable row level security;
alter table public.marketplace_trade_cost_models enable row level security;
alter table public.marketplace_trade_routes enable row level security;
alter table public.marketplace_trade_checklist_items enable row level security;
revoke all on public.marketplace_price_observations,public.marketplace_trade_cost_models,public.marketplace_trade_routes,public.marketplace_trade_checklist_items from public,anon,authenticated;
grant select,insert,update,delete on public.marketplace_price_observations,public.marketplace_trade_cost_models,public.marketplace_trade_routes,public.marketplace_trade_checklist_items to authenticated;
grant all on public.marketplace_price_observations,public.marketplace_trade_cost_models,public.marketplace_trade_routes,public.marketplace_trade_checklist_items to service_role;

create policy marketplace_price_observations_owner_all on public.marketplace_price_observations for all to authenticated
  using (private.marketplace_seller_is_owner(seller_id))
  with check (private.marketplace_seller_is_owner(seller_id) and exists (
    select 1 from public.marketplace_products p where p.id=product_id and p.seller_id=seller_id
  ));
create policy marketplace_trade_cost_models_owner_all on public.marketplace_trade_cost_models for all to authenticated
  using (private.marketplace_seller_is_owner(seller_id))
  with check (private.marketplace_seller_is_owner(seller_id) and exists (
    select 1 from public.marketplace_products p where p.id=product_id and p.seller_id=seller_id
  ));
create policy marketplace_trade_routes_owner_all on public.marketplace_trade_routes for all to authenticated
  using (private.marketplace_seller_is_owner(seller_id))
  with check (private.marketplace_seller_is_owner(seller_id) and exists (
    select 1 from public.marketplace_products p where p.id=product_id and p.seller_id=seller_id
  ));
create policy marketplace_trade_checklist_items_owner_all on public.marketplace_trade_checklist_items for all to authenticated
  using (private.marketplace_seller_is_owner(seller_id))
  with check (private.marketplace_seller_is_owner(seller_id) and exists (
    select 1 from public.marketplace_trade_routes r where r.id=route_id and r.seller_id=seller_id
  ));
