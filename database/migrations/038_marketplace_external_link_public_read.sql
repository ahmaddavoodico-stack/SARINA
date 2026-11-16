-- Public product links are visible only through the explicit is_public + published + verified RLS policy.
grant select on public.marketplace_product_external_links to anon;
