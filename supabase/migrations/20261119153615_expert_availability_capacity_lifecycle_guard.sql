-- Expire scheduled leave automatically and serialize capacity checks for new referrals.
create or replace function private.guard_expert_request_intake()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_verified text; v_visibility text; v_status text := 'available'; v_paused boolean := false;
  v_start timestamptz; v_end timestamptz; v_capacity integer := 10; v_open_count integer := 0;
begin
  select ep.verification_status, ep.profile_visibility into v_verified, v_visibility
    from public.expert_profiles ep where ep.id=new.assigned_expert_profile_id for update;
  if not found or v_verified <> 'verified' or v_visibility not in ('directory','public') then
    raise exception 'Selected expert is not eligible to receive a new case';
  end if;
  select av.availability_status, av.pause_new_cases, av.vacation_start, av.vacation_end, av.max_open_cases
    into v_status, v_paused, v_start, v_end, v_capacity
    from public.expert_availability av where av.expert_profile_id=new.assigned_expert_profile_id;
  if coalesce(v_paused,false)
     or (coalesce(v_status,'available')='away' and (v_end is null or now() <= v_end))
     or (v_start is not null and now() >= v_start and (v_end is null or now() <= v_end)) then
    raise exception 'Selected expert is currently unavailable for new cases';
  end if;
  select count(*) into v_open_count from public.expert_requests er
    where er.assigned_expert_profile_id=new.assigned_expert_profile_id
      and er.status in ('submitted','assigned','in_progress','waiting_user');
  if v_open_count >= coalesce(v_capacity,10) then raise exception 'Selected expert has reached the open-case capacity'; end if;
  return new;
end; $$;
drop trigger if exists expert_request_intake_capacity_guard on public.expert_requests;
create trigger expert_request_intake_capacity_guard before insert on public.expert_requests
for each row execute function private.guard_expert_request_intake();

drop policy if exists expert_requests_farmer_insert on public.expert_requests;
create policy expert_requests_farmer_insert on public.expert_requests
for insert to authenticated
with check (
  requester_user_id=public.current_sarina_user_id()
  and farm_id is not null and consent_at is not null and consent_scope <> '{}'::jsonb
  and requested_mode='in_app_message' and status in ('draft','submitted')
  and exists (select 1 from public.farms f where f.id=expert_requests.farm_id and f.owner_user_id=public.current_sarina_user_id())
  and exists (select 1 from public.expert_profiles ep
    where ep.id=expert_requests.assigned_expert_profile_id and ep.verification_status='verified'
      and ep.profile_visibility in ('directory','public')
      and not exists (select 1 from public.expert_availability av where av.expert_profile_id=ep.id
        and (av.pause_new_cases
          or (av.availability_status='away' and (av.vacation_end is null or now() <= av.vacation_end))
          or (av.vacation_start is not null and now() >= av.vacation_start and (av.vacation_end is null or now() <= av.vacation_end))))
      and (select count(*) from public.expert_requests active where active.assigned_expert_profile_id=ep.id
        and active.status in ('submitted','assigned','in_progress','waiting_user'))
        < coalesce((select av.max_open_cases from public.expert_availability av where av.expert_profile_id=ep.id),10)
  )
);
drop policy if exists expert_assignments_farmer_insert on public.expert_request_assignments;
create policy expert_assignments_farmer_insert on public.expert_request_assignments
for insert to authenticated
with check (assignment_status='offered' and exists (
  select 1 from public.expert_requests er join public.expert_profiles ep on ep.id=er.assigned_expert_profile_id
  where er.id=expert_request_assignments.request_id and er.requester_user_id=public.current_sarina_user_id()
    and ep.id=expert_request_assignments.expert_profile_id and ep.verification_status='verified'
    and not exists (select 1 from public.expert_availability av where av.expert_profile_id=ep.id
      and (av.pause_new_cases
        or (av.availability_status='away' and (av.vacation_end is null or now() <= av.vacation_end))
        or (av.vacation_start is not null and now() >= av.vacation_start and (av.vacation_end is null or now() <= av.vacation_end))))
));

