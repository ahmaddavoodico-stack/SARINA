-- Allow participants to remove only their own consultation voice uploads.
drop policy if exists sarina_expert_voice_delete_own on storage.objects;
create policy sarina_expert_voice_delete_own
on storage.objects
for delete to authenticated
using (
  bucket_id = 'expert-voice-notes'
  and (storage.foldername(name))[2] = current_sarina_user_id()::text
  and exists (
    select 1
    from public.expert_consultations c
    join public.expert_requests er on er.id = c.request_id
    join public.expert_request_assignments a on a.request_id = er.id
    left join public.expert_profiles ep on ep.id = a.expert_profile_id
    where c.id::text = (storage.foldername(name))[1]
      and a.assignment_status in ('offered','accepted')
      and (
        er.requester_user_id = current_sarina_user_id()
        or (ep.user_id = current_sarina_user_id() and ep.verification_status = 'verified')
      )
  )
);
