create or replace function public.current_user_has_role(p_role_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users u
    join public.user_roles ur on ur.user_id=u.id
    join public.roles r on r.id=ur.role_id
    where u.auth_user_id=auth.uid()
      and u.account_status='active'
      and r.code=p_role_code
      and ur.scope_type='global'
      and ur.scope_id is null
  );
$$;
revoke all on function public.current_user_has_role(text) from public, anon;
grant execute on function public.current_user_has_role(text) to authenticated;
