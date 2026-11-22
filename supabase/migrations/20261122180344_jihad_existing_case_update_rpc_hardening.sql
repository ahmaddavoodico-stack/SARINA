create or replace function public.organization_update_institutional_request(
 p_request_id uuid,p_new_status text,p_message text default null,p_official_reference text default null,p_external_tracking_reference text default null
)
returns boolean language plpgsql security definer set search_path='pg_catalog'
as $function$
declare v_request public.institutional_service_requests%rowtype; v_country_id uuid; v_actor uuid; v_terminal boolean;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 v_actor:=public.current_sarina_user_id(); if v_actor is null then raise exception 'SARINA user profile required'; end if;
 select * into v_request from public.institutional_service_requests where id=p_request_id for update;
 if not found then raise exception 'Request not found'; end if;
 select country_id into v_country_id from public.users where id=v_request.farmer_user_id;
 if not public.is_sarina_admin() and not public.organization_has_scoped_access(v_request.organization_id,'service.requests.manage',v_request.farmer_user_id,v_country_id,v_request.farm_id) then raise exception 'Not authorized for this request'; end if;
 if p_new_status not in ('needs_information','accepted','in_progress','forwarded_to_authority','awaiting_official_response','approved','rejected','completed','unable_to_route') then raise exception 'Invalid target status'; end if;
 if v_request.status in ('approved','completed','rejected','withdrawn','unable_to_route') then raise exception 'Request is already closed'; end if;
 if v_request.status='submitted' and p_new_status not in ('accepted','needs_information','in_progress','unable_to_route') then raise exception 'Invalid transition from submitted'; end if;
 if v_request.status='needs_information' and p_new_status not in ('accepted','in_progress','rejected','unable_to_route') then raise exception 'Invalid transition from needs_information'; end if;
 if v_request.status='accepted' and p_new_status not in ('in_progress','forwarded_to_authority','needs_information','completed','rejected') then raise exception 'Invalid transition from accepted'; end if;
 if v_request.status='in_progress' and p_new_status not in ('needs_information','forwarded_to_authority','awaiting_official_response','approved','rejected','completed') then raise exception 'Invalid transition from in_progress'; end if;
 if v_request.status='forwarded_to_authority' and p_new_status not in ('awaiting_official_response','approved','rejected','completed') then raise exception 'Invalid transition from forwarded_to_authority'; end if;
 if v_request.status='awaiting_official_response' and p_new_status not in ('approved','rejected','completed','in_progress') then raise exception 'Invalid transition from awaiting_official_response'; end if;
 v_terminal:=p_new_status in ('approved','rejected','completed','unable_to_route');
 update public.institutional_service_requests set status=p_new_status,
  organization_response=coalesce(nullif(trim(p_message),''),organization_response),
  official_reference=coalesce(nullif(trim(p_official_reference),''),official_reference),
  external_tracking_reference=coalesce(nullif(trim(p_external_tracking_reference),''),external_tracking_reference),
  acknowledged_at=case when p_new_status in ('accepted','in_progress','needs_information') then coalesce(acknowledged_at,now()) else acknowledged_at end,
  official_submission_at=case when p_new_status in ('forwarded_to_authority','awaiting_official_response') then coalesce(official_submission_at,now()) else official_submission_at end,
  resolved_at=case when v_terminal then now() else null end,updated_at=now() where id=p_request_id;
 insert into public.institutional_request_events(request_id,actor_user_id,actor_organization_id,event_type,from_status,to_status,message,metadata,is_visible_to_farmer)
 values(p_request_id,v_actor,v_request.organization_id,'status_changed',v_request.status,p_new_status,p_message,
  jsonb_strip_nulls(jsonb_build_object('official_reference',p_official_reference,'external_tracking_reference',p_external_tracking_reference)),true);
 insert into public.institutional_access_audit_events(organization_id,actor_user_id,action_code,resource_type,resource_user_id,resource_farm_id,country_id,purpose_code,access_decision,request_id,metadata)
 values(v_request.organization_id,v_actor,'institutional.request.status_update','institutional_service_request',v_request.farmer_user_id,v_request.farm_id,v_country_id,
  'jihad_casework','granted',p_request_id,jsonb_build_object('from_status',v_request.status,'to_status',p_new_status,'legacy_rpc',true));
 return true;
end
$function$;
revoke all on function public.organization_update_institutional_request(uuid,text,text,text,text) from public,anon;
grant execute on function public.organization_update_institutional_request(uuid,text,text,text,text) to authenticated;
