create or replace function private.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  submitted_phone text;
begin
  submitted_phone := coalesce(
    nullif(btrim(new.phone), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'phone_e164'), '')
  );

  if nullif(new.email, '') is null and submitted_phone is null then
    return new;
  end if;

  insert into public.users (auth_user_id, email, phone_e164, full_name)
  values (
    new.id,
    nullif(new.email, ''),
    submitted_phone,
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '')
  )
  on conflict (auth_user_id) do update
    set email = excluded.email,
        phone_e164 = coalesce(excluded.phone_e164, public.users.phone_e164),
        full_name = coalesce(excluded.full_name, public.users.full_name);

  return new;
end;
$function$;