-- Fix admin user list RPC return type mismatch (roles.code is varchar, RPC declares text[])
create or replace function public.admin_list_sarina_users()
returns table (
  id uuid,
  full_name text,
  email text,
  account_status text,
  created_at timestamptz,
  role_codes text[]
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
begin
  if auth.uid() is null or not private.is_sarina_admin() then
    raise exception 'Central administrator access required' using errcode = '42501';
  end if;

  return query
  select
    u.id,
    u.full_name::text,
    u.email::text,
    u.account_status::text,
    u.created_at,
    coalesce(
      array_agg(distinct r.code::text order by r.code::text) filter (where r.code is not null),
      array[]::text[]
    )
  from public.users u
  left join public.user_roles ur on ur.user_id = u.id and ur.scope_type = 'global' and ur.scope_id is null
  left join public.roles r on r.id = ur.role_id
  group by u.id
  order by u.created_at desc;
end;
$function$;

revoke all on function public.admin_list_sarina_users() from public, anon;
grant execute on function public.admin_list_sarina_users() to authenticated;
