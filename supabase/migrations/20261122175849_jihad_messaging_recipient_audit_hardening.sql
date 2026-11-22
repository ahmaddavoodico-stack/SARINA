revoke update on public.expert_authority_consents from authenticated;
grant update(status,revoked_at) on public.expert_authority_consents to authenticated;

create or replace function public.reply_institutional_message(p_thread_id uuid,p_message text)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_user uuid; v_id uuid; v_org uuid; v_code text; v_country uuid;
begin
 v_user:=public.current_sarina_user_id();
 if (select auth.uid()) is null or v_user is null then raise exception 'Authentication required'; end if;
 if length(trim(coalesce(p_message,'')))<1 or length(trim(p_message))>5000 then raise exception 'Message length is invalid'; end if;
 select organization_id,recipient_code,recipient_country_id into v_org,v_code,v_country from public.institutional_message_threads where id=p_thread_id and recipient_user_id=v_user and status='active' for update;
 if v_org is null then raise exception 'Active recipient thread not found'; end if;
 insert into public.institutional_messages(thread_id,sender_user_id,message_text) values(p_thread_id,v_user,trim(p_message)) returning id into v_id;
 update public.institutional_message_threads set updated_at=now() where id=p_thread_id;
 insert into public.institutional_access_audit_events(organization_id,actor_user_id,action_code,resource_type,resource_user_id,country_id,purpose_code,access_decision,metadata)
 values(v_org,v_user,'institutional.message.reply','institutional_message',v_user,v_country,'jihad_official_communication','granted',jsonb_build_object('recipient_code',v_code,'thread_id',p_thread_id,'message_id',v_id));
 return v_id;
end
$function$;
revoke all on function public.reply_institutional_message(uuid,text) from public,anon;
grant execute on function public.reply_institutional_message(uuid,text) to authenticated;
