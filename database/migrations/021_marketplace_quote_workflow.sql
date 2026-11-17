create policy marketplace_quotes_seller_update on public.marketplace_quote_requests
for update to authenticated
using(private.marketplace_seller_is_owner(seller_id))
with check(private.marketplace_seller_is_owner(seller_id) and status in ('responded','declined','closed'));
grant update(status,seller_response) on public.marketplace_quote_requests to authenticated;
