-- Atomic central-admin review for marketplace sellers and regulated listings.
-- This migration is source-only until reviewed and explicitly applied to a Supabase environment.

create or replace function public.admin_list_marketplace_review_queue()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_sellers jsonb;
  v_products jsonb;
begin
  if auth.uid() is null or not private.is_sarina_admin() then
    raise exception 'Central administrator access required' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'seller_type', s.seller_type,
        'owner_user_id', s.owner_user_id,
        'organization_id', s.organization_id,
        'display_name', s.display_name,
        'legal_name', s.legal_name,
        'description', s.description,
        'country_code', s.country_code,
        'region', s.region,
        'city', s.city,
        'contact_email', s.contact_email,
        'contact_phone', s.contact_phone,
        'website_url', s.website_url,
        'verification_status', s.verification_status,
        'verification_notes', s.verification_notes,
        'created_at', s.created_at
      ) order by s.created_at
    ),
    '[]'::jsonb
  )
  into v_sellers
  from public.marketplace_sellers s
  where s.verification_status = 'pending';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'seller_id', p.seller_id,
        'seller_name', s.display_name,
        'seller_type', s.seller_type,
        'category_name', c.name_fa,
        'category_code', c.code,
        'name', p.name,
        'description', p.description,
        'specifications', p.specifications,
        'license_reference', p.license_reference,
        'regulatory_metadata', p.regulatory_metadata,
        'regulated', p.regulated,
        'regulatory_status', p.regulatory_status,
        'status', p.status,
        'created_at', p.created_at
      ) order by p.created_at
    ),
    '[]'::jsonb
  )
  into v_products
  from public.marketplace_products p
  join public.marketplace_sellers s on s.id = p.seller_id
  join public.marketplace_categories c on c.id = p.category_id
  where (p.regulated or c.code = 'crop_protection')
    and p.regulatory_status in ('not_reviewed', 'pending_review');

  return jsonb_build_object('pending_sellers', v_sellers, 'pending_products', v_products);
end;
$function$;

create or replace function public.admin_review_marketplace_seller(
  p_seller_id uuid,
  p_status text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_actor_user_id uuid;
  v_owner_user_id uuid;
  v_before_status text;
begin
  if auth.uid() is null or not private.is_sarina_admin() then
    raise exception 'Central administrator access required' using errcode = '42501';
  end if;
  if p_status not in ('verified', 'rejected') then
    raise exception 'Unsupported marketplace seller review status' using errcode = '22023';
  end if;

  select id into v_actor_user_id
  from public.users
  where auth_user_id = auth.uid()
  limit 1;
  if v_actor_user_id is null then
    raise exception 'Administrator profile not found' using errcode = 'P0002';
  end if;

  select owner_user_id, verification_status
  into v_owner_user_id, v_before_status
  from public.marketplace_sellers
  where id = p_seller_id
  for update;
  if not found then
    raise exception 'Marketplace seller not found' using errcode = 'P0002';
  end if;
  if v_before_status <> 'pending' then
    raise exception 'Only pending marketplace sellers can be reviewed' using errcode = '42501';
  end if;

  update public.marketplace_sellers
  set verification_status = p_status,
      verification_notes = nullif(trim(coalesce(p_notes, '')), '')
  where id = p_seller_id;

  insert into public.sarina_admin_audit_logs(
    actor_user_id, target_user_id, action, before_state, after_state
  )
  values (
    v_actor_user_id,
    v_owner_user_id,
    'marketplace_seller_review',
    jsonb_build_object('seller_id', p_seller_id, 'verification_status', v_before_status),
    jsonb_build_object('seller_id', p_seller_id, 'verification_status', p_status,
      'verification_notes', nullif(trim(coalesce(p_notes, '')), ''))
  );

  return jsonb_build_object('success', true, 'seller_id', p_seller_id, 'verification_status', p_status);
end;
$function$;

create or replace function public.admin_review_marketplace_product(
  p_product_id uuid,
  p_status text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_actor_user_id uuid;
  v_owner_user_id uuid;
  v_seller_id uuid;
  v_before_regulatory_status text;
  v_before_product_status text;
  v_category_code text;
  v_after_product_status text;
begin
  if auth.uid() is null or not private.is_sarina_admin() then
    raise exception 'Central administrator access required' using errcode = '42501';
  end if;
  if p_status not in ('verified', 'rejected') then
    raise exception 'Unsupported marketplace product review status' using errcode = '22023';
  end if;

  select id into v_actor_user_id
  from public.users
  where auth_user_id = auth.uid()
  limit 1;
  if v_actor_user_id is null then
    raise exception 'Administrator profile not found' using errcode = 'P0002';
  end if;

  select p.seller_id, s.owner_user_id, p.regulatory_status, p.status, c.code
  into v_seller_id, v_owner_user_id, v_before_regulatory_status, v_before_product_status, v_category_code
  from public.marketplace_products p
  join public.marketplace_sellers s on s.id = p.seller_id
  join public.marketplace_categories c on c.id = p.category_id
  where p.id = p_product_id
    and (p.regulated or c.code = 'crop_protection')
  for update of p;
  if not found then
    raise exception 'Regulated marketplace product not found' using errcode = 'P0002';
  end if;
  if v_before_regulatory_status not in ('not_reviewed', 'pending_review') then
    raise exception 'Marketplace product has already been reviewed' using errcode = '42501';
  end if;

  v_after_product_status := case when p_status = 'rejected' then 'draft' else v_before_product_status end;

  update public.marketplace_products
  set regulatory_status = p_status,
      regulatory_reviewed_at = now(),
      regulatory_metadata = coalesce(regulatory_metadata, '{}'::jsonb)
        || jsonb_build_object(
          'admin_review_notes', nullif(trim(coalesce(p_notes, '')), ''),
          'admin_reviewed_by', v_actor_user_id,
          'admin_reviewed_at', now()
        ),
      status = v_after_product_status,
      published_at = case when p_status = 'rejected' then null else published_at end
  where id = p_product_id;

  insert into public.sarina_admin_audit_logs(
    actor_user_id, target_user_id, action, before_state, after_state
  )
  values (
    v_actor_user_id,
    v_owner_user_id,
    'marketplace_regulated_product_review',
    jsonb_build_object(
      'product_id', p_product_id,
      'seller_id', v_seller_id,
      'regulatory_status', v_before_regulatory_status,
      'product_status', v_before_product_status
    ),
    jsonb_build_object(
      'product_id', p_product_id,
      'seller_id', v_seller_id,
      'regulatory_status', p_status,
      'product_status', v_after_product_status,
      'category_code', v_category_code,
      'review_notes', nullif(trim(coalesce(p_notes, '')), '')
    )
  );

  return jsonb_build_object(
    'success', true,
    'product_id', p_product_id,
    'regulatory_status', p_status,
    'product_status', v_after_product_status
  );
end;
$function$;

revoke all on function public.admin_list_marketplace_review_queue() from public, anon;
revoke all on function public.admin_review_marketplace_seller(uuid, text, text) from public, anon;
revoke all on function public.admin_review_marketplace_product(uuid, text, text) from public, anon;
grant execute on function public.admin_list_marketplace_review_queue() to authenticated;
grant execute on function public.admin_review_marketplace_seller(uuid, text, text) to authenticated;
grant execute on function public.admin_review_marketplace_product(uuid, text, text) to authenticated;
