-- Automatically provision a minimal public.users profile for each non-anonymous Auth user.
-- Authorization/role assignment remains a separate, explicit workflow.

create or replace function private.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Anonymous Auth users have neither email nor phone and are not farmer accounts.
  if nullif(new.email, '') is null and nullif(new.phone, '') is null then
    return new;
  end if;

  insert into public.users (
    auth_user_id,
    email,
    phone_e164,
    full_name
  )
  values (
    new.id,
    nullif(new.email, ''),
    nullif(new.phone, ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '')
  )
  on conflict (auth_user_id) do nothing;

  return new;
end;
$$;

comment on function private.handle_new_auth_user_profile() is
  'Creates a minimal public.users profile for a new non-anonymous Supabase Auth user; does not assign roles or activate the account.';

revoke all on function private.handle_new_auth_user_profile() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_create_public_user_profile on auth.users;

create trigger on_auth_user_created_create_public_user_profile
  after insert on auth.users
  for each row
  execute function private.handle_new_auth_user_profile();

-- Repair existing Auth accounts that predate this trigger and still lack a profile.
-- Existing profiles, account statuses, and role assignments are left untouched.
insert into public.users (
  auth_user_id,
  email,
  phone_e164,
  full_name
)
select
  au.id,
  nullif(au.email, ''),
  nullif(au.phone, ''),
  nullif(btrim(au.raw_user_meta_data ->> 'full_name'), '')
from auth.users as au
where (nullif(au.email, '') is not null or nullif(au.phone, '') is not null)
  and not exists (
    select 1
    from public.users as u
    where u.auth_user_id = au.id
  )
on conflict (auth_user_id) do nothing;
