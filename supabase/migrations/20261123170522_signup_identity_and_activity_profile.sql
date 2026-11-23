alter table public.users
  add column if not exists username text,
  add column if not exists registration_track text,
  add column if not exists livestock_types text[] not null default '{}',
  add column if not exists has_shop boolean,
  add column if not exists organization_region text,
  add column if not exists organization_region_scope text;

create unique index if not exists users_username_ci_unique
  on public.users (lower(username))
  where username is not null and btrim(username) <> '';

create or replace function private.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  submitted_phone text;
  submitted_username text;
  submitted_livestock text[];
  submitted_shop boolean;
begin
  submitted_phone := coalesce(
    nullif(btrim(new.phone), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'phone_e164'), '')
  );
  submitted_username := nullif(lower(btrim(new.raw_user_meta_data ->> 'username')), '');
  submitted_livestock := case
    when jsonb_typeof(new.raw_user_meta_data -> 'livestock_types') = 'array'
      then array(select jsonb_array_elements_text(new.raw_user_meta_data -> 'livestock_types'))
    else '{}'::text[]
  end;
  submitted_shop := case
    when jsonb_typeof(new.raw_user_meta_data -> 'has_shop') = 'boolean'
      then (new.raw_user_meta_data ->> 'has_shop')::boolean
    else null
  end;

  if nullif(new.email, '') is null and submitted_phone is null then
    return new;
  end if;

  insert into public.users (
    auth_user_id, email, phone_e164, full_name, username,
    registration_track, livestock_types, has_shop,
    organization_region, organization_region_scope
  )
  values (
    new.id,
    nullif(new.email, ''),
    submitted_phone,
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    submitted_username,
    nullif(btrim(new.raw_user_meta_data ->> 'registration_track'), ''),
    submitted_livestock,
    submitted_shop,
    nullif(btrim(new.raw_user_meta_data ->> 'organization_region'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'organization_region_scope'), '')
  )
  on conflict (auth_user_id) do update
    set email = excluded.email,
        phone_e164 = coalesce(excluded.phone_e164, public.users.phone_e164),
        full_name = coalesce(excluded.full_name, public.users.full_name),
        username = coalesce(excluded.username, public.users.username),
        registration_track = coalesce(excluded.registration_track, public.users.registration_track),
        livestock_types = case when cardinality(excluded.livestock_types) > 0
          then excluded.livestock_types else public.users.livestock_types end,
        has_shop = coalesce(excluded.has_shop, public.users.has_shop),
        organization_region = coalesce(excluded.organization_region, public.users.organization_region),
        organization_region_scope = coalesce(excluded.organization_region_scope, public.users.organization_region_scope);

  return new;
end;
$function$;