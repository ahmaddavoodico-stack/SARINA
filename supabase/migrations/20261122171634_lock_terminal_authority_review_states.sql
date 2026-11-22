create or replace function public.review_authority_onboarding_request(p_request_id uuid,p_new_status text,p_review_notes text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_request public.authority_onboarding_requests%rowtype; v_actor uuid; v_admin_user_id uuid;
begin
 if (select auth.uid()) is null or not coalesce(public.is_sarina_admin(),false) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_new_status not in ('under_review','needs_correction','approved','rejected') then raise exception 'invalid_review_status' using errcode='22023'; end if;
 if p_new_status in ('needs_correction','rejected') and nullif(btrim(p_review_notes),'') is null then raise exception 'review_notes_required' using errcode='22023'; end if;
 select * into v_request from public.authority_onboarding_requests where id=p_request_id for update;
 if not found then raise exception 'request_not_found' using errcode='P0002'; end if;
 if v_request.status in ('approved','rejected','withdrawn') then raise exception 'request_is_closed' using errcode='55000'; end if;
 if p_new_status='approved' then
  select u.id into v_admin_user_id from public.users u
  where lower(btrim(u.email))=lower(btrim(v_request.proposed_admin_email))
    and u.auth_user_id is not null and u.account_status='active' limit 1;
  if v_admin_user_id is null then
   raise exception 'proposed_admin_account_not_verified' using errcode='23514',
   detail='Proposed administrator email must match an active authenticated SARINA account. No account or membership is created automatically.';
  end if;
 end if;
 v_actor:=public.current_sarina_user_id();
 update public.authority_onboarding_requests set status=p_new_status,review_notes=nullif(btrim(p_review_notes),''),reviewed_by_user_id=v_actor,reviewed_at=now(),updated_at=now() where id=p_request_id;
 return jsonb_build_object('ok',true,'request_id',p_request_id,'status',p_new_status,'matched_admin_user_id',case when p_new_status='approved' then v_admin_user_id else null end,'provisioned',false);
end; $$;
revoke execute on function public.review_authority_onboarding_request(uuid,text,text) from public,anon;
grant execute on function public.review_authority_onboarding_request(uuid,text,text) to authenticated;
