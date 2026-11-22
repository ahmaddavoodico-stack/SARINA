create or replace function public.revoke_my_farmer_authority_consent(p_consent_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_rows integer;
begin
  v_user_id := public.current_sarina_user_id();
  if v_user_id is null then
    raise exception 'Authenticated SARINA user profile is required';
  end if;

  update public.farmer_authority_consents
     set status = 'revoked',
         revoked_at = now()
   where id = p_consent_id
     and user_id = v_user_id
     and status = 'active';

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$function$;

revoke all on function public.revoke_my_farmer_authority_consent(uuid) from public, anon;
grant execute on function public.revoke_my_farmer_authority_consent(uuid) to authenticated;
