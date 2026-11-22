-- Keep global administrators out of the ordinary user-management roster.
-- Also enforce their protection in the database, not only in the UI.

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
  left join public.user_roles ur
    on ur.user_id = u.id and ur.scope_type = 'global' and ur.scope_id is null
  left join public.roles r on r.id = ur.role_id
  where not exists (
    select 1
    from public.user_roles admin_ur
    join public.roles admin_role on admin_role.id = admin_ur.role_id
    where admin_ur.user_id = u.id
      and admin_ur.scope_type = 'global'
      and admin_ur.scope_id is null
      and admin_role.code = 'admin'
  )
  group by u.id
  order by u.created_at desc;
end;
$function$;

create or replace function public.admin_set_sarina_user_roles(
  p_target_user_id uuid,
  p_role_codes text[]
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_actor_user_id uuid;
  v_before text[];
  v_after text[];
  v_requested text[];
begin
  if auth.uid() is null or not private.is_sarina_admin() then
    raise exception 'Central administrator access required' using errcode = '42501';
  end if;

  select id into v_actor_user_id
  from public.users
  where auth_user_id = auth.uid()
  limit 1;

  if v_actor_user_id is null then
    raise exception 'Administrator profile not found' using errcode = 'P0002';
  end if;

  if p_target_user_id is null or p_target_user_id = v_actor_user_id then
    raise exception 'Administrators cannot change their own account roles here' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_target_user_id
      and ur.scope_type = 'global'
      and ur.scope_id is null
      and r.code = 'admin'
  ) then
    raise exception 'Global administrator accounts cannot be managed through the user roles panel'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.users where id = p_target_user_id) then
    raise exception 'Target user not found' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(distinct code order by code), array[]::text[])
  into v_requested
  from unnest(coalesce(p_role_codes, array[]::text[])) as requested(code)
  where code is not null and btrim(code) <> '';

  if exists (
    select 1 from unnest(v_requested) requested(code)
    where code not in ('farmer', 'livestock_keeper', 'expert', 'organization')
  ) then
    raise exception 'One or more roles cannot be assigned through this panel' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct r.code::text order by r.code::text), array[]::text[])
  into v_before
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = p_target_user_id
    and ur.scope_type = 'global'
    and ur.scope_id is null
    and r.code <> 'admin';

  delete from public.user_roles ur
  using public.roles r
  where ur.role_id = r.id
    and ur.user_id = p_target_user_id
    and ur.scope_type = 'global'
    and ur.scope_id is null
    and r.code <> 'admin';

  insert into public.user_roles(user_id, role_id, scope_type, scope_id, granted_by)
  select p_target_user_id, r.id, 'global', null, v_actor_user_id
  from public.roles r
  where r.code = any(v_requested)
  on conflict (user_id, role_id) where scope_type = 'global' and scope_id is null
  do update set granted_by = excluded.granted_by, granted_at = now();

  select coalesce(array_agg(distinct r.code::text order by r.code::text), array[]::text[])
  into v_after
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = p_target_user_id
    and ur.scope_type = 'global'
    and ur.scope_id is null
    and r.code <> 'admin';

  insert into public.sarina_admin_audit_logs(
    actor_user_id, target_user_id, action, before_state, after_state
  ) values (
    v_actor_user_id,
    p_target_user_id,
    'user_roles_updated',
    jsonb_build_object('role_codes', v_before),
    jsonb_build_object('role_codes', v_after)
  );

  return jsonb_build_object('success', true, 'role_codes', v_after);
end;
$function$;

create or replace function public.admin_set_sarina_user_status(
  p_target_user_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_actor_user_id uuid;
  v_before text;
begin
  if auth.uid() is null or not private.is_sarina_admin() then
    raise exception 'Central administrator access required' using errcode = '42501';
  end if;

  select id into v_actor_user_id
  from public.users where auth_user_id = auth.uid() limit 1;

  if v_actor_user_id is null then
    raise exception 'Administrator profile not found' using errcode = 'P0002';
  end if;

  if p_target_user_id is null or p_target_user_id = v_actor_user_id then
    raise exception 'Administrators cannot change their own account status here' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_target_user_id
      and ur.scope_type = 'global'
      and ur.scope_id is null
      and r.code = 'admin'
  ) then
    raise exception 'Global administrator accounts cannot be managed through the user management panel'
      using errcode = '42501';
  end if;

  if p_status not in ('active', 'suspended') then
    raise exception 'Only activation and suspension are supported' using errcode = '22023';
  end if;

  select account_status into v_before
  from public.users where id = p_target_user_id for update;

  if not found then
    raise exception 'Target user not found' using errcode = 'P0002';
  end if;

  if v_before = 'closed' then
    raise exception 'Closed accounts cannot be reactivated from this panel' using errcode = '42501';
  end if;

  if v_before = p_status then
    return jsonb_build_object('success', true, 'account_status', v_before, 'unchanged', true);
  end if;

  update public.users set account_status = p_status, updated_at = now()
  where id = p_target_user_id;

  insert into public.sarina_admin_account_status_audit(
    actor_user_id, target_user_id, before_status, after_status
  ) values (v_actor_user_id, p_target_user_id, v_before, p_status);

  return jsonb_build_object('success', true, 'account_status', p_status);
end;
$function$;

revoke all on function public.admin_list_sarina_users() from public, anon;
revoke all on function public.admin_set_sarina_user_roles(uuid, text[]) from public, anon;
revoke all on function public.admin_set_sarina_user_status(uuid, text) from public, anon;
grant execute on function public.admin_list_sarina_users() to authenticated;
grant execute on function public.admin_set_sarina_user_roles(uuid, text[]) to authenticated;
grant execute on function public.admin_set_sarina_user_status(uuid, text) to authenticated;
