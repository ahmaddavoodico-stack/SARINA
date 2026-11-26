-- Close the farmer-consent identity spoofing path in specialist case handovers.
-- Forward-only: repairs the INSERT policy and independently binds RPC consent
-- to the request's canonical owner and currently assigned specialist.

begin;

drop policy if exists expert_case_handovers_assigned_expert_insert
  on public.expert_case_handovers;

create policy expert_case_handovers_assigned_expert_insert
on public.expert_case_handovers
for insert
to authenticated
with check (
  status = 'awaiting_farmer_consent'
  and exists (
    select 1
    from public.expert_requests er
    join public.expert_profiles from_ep
      on from_ep.id = expert_case_handovers.from_expert_profile_id
    join public.expert_profiles to_ep
      on to_ep.id = expert_case_handovers.to_expert_profile_id
    where er.id = expert_case_handovers.request_id
      and er.requester_user_id = expert_case_handovers.requester_user_id
      and er.assigned_expert_profile_id = expert_case_handovers.from_expert_profile_id
      and from_ep.user_id = (select public.current_sarina_user_id())
      and from_ep.verification_status = 'verified'
      and to_ep.verification_status = 'verified'
      and to_ep.id <> from_ep.id
      and not exists (
        select 1
        from public.expert_availability av
        where av.expert_profile_id = to_ep.id
          and (
            av.pause_new_cases
            or (
              av.availability_status = 'away'
              and (av.vacation_end is null or now() <= av.vacation_end)
            )
            or (
              av.vacation_start is not null
              and now() >= av.vacation_start
              and (av.vacation_end is null or now() <= av.vacation_end)
            )
          )
      )
      and (
        select count(*)
        from public.expert_requests active
        where active.assigned_expert_profile_id = to_ep.id
          and active.status in ('submitted','assigned','in_progress','waiting_user')
      ) < coalesce((
        select av.max_open_cases
        from public.expert_availability av
        where av.expert_profile_id = to_ep.id
      ), 10)
  )
);

create or replace function public.respond_to_expert_case_handover(
  p_handover_id uuid,
  p_accept boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_handover public.expert_case_handovers%rowtype;
  v_capacity integer := 10;
  v_open_count integer := 0;
  v_availability public.expert_availability%rowtype;
  v_substitute_verified boolean := false;
begin
  if p_handover_id is null or p_accept is null then
    raise exception 'invalid_handover_response' using errcode = '22023';
  end if;

  -- Lock both the handover and its canonical request. The farmer identity
  -- must match BOTH records; a forged handover row can never grant consent.
  select h.*
    into v_handover
  from public.expert_case_handovers h
  join public.expert_requests er
    on er.id = h.request_id
   and er.requester_user_id = h.requester_user_id
   and er.assigned_expert_profile_id = h.from_expert_profile_id
  where h.id = p_handover_id
    and er.requester_user_id = (select public.current_sarina_user_id())
    and h.status = 'awaiting_farmer_consent'
  for update of h, er;

  if not found then
    raise exception 'Handover request is unavailable for this farmer'
      using errcode = '42501';
  end if;

  if p_accept then
    select (ep.verification_status = 'verified')
      into v_substitute_verified
    from public.expert_profiles ep
    where ep.id = v_handover.to_expert_profile_id
    for update;

    if not coalesce(v_substitute_verified, false) then
      raise exception 'The proposed substitute is no longer a verified specialist';
    end if;

    select *
      into v_availability
    from public.expert_availability
    where expert_profile_id = v_handover.to_expert_profile_id
    for update;

    if found then
      if v_availability.pause_new_cases
         or (
           v_availability.availability_status = 'away'
           and (v_availability.vacation_end is null or now() <= v_availability.vacation_end)
         )
         or (
           v_availability.vacation_start is not null
           and now() >= v_availability.vacation_start
           and (v_availability.vacation_end is null or now() <= v_availability.vacation_end)
         ) then
        raise exception 'The proposed substitute is currently unavailable';
      end if;
      v_capacity := v_availability.max_open_cases;
    end if;

    select count(*)
      into v_open_count
    from public.expert_requests er
    where er.assigned_expert_profile_id = v_handover.to_expert_profile_id
      and er.status in ('submitted','assigned','in_progress','waiting_user');

    if v_open_count >= v_capacity then
      raise exception 'The proposed substitute has reached the open-case capacity';
    end if;

    update public.expert_case_handovers
       set status = 'awaiting_substitute_acceptance',
           farmer_responded_at = now()
     where id = p_handover_id;

    insert into public.expert_request_assignments
      (request_id, expert_profile_id, assignment_status, offered_at)
    values
      (v_handover.request_id, v_handover.to_expert_profile_id, 'offered', now())
    on conflict (request_id, expert_profile_id) do update
      set assignment_status = 'offered',
          offered_at = now(),
          responded_at = null;

    insert into public.expert_case_notifications
      (recipient_user_id, actor_user_id, request_id, event_type, preview)
    select
      ep.user_id,
      (select public.current_sarina_user_id()),
      v_handover.request_id,
      'case_handover_offered',
      'یک پرونده با رضایت کشاورز برای پذیرش جایگزینی به شما ارجاع شده است.'
    from public.expert_profiles ep
    where ep.id = v_handover.to_expert_profile_id;
  else
    update public.expert_case_handovers
       set status = 'declined',
           farmer_responded_at = now()
     where id = p_handover_id;

    insert into public.expert_case_notifications
      (recipient_user_id, actor_user_id, request_id, event_type, preview)
    values
      (
        v_handover.requester_user_id,
        (select public.current_sarina_user_id()),
        v_handover.request_id,
        'case_handover_declined',
        'درخواست جایگزینی متخصص تأیید نشد؛ پرونده نزد متخصص فعلی باقی می‌ماند.'
      );
  end if;

  return jsonb_build_object(
    'success', true,
    'status',
    case when p_accept then 'awaiting_substitute_acceptance' else 'declined' end
  );
end;
$function$;

revoke all on function public.respond_to_expert_case_handover(uuid, boolean)
  from public, anon;
grant execute on function public.respond_to_expert_case_handover(uuid, boolean)
  to authenticated;

commit;
