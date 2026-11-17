revoke insert,update on public.marketplace_sellers from authenticated;
grant insert(seller_type,owner_user_id,organization_id,display_name,legal_name,description,country_code,region,city,contact_email,contact_phone,website_url)
 on public.marketplace_sellers to authenticated;
grant update(display_name,legal_name,description,country_code,region,city,contact_email,contact_phone,website_url)
 on public.marketplace_sellers to authenticated;

revoke insert,update on public.marketplace_products from authenticated;
grant insert(seller_id,category_id,market_section,name,description,specifications,sku,pricing_model,price,currency,unit_label,minimum_order_qty,stock_qty,origin_country,origin_region,harvest_at,available_until,quality_grade,image_urls,regulatory_metadata,license_reference,regulated,status,published_at)
 on public.marketplace_products to authenticated;
grant update(seller_id,category_id,market_section,name,description,specifications,sku,pricing_model,price,currency,unit_label,minimum_order_qty,stock_qty,origin_country,origin_region,harvest_at,available_until,quality_grade,image_urls,regulatory_metadata,license_reference,regulated,status,published_at)
 on public.marketplace_products to authenticated;
