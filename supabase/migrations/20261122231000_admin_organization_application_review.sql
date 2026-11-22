-- Central-admin review endpoint for organization applications.
-- The existing approval trigger provisions the verified organization and owner membership,
-- and enforces the uploaded legal-document requirement.

create table if not exists public.sarina_admin_application_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  application_id uuid not null,
  before_status text not null,
  after_status text not null,
  created_at timestamptz not null default now()
);
alter table public.sarina_admin_application_audit enable row level security;
revoke all on table public.sarina_admin_application_audit from public, anon, authenticated;

create or replace function public.admin_review_organization_application(
  p_application_id uuid,
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
  if p_status not in ('approved', 'rejected') then
    raise exception 'Unsupported application review status' using errcode = '22023';
  end if;
  select id into v_actor_user_id from public.users where auth_user_id=auth.uid() limit 1;
  if v_actor_user_id is null then
    raise exception 'Administrator profile not found' using errcode = 'P0002';
  end if;
  select status into v_before from public.organization_applications
    where id=p_application_id for update;
  if not found then
    raise exception 'Organization application not found' using errcode = 'P0002';
  end if;
  if v_before in ('approved','rejected') then
    raise exception 'This application has already been reviewed' using errcode = '42501';
  end if;
  update public.organization_applications set status=p_status where id=p_application_id;
  insert into public.sarina_admin_application_audit(actor_user_id,application_id,before_status,after_status)
    values(v_actor_user_id,p_application_id,v_before,p_status);
  return jsonb_build_object('success',true,'status',p_status);
end;
$function$;
revoke all on function public.admin_review_organization_application(uuid,text) from public, anon;
grant execute on function public.admin_review_organization_application(uuid,text) to authenticated;
