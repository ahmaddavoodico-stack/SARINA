-- Central-admin account approval and suspension controls.
-- Approval changes only account_status; role assignment remains a separate audited action.

create table if not exists public.sarina_admin_account_status_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  target_user_id uuid references public.users(id) on delete set null,
  before_status text not null,
  after_status text not null,
  created_at timestamptz not null default now()
);
create index if not exists sarina_admin_account_status_audit_target_idx
  on public.sarina_admin_account_status_audit(target_user_id, created_at desc);
alter table public.sarina_admin_account_status_audit enable row level security;
revoke all on table public.sarina_admin_account_status_audit from public, anon, authenticated;

create or replace function public.admin_set_sarina_user_status(
  p_target_user_id uuid,
  p_status text
) returns jsonb
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

revoke all on function public.admin_set_sarina_user_status(uuid, text) from public, anon;
grant execute on function public.admin_set_sarina_user_status(uuid, text) to authenticated;
