-- Allow approved individual specialist sellers to list agricultural supplies.
-- Individual seller records are already supported by the seller onboarding RLS policy.
-- Keep their catalog scope limited to company_supplies; farmer_products remains farmer-only.
create or replace function private.marketplace_seller_section_matches(p_seller_id uuid, p_section text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.marketplace_sellers s
    where s.id = p_seller_id
      and (
        (s.seller_type = 'farmer' and p_section = 'farmer_products')
        or (s.seller_type = 'company' and p_section = 'company_supplies')
        or (s.seller_type = 'individual' and p_section = 'company_supplies')
      )
  );
$function$;

comment on function private.marketplace_seller_section_matches(uuid, text)
is 'Maps farmer sellers to farmer produce and company or individual sellers (including specialists) to agricultural supplies.';
