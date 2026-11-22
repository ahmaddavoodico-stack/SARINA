create or replace function public.ensure_my_sarina_farmer_identifier()
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_account_status text;
  v_status text;
  v_code text;
begin
  v_user_id := public.current_sarina_user_id();
  if v_user_id is null then
    raise exception 'Authenticated SARINA user profile is required';
  end if;

  select u.account_status into v_account_status
  from public.users u
  where u.id = v_user_id
  for update;

  if not found or v_account_status <> 'active' then
    raise exception 'An active SARINA account is required';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = v_user_id
      and r.code = 'farmer'
  ) then
    raise exception 'A farmer role is required to issue a farmer identifier';
  end if;

  select i.status, i.public_code into v_status, v_code
  from public.farmer_public_identifiers i
  where i.user_id = v_user_id and i.status in ('active','suspended')
  order by i.issued_at desc
  limit 1;

  if v_status = 'active' then
    return v_code;
  elsif v_status = 'suspended' then
    raise exception 'Farmer identifier is suspended; contact SARINA support';
  end if;

  loop
    v_code := 'SRN-' ||
      substr(upper(replace(gen_random_uuid()::text, '-', '')), 1, 4) || '-' ||
      substr(upper(replace(gen_random_uuid()::text, '-', '')), 5, 4) || '-' ||
      substr(upper(replace(gen_random_uuid()::text, '-', '')), 9, 4) || '-' ||
      substr(upper(replace(gen_random_uuid()::text, '-', '')), 13, 4);
    insert into public.farmer_public_identifiers(user_id, public_code)
    values (v_user_id, v_code)
    on conflict (public_code) do nothing;
    if found then
      return v_code;
    end if;
  end loop;
end;
$function$;

revoke all on function public.ensure_my_sarina_farmer_identifier() from public, anon;
grant execute on function public.ensure_my_sarina_farmer_identifier() to authenticated;
