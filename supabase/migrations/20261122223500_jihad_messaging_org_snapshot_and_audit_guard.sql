alter table public.institutional_message_threads add column if not exists organization_display_name text;

create or replace function public.lookup_institutional_message_recipient(p_organization_id uuid,p_public_code text)
returns table(recipient_kind text,public_code text,display_name text,consent_expires_at timestamptz)
language plpgsql security definer set search_path=''
as $function$
declare v record;
begin
  if p_organization_id is null or not exists(select 1 from public.organizations o where o.id=p_organization_id and o.status='verified' and o.organization_type in ('government','regulator','support_agency','public_institution')) then return; end if;
  select * into v from public.resolve_institutional_message_recipient(p_organization_id,p_public_code) limit 1;
  insert into public.institutional_access_audit_events(organization_id,actor_user_id,action_code,resource_type,resource_user_id,country_id,purpose_code,access_decision,metadata)
  values(p_organization_id,public.current_sarina_user_id(),'institutional.message.recipient_lookup','institutional_message',v.recipient_user_id,v.country_id,'jihad_official_communication',case when v.recipient_user_id is null then 'scope_denied' else 'granted' end,jsonb_build_object('recipient_code',upper(trim(coalesce(p_public_code,''))),'recipient_kind',v.recipient_kind));
  if v.recipient_user_id is null then return; end if;
  return query select v.recipient_kind,v.public_code,v.display_name,v.consent_expires_at;
end
$function$;
revoke all on function public.lookup_institutional_message_recipient(uuid,text) from public,anon;
grant execute on function public.lookup_institutional_message_recipient(uuid,text) to authenticated;

create or replace function public.send_institutional_message(p_organization_id uuid,p_public_code text,p_subject text,p_message text)
returns table(thread_id uuid,message_id uuid,recipient_kind text,recipient_name text)
language plpgsql security definer set search_path=''
as $function$
declare v record; v_actor uuid; v_thread uuid; v_message uuid; v_subject text; v_body text; v_org_name text;
begin
 v_actor:=public.current_sarina_user_id(); v_subject:=trim(coalesce(p_subject,'')); v_body:=trim(coalesce(p_message,''));
 if (select auth.uid()) is null or v_actor is null then raise exception 'Authentication required'; end if;
 if length(v_subject)<1 or length(v_subject)>180 or length(v_body)<1 or length(v_body)>5000 then raise exception 'Subject or message length is invalid'; end if;
 select o.display_name into v_org_name from public.organizations o where o.id=p_organization_id and o.status='verified' and o.organization_type in ('government','regulator','support_agency','public_institution');
 if v_org_name is null then raise exception 'Verified public authority organization required'; end if;
 select * into v from public.resolve_institutional_message_recipient(p_organization_id,p_public_code) limit 1;
 if v.recipient_user_id is null then
  insert into public.institutional_access_audit_events(organization_id,actor_user_id,action_code,resource_type,purpose_code,access_decision,metadata)
  values(p_organization_id,v_actor,'institutional.message.send','institutional_message','jihad_official_communication','scope_denied',jsonb_build_object('recipient_code',upper(trim(coalesce(p_public_code,'')))));
  raise exception 'Recipient not found, consent missing, or organization scope does not permit messaging';
 end if;
 insert into public.institutional_message_threads(organization_id,organization_display_name,created_by_user_id,recipient_user_id,recipient_kind,recipient_code,recipient_country_id,subject)
 values(p_organization_id,v_org_name,v_actor,v.recipient_user_id,v.recipient_kind,v.public_code,v.country_id,v_subject)
 on conflict(organization_id,recipient_user_id) do update set organization_display_name=excluded.organization_display_name,recipient_kind=excluded.recipient_kind,recipient_code=excluded.recipient_code,recipient_country_id=excluded.recipient_country_id,subject=excluded.subject,status='active',updated_at=now()
 returning id into v_thread;
 insert into public.institutional_messages(thread_id,sender_user_id,message_text) values(v_thread,v_actor,v_body) returning id into v_message;
 update public.institutional_message_threads set updated_at=now() where id=v_thread;
 insert into public.institutional_access_audit_events(organization_id,actor_user_id,action_code,resource_type,resource_user_id,country_id,purpose_code,access_decision,metadata)
 values(p_organization_id,v_actor,'institutional.message.send','institutional_message',v.recipient_user_id,v.country_id,'jihad_official_communication','granted',jsonb_build_object('recipient_code',v.public_code,'recipient_kind',v.recipient_kind,'thread_id',v_thread,'message_id',v_message));
 return query select v_thread,v_message,v.recipient_kind,v.display_name;
end
$function$;
revoke all on function public.send_institutional_message(uuid,text,text,text) from public,anon;
grant execute on function public.send_institutional_message(uuid,text,text,text) to authenticated;