drop policy if exists expert_case_handovers_assigned_expert_insert on public.expert_case_handovers;
create policy expert_case_handovers_assigned_expert_insert on public.expert_case_handovers
for insert to authenticated
with check (status='awaiting_farmer_consent' and exists (
  select 1 from public.expert_requests er
  join public.expert_profiles from_ep on from_ep.id=from_expert_profile_id
  join public.expert_profiles to_ep on to_ep.id=to_expert_profile_id
  where er.id=request_id and er.requester_user_id=requester_user_id
    and er.assigned_expert_profile_id=from_expert_profile_id
    and from_ep.user_id=public.current_sarina_user_id() and from_ep.verification_status='verified'
    and to_ep.verification_status='verified' and to_ep.id<>from_ep.id
    and not exists (select 1 from public.expert_availability av where av.expert_profile_id=to_ep.id
      and (av.pause_new_cases
        or (av.availability_status='away' and (av.vacation_end is null or now() <= av.vacation_end))
        or (av.vacation_start is not null and now() >= av.vacation_start and (av.vacation_end is null or now() <= av.vacation_end))))
    and (select count(*) from public.expert_requests active where active.assigned_expert_profile_id=to_ep.id
      and active.status in ('submitted','assigned','in_progress','waiting_user'))
      < coalesce((select av.max_open_cases from public.expert_availability av where av.expert_profile_id=to_ep.id),10)
));

create or replace function public.respond_to_expert_case_handover(p_handover_id uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_handover public.expert_case_handovers%rowtype;
  v_capacity integer := 10; v_open_count integer := 0;
  v_availability public.expert_availability%rowtype;
begin
  select * into v_handover from public.expert_case_handovers where id=p_handover_id for update;
  if not found or v_handover.requester_user_id <> public.current_sarina_user_id()
     or v_handover.status <> 'awaiting_farmer_consent' then
    raise exception 'Handover request is unavailable for this farmer';
  end if;
  if p_accept then
    select * into v_availability from public.expert_availability where expert_profile_id=v_handover.to_expert_profile_id for update;
    if found then
      if v_availability.pause_new_cases
        or (v_availability.availability_status='away' and (v_availability.vacation_end is null or now() <= v_availability.vacation_end))
        or (v_availability.vacation_start is not null and now() >= v_availability.vacation_start and (v_availability.vacation_end is null or now() <= v_availability.vacation_end)) then
        raise exception 'The proposed substitute is currently unavailable';
      end if;
      v_capacity := v_availability.max_open_cases;
    end if;
    select count(*) into v_open_count from public.expert_requests er
      where er.assigned_expert_profile_id=v_handover.to_expert_profile_id
        and er.status in ('submitted','assigned','in_progress','waiting_user');
    if v_open_count >= v_capacity then raise exception 'The proposed substitute has reached the open-case capacity'; end if;
    update public.expert_case_handovers set status='awaiting_substitute_acceptance', farmer_responded_at=now() where id=p_handover_id;
    insert into public.expert_request_assignments(request_id,expert_profile_id,assignment_status,offered_at)
      values (v_handover.request_id,v_handover.to_expert_profile_id,'offered',now())
      on conflict (request_id,expert_profile_id) do update set assignment_status='offered',offered_at=now(),responded_at=null;
    insert into public.expert_case_notifications(recipient_user_id,actor_user_id,request_id,event_type,preview)
      select ep.user_id,public.current_sarina_user_id(),v_handover.request_id,'case_handover_offered',
        'یک پرونده با رضایت کشاورز برای پذیرش جایگزینی به شما ارجاع شده است.'
      from public.expert_profiles ep where ep.id=v_handover.to_expert_profile_id;
  else
    update public.expert_case_handovers set status='declined',farmer_responded_at=now() where id=p_handover_id;
    insert into public.expert_case_notifications(recipient_user_id,actor_user_id,request_id,event_type,preview)
      values(v_handover.requester_user_id,public.current_sarina_user_id(),v_handover.request_id,
        'case_handover_declined','درخواست جایگزینی متخصص تأیید نشد؛ پرونده نزد متخصص فعلی باقی می‌ماند.');
  end if;
  return jsonb_build_object('success',true,'status',case when p_accept then 'awaiting_substitute_acceptance' else 'declined' end);
end; $$;
revoke all on function public.respond_to_expert_case_handover(uuid,boolean) from public, anon;
grant execute on function public.respond_to_expert_case_handover(uuid,boolean) to authenticated;
