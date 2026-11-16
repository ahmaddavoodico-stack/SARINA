-- SARINA | 037: farmer-first sales intelligence foundation
-- Private seller-owned commercial data; public external links require explicit seller visibility.
create unique index if not exists marketplace_products_id_seller_id_uidx
  on public.marketplace_products(id, seller_id);

create table if not exists public.marketplace_product_external_links (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.marketplace_sellers(id) on delete cascade,
  product_id uuid not null,
  link_type text not null check (link_type in ('website','social','product_page','catalog','other')),
  label text not null check (length(trim(label)) between 1 and 180),
  url text not null check (url ~* '^https?://'),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_product_external_links_product_seller_fk
    foreign key (product_id, seller_id)
    references public.marketplace_products(id, seller_id) on delete cascade
);
create unique index if not exists marketplace_product_external_links_unique_url_idx on public.marketplace_product_external_links(product_id, url);
create index if not exists marketplace_product_external_links_seller_idx on public.marketplace_product_external_links(seller_id, created_at desc);

create table if not exists public.marketplace_sales_leads (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.marketplace_sellers(id) on delete cascade,
  product_id uuid,
  buyer_name text not null check (length(trim(buyer_name)) between 1 and 220),
  buyer_type text not null default 'other' check (buyer_type in ('wholesaler','processor','exporter','importer','retailer','food_service','institution','feed_mill','other')),
  country text, region text, city text, need_description text,
  target_quantity numeric(18,4) check (target_quantity is null or target_quantity >= 0),
  unit_label text,
  expected_unit_price numeric(18,4) check (expected_unit_price is null or expected_unit_price >= 0),
  currency char(3) not null default 'USD',
  source_type text not null default 'manual' check (source_type in ('manual','public_directory','inbound','referral','research_assistant','other')),
  source_name text, source_url text check (source_url is null or source_url ~* '^https?://'),
  contact_name text, contact_email text, contact_phone text, contact_method text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified','source_checked','contact_confirmed')),
  stage text not null default 'identified' check (stage in ('identified','researching','contacted','responded','negotiating','won','lost')),
  next_action text, next_action_at timestamptz, notes text,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint marketplace_sales_leads_product_seller_fk foreign key (product_id, seller_id)
    references public.marketplace_products(id, seller_id) on delete cascade
);
create index if not exists marketplace_sales_leads_seller_stage_idx on public.marketplace_sales_leads(seller_id, stage, updated_at desc);
create index if not exists marketplace_sales_leads_next_action_idx on public.marketplace_sales_leads(seller_id, next_action_at) where next_action_at is not null;

create table if not exists public.marketplace_sales_tasks (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.marketplace_sellers(id) on delete cascade,
  product_id uuid,
  lead_id uuid references public.marketplace_sales_leads(id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 240),
  task_type text not null default 'other' check (task_type in ('market_research','pricing','buyer_outreach','follow_up','quality_check','standard_certification','grading','packaging','storage','transport','export_documents','contract','delivery','other')),
  due_at timestamptz,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'planned' check (status in ('planned','in_progress','completed','deferred','cancelled')),
  notes text, completion_note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint marketplace_sales_tasks_product_seller_fk foreign key (product_id, seller_id)
    references public.marketplace_products(id, seller_id) on delete cascade
);
create index if not exists marketplace_sales_tasks_seller_due_idx on public.marketplace_sales_tasks(seller_id, due_at, status);
create index if not exists marketplace_sales_tasks_lead_idx on public.marketplace_sales_tasks(lead_id);

create table if not exists public.marketplace_product_service_needs (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.marketplace_sellers(id) on delete cascade,
  product_id uuid,
  service_code text not null check (service_code in ('lab_testing','quality_inspection','standard_certification','grading_sorting','packaging_labeling','cold_storage','warehousing','domestic_transport','international_freight','customs_clearance','export_documents','insurance','processing','other')),
  description text,
  urgency text not null default 'normal' check (urgency in ('low','normal','high','urgent')),
  status text not null default 'identified' check (status in ('identified','searching','matched','contacted','booked','completed','not_needed')),
  organization_service_id uuid references public.organization_services(id) on delete set null,
  provider_name text, provider_contact text,
  provider_url text check (provider_url is null or provider_url ~* '^https?://'),
  target_date date, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint marketplace_product_service_needs_product_seller_fk foreign key (product_id, seller_id)
    references public.marketplace_products(id, seller_id) on delete cascade
);
create index if not exists marketplace_product_service_needs_seller_status_idx on public.marketplace_product_service_needs(seller_id, status, target_date);

alter table public.marketplace_product_external_links enable row level security;
alter table public.marketplace_sales_leads enable row level security;
alter table public.marketplace_sales_tasks enable row level security;
alter table public.marketplace_product_service_needs enable row level security;

revoke all on public.marketplace_product_external_links from public, anon, authenticated;
revoke all on public.marketplace_sales_leads from public, anon, authenticated;
revoke all on public.marketplace_sales_tasks from public, anon, authenticated;
revoke all on public.marketplace_product_service_needs from public, anon, authenticated;
grant select, insert, update, delete on public.marketplace_product_external_links to authenticated;
grant select, insert, update, delete on public.marketplace_sales_leads to authenticated;
grant select, insert, update, delete on public.marketplace_sales_tasks to authenticated;
grant select, insert, update, delete on public.marketplace_product_service_needs to authenticated;
grant all on public.marketplace_product_external_links to service_role;
grant all on public.marketplace_sales_leads to service_role;
grant all on public.marketplace_sales_tasks to service_role;
grant all on public.marketplace_product_service_needs to service_role;

create policy marketplace_product_external_links_owner_all on public.marketplace_product_external_links for all to authenticated
  using (private.marketplace_seller_is_owner(seller_id))
  with check (private.marketplace_seller_is_owner(seller_id) and exists (
    select 1 from public.marketplace_products p where p.id=product_id and p.seller_id=seller_id
  ));
create policy marketplace_product_external_links_public_read on public.marketplace_product_external_links for select to anon, authenticated
  using (is_public and exists (
    select 1 from public.marketplace_products p
    where p.id=product_id and p.seller_id=seller_id and p.status='published'
      and private.marketplace_seller_is_verified(p.seller_id)
  ));

create policy marketplace_sales_leads_owner_all on public.marketplace_sales_leads for all to authenticated
  using (private.marketplace_seller_is_owner(seller_id))
  with check (private.marketplace_seller_is_owner(seller_id) and (
    product_id is null or exists (select 1 from public.marketplace_products p where p.id=product_id and p.seller_id=seller_id)
  ));

create policy marketplace_sales_tasks_owner_all on public.marketplace_sales_tasks for all to authenticated
  using (private.marketplace_seller_is_owner(seller_id))
  with check (private.marketplace_seller_is_owner(seller_id)
    and (product_id is null or exists (select 1 from public.marketplace_products p where p.id=product_id and p.seller_id=seller_id))
    and (lead_id is null or exists (select 1 from public.marketplace_sales_leads l where l.id=lead_id and l.seller_id=seller_id))
  );

create policy marketplace_product_service_needs_owner_all on public.marketplace_product_service_needs for all to authenticated
  using (private.marketplace_seller_is_owner(seller_id))
  with check (private.marketplace_seller_is_owner(seller_id)
    and (product_id is null or exists (select 1 from public.marketplace_products p where p.id=product_id and p.seller_id=seller_id))
    and (organization_service_id is null or exists (
      select 1 from public.organization_services os where os.id=organization_service_id and os.status='active'
    ))
  );
