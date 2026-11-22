create or replace function public.update_institutional_service_request(p_request_id uuid,p_status text,p_organization_response text default null,p_event_message text default null)
returns table(request_id uuid,old_status text,new_status text,updated_at timestamptz)
language plpgsql security definer set search_path=''
as $function$
declare v_actor uuid; v_org uuid; v_farmer uuid; v_farm uuid; v_country uuid; v_old text; v_now timestamptz:=now(); v_terminal boolean;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 v_actor:=public.current_sarina_user_id(); if v_actor is null then raise exception 'SARINA user profile required'; end if;
 if p_status not in ('needs_information','accepted','in_progress','forwarded_to_authority','awaiting_official_response','approved','rejected','completed','unable_to_route') then raise exception 'Unsupported institutional request status'; end if;
 if length(trim(coalesce(p_organization_response,'')))>5000 or length(trim(coalesce(p_event_message,'')))>3000 then raise exception 'Response text is too long'; end if;
 select r.organization_id,r.farmer_user_id,r.farm_id,u.country_id,r.status into v_org,v_farmer,v_farm,v_country,v_old
 from public.institutional_service_requests r join public.users u on u.id=r.farmer_user_id where r.id=p_request_id for update of r;
 if v_org is null then raise exception 'Institutional request not found'; end if;
 if not public.organization_has_scoped_access(v_org,'service.requests.manage',v_farmer,v_country,v_farm) then raise exception 'Organization membership, capability, or geographic scope denied'; end if;
 if v_old in ('completed','rejected','withdrawn') then raise exception 'Closed institutional request cannot be changed'; end if;
 if v_old='submitted' and p_status not in ('accepted','needs_information','in_progress','unable_to_route') then raise exception 'Invalid transition from submitted'; end if;
 if v_old='needs_information' and p_status not in ('accepted','in_progress','rejected','unable_to_route') then raise exception 'Invalid transition from needs_information'; end if;
 if v_old='accepted' and p_status not in ('in_progress','forwarded_to_authority','needs_information','completed','rejected') then raise exception 'Invalid transition from accepted'; end if;
 if v_old='in_progress' and p_status not in ('needs_information','forwarded_to_authority','awaiting_official_response','approved','rejected','completed') then raise exception 'Invalid transition from in_progress'; end if;
 if v_old='forwarded_to_authority' and p_status not in ('awaiting_official_response','approved','rejected','completed') then raise exception 'Invalid transition from forwarded_to_authority'; end if;
 if v_old='awaiting_official_response' and p_status not in ('approved','rejected','completed','in_progress') then raise exception 'Invalid transition from awaiting_official_response'; end if;
 v_terminal:=p_status in ('approved','rejected','completed');
 update public.institutional_service_requests set status=p_status,
  organization_response=case when nullif(trim(coalesce(p_organization_response,'')),'') is not null then trim(p_organization_response) else organization_response end,
  acknowledged_at=case when p_status in ('accepted','in_progress') then coalesce(acknowledged_at,v_now) else acknowledged_at end,
  resolved_at=case when v_terminal then v_now else null end,updated_at=v_now where id=p_request_id;
 insert into public.institutional_request_events(request_id,actor_user_id,actor_organization_id,event_type,from_status,to_status,message,is_visible_to_farmer,occurred_at)
 values(p_request_id,v_actor,v_org,'status_changed',v_old,p_status,coalesce(nullif(trim(p_event_message),''),nullif(trim(p_organization_response),'')),true,v_now);
 insert into public.institutional_access_audit_events(organization_id,actor_user_id,action_code,resource_type,resource_user_id,resource_farm_id,country_id,purpose_code,access_decision,request_id,metadata)
 values(v_org,v_actor,'institutional.request.status_update','institutional_service_request',v_farmer,v_farm,v_country,'jihad_casework','granted',p_request_id,jsonb_build_object('from_status',v_old,'to_status',p_status));
 return query select p_request_id,v_old,p_status,v_now;
end
$function$;
revoke all on function public.update_institutional_service_request(uuid,text,text,text) from public,anon;
grant execute on function public.update_institutional_service_request(uuid,text,text,text) to authenticated;
