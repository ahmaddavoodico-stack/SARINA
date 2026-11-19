-- Enforce expert availability and open-case capacity at request creation.
drop policy if exists expert_requests_farmer_insert on public.expert_requests;
create policy expert_requests_farmer_insert on public.expert_requests
for insert to authenticated
with check (
  requester_user_id=public.current_sarina_user_id()
  and farm_id is not null and consent_at is not null and consent_scope <> '{}'::jsonb
  and requested_mode='in_app_message' and status in ('draft','submitted')
  and exists (select 1 from public.farms f where f.id=expert_requests.farm_id and f.owner_user_id=public.current_sarina_user_id())
  and exists (
    select 1 from public.expert_profiles ep
    where ep.id=expert_requests.assigned_expert_profile_id
      and ep.verification_status='verified'
      and ep.profile_visibility in ('directory','public')
      and not exists (
        select 1 from public.expert_availability av
        where av.expert_profile_id=ep.id
          and (av.pause_new_cases or av.availability_status='away'
            or (av.vacation_start is not null and now() between av.vacation_start and coalesce(av.vacation_end,'infinity'::timestamptz)))
      )
      and (select count(*) from public.expert_requests active
        where active.assigned_expert_profile_id=ep.id
          and active.status in ('submitted','assigned','in_progress','waiting_user'))
        < coalesce((select av.max_open_cases from public.expert_availability av where av.expert_profile_id=ep.id),10)
  )
);

drop policy if exists expert_assignments_farmer_insert on public.expert_request_assignments;
create policy expert_assignments_farmer_insert on public.expert_request_assignments
for insert to authenticated
with check (
  assignment_status='offered'
  and exists (
    select 1 from public.expert_requests er
    join public.expert_profiles ep on ep.id=er.assigned_expert_profile_id
    where er.id=expert_request_assignments.request_id
      and er.requester_user_id=public.current_sarina_user_id()
      and ep.id=expert_request_assignments.expert_profile_id
      and ep.verification_status='verified'
      and not exists (
        select 1 from public.expert_availability av
        where av.expert_profile_id=ep.id
          and (av.pause_new_cases or av.availability_status='away'
            or (av.vacation_start is not null and now() between av.vacation_start and coalesce(av.vacation_end,'infinity'::timestamptz)))
      )
  )
);
