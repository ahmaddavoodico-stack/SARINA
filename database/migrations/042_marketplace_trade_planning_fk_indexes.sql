-- Cover owner filtering and composite foreign-key lookups in trade-planning tables.
create index if not exists marketplace_price_observations_seller_idx
  on public.marketplace_price_observations(seller_id,observed_at desc);
create index if not exists marketplace_price_observations_product_seller_fk_idx
  on public.marketplace_price_observations(product_id,seller_id);
create index if not exists marketplace_trade_cost_models_seller_idx
  on public.marketplace_trade_cost_models(seller_id,created_at desc);
create index if not exists marketplace_trade_cost_models_product_seller_fk_idx
  on public.marketplace_trade_cost_models(product_id,seller_id);
create index if not exists marketplace_trade_routes_product_seller_fk_idx
  on public.marketplace_trade_routes(product_id,seller_id);
create index if not exists marketplace_trade_checklist_items_seller_idx
  on public.marketplace_trade_checklist_items(seller_id,created_at desc);
create index if not exists marketplace_trade_checklist_items_route_seller_fk_idx
  on public.marketplace_trade_checklist_items(route_id,seller_id);
