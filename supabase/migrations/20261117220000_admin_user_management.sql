-- SARINA: secure central-admin user role management
-- This migration is intentionally additive. It does not alter existing user accounts or role assignments.

create table if not exists public.sarina_admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  target_user_id uuid references public.users(id) on delete set null,
  action text not null check (action in ('user_roles_updated')),
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sarina_admin_audit_target_created_idx
  on public.sarina_admin_audit_logs(target_user_id, created_at desc);

alter table public.sarina_admin_audit_logs enable row level security;
revoke all on table public.sarina_admin_audit_logs from anon, authenticated;

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
      array_agg(distinct r.code order by r.code) filter (where r.code is not null),
      array[]::text[]
    )
  from public.users u
  left join public.user_roles ur on ur.user_id = u.id
  left join public.roles r on r.id = ur.role_id
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

  select coalesce(array_agg(distinct r.code order by r.code), array[]::text[])
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

  select coalesce(array_agg(distinct r.code order by r.code), array[]::text[])
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

revoke all on function public.admin_list_sarina_users() from public, anon;
revoke all on function public.admin_set_sarina_user_roles(uuid, text[]) from public, anon;
grant execute on function public.admin_list_sarina_users() to authenticated;
grant execute on function public.admin_set_sarina_user_roles(uuid, text[]) to authenticated;
