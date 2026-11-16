-- SARINA | Migration 035: individual marketplace sellers and controlled profile-change requests
-- An individual may act as an independently reviewed seller/agent without inventing a legal company.
-- Personal identity data is deliberately not stored in the public marketplace_sellers table.

alter table public.marketplace_sellers
  drop constraint if exists marketplace_sellers_seller_type_check;
alter table public.marketplace_sellers
  add constraint marketplace_sellers_seller_type_check
  check (seller_type in ('farmer','company','individual'));

drop policy if exists marketplace_sellers_insert on public.marketplace_sellers;
create policy marketplace_sellers_insert on public.marketplace_sellers
for insert to authenticated
with check (
  verification_status='pending'
  and exists (
    select 1 from public.users u
    where u.id=owner_user_id and u.auth_user_id=(select auth.uid())
  )
  and (
    (seller_type='farmer' and organization_id is null)
    or (seller_type='individual' and organization_id is null)
    or (seller_type='company' and private.marketplace_has_active_org_membership(organization_id,owner_user_id))
  )
);

drop policy if exists marketplace_sellers_update on public.marketplace_sellers;
create policy marketplace_sellers_update on public.marketplace_sellers
for update to authenticated
using (private.marketplace_seller_is_owner(id))
with check (
  private.marketplace_seller_is_owner(id)
  and (
    (seller_type='farmer' and organization_id is null)
    or (seller_type='individual' and organization_id is null)
    or (seller_type='company' and private.marketplace_has_active_org_membership(organization_id,owner_user_id))
  )
);

create table if not exists public.marketplace_seller_change_requests (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.marketplace_sellers(id) on delete cascade,
  requested_by uuid not null references public.users(id) on delete restrict,
  proposed_changes jsonb not null check (jsonb_typeof(proposed_changes)='object'),
  reason text,
  status text not null default 'pending'
    check (status in ('pending','under_review','approved','rejected')),
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status in ('pending','under_review') and reviewed_at is null)
    or (status in ('approved','rejected') and reviewed_at is not null)
  )
);
create index if not exists marketplace_seller_change_requests_seller_created_idx
  on public.marketplace_seller_change_requests(seller_id,created_at desc);
create index if not exists marketplace_seller_change_requests_status_created_idx
  on public.marketplace_seller_change_requests(status,created_at desc);

alter table public.marketplace_seller_change_requests enable row level security;
revoke all on public.marketplace_seller_change_requests from anon,authenticated;
grant all on public.marketplace_seller_change_requests to service_role;
