-- Marketplace client privilege hardening
-- PostgreSQL 17 / Supabase
-- Scope: existing marketplace tables only. No row data, RLS policies,
-- function privileges, or schema objects are changed by this migration.
-- Global default privileges are intentionally left untouched.

do $$
declare
  v_table text;
  v_tables text[] := array[
    'marketplace_categories',
    'marketplace_sellers',
    'marketplace_products',
    'marketplace_cart_items',
    'marketplace_orders',
    'marketplace_order_items',
    'marketplace_invoices',
    'marketplace_payment_events',
    'marketplace_shipments',
    'marketplace_quote_requests',
    'marketplace_seller_change_requests',
    'marketplace_product_external_links',
    'marketplace_sales_leads',
    'marketplace_sales_tasks',
    'marketplace_product_service_needs',
    'marketplace_price_observations',
    'marketplace_trade_cost_models',
    'marketplace_trade_routes',
    'marketplace_trade_checklist_items'
  ];
begin
  foreach v_table in array v_tables loop
    execute format(
      'revoke truncate, maintain, references, trigger on table public.%I from anon, authenticated',
      v_table
    );
    execute format(
      'revoke all privileges on table public.%I from anon',
      v_table
    );
  end loop;
end;
$$;

-- Anonymous users may only read the public catalog surfaces. Existing RLS
-- policies continue to decide which rows are visible.
grant select on table
  public.marketplace_categories,
  public.marketplace_products,
  public.marketplace_product_external_links
to anon;

-- Categories are managed by trusted administrators, not client roles.
revoke insert, update, delete on table public.marketplace_categories
from authenticated;
grant select on table public.marketplace_categories to authenticated;

-- Seller ownership and draft/product workflows remain protected by their
-- existing RLS policies and existing column-level INSERT/UPDATE grants.
-- A seller must never be able to delete its seller identity directly.
revoke delete on table public.marketplace_sellers from authenticated;

-- Quote requests are created only through the ownership-checked RPC.
-- Sellers may update only the response/status fields allowed by the RLS
-- policy; buyer identity, seller identity, quantity and message stay immutable.
revoke insert, update, delete on table public.marketplace_quote_requests
from authenticated;
grant update (status, seller_response)
on table public.marketplace_quote_requests to authenticated;

-- Shipment creation and tracking updates remain available under the existing
-- seller/order RLS checks; direct deletion is not part of the client workflow.
revoke delete on table public.marketplace_shipments from authenticated;
