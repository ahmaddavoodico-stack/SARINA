-- Break the pre-existing expert-voice Storage RLS cycle.
-- storage.objects policies previously queried expert_request_assignments, whose
-- own participant policy queried expert_requests, whose policy queried assignments.
-- A narrow boolean helper evaluates the participant relationship under a fixed,
-- privileged context without returning consultation data.

begin;

create or replace function sarina_internal.can_access_expert_voice_consultation(p_consultation_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.expert_consultations c
      join public.expert_requests er on er.id=c.request_id
      join public.expert_request_assignments a on a.request_id=er.id
      left join public.expert_profiles ep on ep.id=a.expert_profile_id
     where c.id::text=p_consultation_id
       and a.assignment_status in ('offered','accepted')
       and (
         er.requester_user_id=public.current_sarina_user_id()
         or (
           ep.user_id=public.current_sarina_user_id()
           and ep.verification_status='verified'
         )
       )
  );
$$;

revoke all on function sarina_internal.can_access_expert_voice_consultation(text) from public, anon;
grant execute on function sarina_internal.can_access_expert_voice_consultation(text) to authenticated;

drop policy if exists sarina_expert_voice_read on storage.objects;
create policy sarina_expert_voice_read
on storage.objects
for select to authenticated
using (
  bucket_id='expert-voice-notes'
  and (storage.foldername(name))[2]=(select public.current_sarina_user_id())::text
  and sarina_internal.can_access_expert_voice_consultation((storage.foldername(name))[1])
);

drop policy if exists sarina_expert_voice_upload on storage.objects;
create policy sarina_expert_voice_upload
on storage.objects
for insert to authenticated
with check (
  bucket_id='expert-voice-notes'
  and (storage.foldername(name))[2]=(select public.current_sarina_user_id())::text
  and sarina_internal.can_access_expert_voice_consultation((storage.foldername(name))[1])
);

drop policy if exists sarina_expert_voice_delete_own on storage.objects;
create policy sarina_expert_voice_delete_own
on storage.objects
for delete to authenticated
using (
  bucket_id='expert-voice-notes'
  and (storage.foldername(name))[2]=(select public.current_sarina_user_id())::text
  and sarina_internal.can_access_expert_voice_consultation((storage.foldername(name))[1])
);

comment on function sarina_internal.can_access_expert_voice_consultation(text) is
  'Boolean-only participant check for expert voice object policies; avoids recursive RLS joins across expert requests and assignments.';

commit;
