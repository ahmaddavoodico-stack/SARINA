-- Private voice-note storage for expert consultations.
-- Access is limited to the farmer and the currently assigned verified expert.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expert-voice-notes',
  'expert-voice-notes',
  false,
  20971520,
  array['audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav','audio/x-wav','audio/aac','audio/3gpp','audio/3gpp2','audio/flac']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists expert_messages_participant_insert on public.expert_consultation_messages;
create policy expert_messages_participant_insert
on public.expert_consultation_messages
for insert to authenticated
with check (
  sender_user_id = current_sarina_user_id()
  and (
    (
      message_text is not null
      and length(trim(message_text)) between 1 and 6000
      and content_parts = '[]'::jsonb
    )
    or
    (
      message_text is null
      and jsonb_typeof(content_parts) = 'array'
      and jsonb_array_length(content_parts) = 1
      and content_parts->0->>'type' = 'audio'
      and content_parts->0->>'storage_path' like consultation_id::text || '/' || sender_user_id::text || '/%'
      and content_parts->0->>'mime_type' = any (array[
        'audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav',
        'audio/x-wav','audio/aac','audio/3gpp','audio/3gpp2','audio/flac'
      ])
      and (content_parts->0->>'size_bytes') ~ '^[0-9]+$'
      and (content_parts->0->>'size_bytes')::bigint between 1 and 20971520
    )
  )
  and exists (
    select 1
    from public.expert_consultations c
    join public.expert_requests er on er.id = c.request_id
    join public.expert_request_assignments a on a.request_id = er.id
    left join public.expert_profiles ep on ep.id = a.expert_profile_id
    where c.id = expert_consultation_messages.consultation_id
      and a.assignment_status in ('offered','accepted')
      and (
        er.requester_user_id = current_sarina_user_id()
        or (ep.user_id = current_sarina_user_id() and ep.verification_status = 'verified')
      )
  )
);

drop policy if exists sarina_expert_voice_upload on storage.objects;
create policy sarina_expert_voice_upload
on storage.objects
for insert to authenticated
with check (
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

drop policy if exists sarina_expert_voice_read on storage.objects;
create policy sarina_expert_voice_read
on storage.objects
for select to authenticated
using (
  bucket_id = 'expert-voice-notes'
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
