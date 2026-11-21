-- SARINA marketplace privilege regression checks (PostgreSQL 17)
-- Read-only assertions. Expected to FAIL against the current snapshot until
-- the separately reviewed least-privilege migration has been applied.
-- This script does not change grants, rows, policies, or schema.

do $$
declare
  v_table text;
  v_privilege text;
  v_marketplace_tables text[] := array[
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
  v_client_roles text[] := array['anon','authenticated'];
begin
  foreach v_table in array v_marketplace_tables loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = v_table
        and c.relkind in ('r','p')
        and c.relrowsecurity
    ) then
      raise exception 'RLS missing or table not found: public.%', v_table;
    end if;

    foreach v_privilege in array array['TRUNCATE','MAINTAIN','REFERENCES','TRIGGER'] loop
      if has_table_privilege('anon', format('public.%I', v_table), v_privilege) then
        raise exception 'anon retains % on public.%', v_privilege, v_table;
      end if;
      if has_table_privilege('authenticated', format('public.%I', v_table), v_privilege) then
        raise exception 'authenticated retains % on public.%', v_privilege, v_table;
      end if;
    end loop;

    if has_any_column_privilege('anon', format('public.%I', v_table), 'INSERT')
       or has_any_column_privilege('anon', format('public.%I', v_table), 'UPDATE')
       or has_table_privilege('anon', format('public.%I', v_table), 'DELETE') then
      raise exception 'anon retains direct write privilege on public.%', v_table;
    end if;
  end loop;

  if not has_table_privilege('anon','public.marketplace_categories','SELECT')
     or not has_table_privilege('anon','public.marketplace_products','SELECT')
     or not has_table_privilege('anon','public.marketplace_product_external_links','SELECT') then
    raise exception 'Required anonymous catalog SELECT grant is missing';
  end if;

  if has_table_privilege('anon','public.marketplace_sellers','SELECT')
     or has_table_privilege('anon','public.marketplace_orders','SELECT')
     or has_table_privilege('anon','public.marketplace_quote_requests','SELECT')
     or has_table_privilege('anon','public.marketplace_shipments','SELECT') then
    raise exception 'Anonymous access to a private marketplace table remains';
  end if;

  if has_any_column_privilege('authenticated','public.marketplace_categories','INSERT')
     or has_any_column_privilege('authenticated','public.marketplace_categories','UPDATE')
     or has_table_privilege('authenticated','public.marketplace_categories','DELETE') then
    raise exception 'Authenticated users retain direct category write privileges';
  end if;

  if has_table_privilege('authenticated','public.marketplace_sellers','DELETE') then
    raise exception 'Authenticated users retain direct seller DELETE';
  end if;

  if has_table_privilege('authenticated','public.marketplace_quote_requests','INSERT')
     or has_table_privilege('authenticated','public.marketplace_quote_requests','DELETE') then
    raise exception 'Authenticated users retain direct quote INSERT/DELETE';
  end if;

  if has_table_privilege('authenticated','public.marketplace_shipments','DELETE') then
    raise exception 'Authenticated users retain direct shipment DELETE';
  end if;

  if has_table_privilege('anon','public.marketplace_seller_change_requests','SELECT')
     or has_table_privilege('authenticated','public.marketplace_seller_change_requests','SELECT')
     or has_any_column_privilege('anon','public.marketplace_seller_change_requests','INSERT')
     or has_any_column_privilege('authenticated','public.marketplace_seller_change_requests','INSERT') then
    raise exception 'Seller change requests must remain RPC-only';
  end if;

  if has_function_privilege('anon','public.create_marketplace_order(uuid,jsonb,text)','EXECUTE')
     or has_function_privilege('anon','public.create_marketplace_quote_request(uuid,uuid,numeric,text,text)','EXECUTE')
     or has_function_privilege('anon','public.cancel_marketplace_order(uuid)','EXECUTE')
     or has_function_privilege('anon','public.submit_marketplace_seller_change_request(uuid,jsonb,text)','EXECUTE')
     or has_function_privilege('anon','public.review_marketplace_seller_change_request(uuid,text,text)','EXECUTE') then
    raise exception 'An anonymous role can execute a protected marketplace RPC';
  end if;
end;
$$;
