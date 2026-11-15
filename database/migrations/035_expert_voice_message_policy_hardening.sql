-- Make the audio message descriptor checks safe for arbitrary JSONB values.
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
      and case
        when jsonb_typeof(content_parts) = 'array'
          then jsonb_array_length(content_parts) = 1
        else false
      end
      and content_parts->0->>'type' = 'audio'
      and content_parts->0->>'storage_path' like consultation_id::text || '/' || sender_user_id::text || '/%'
      and content_parts->0->>'mime_type' = any (array[
        'audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav',
        'audio/x-wav','audio/aac','audio/3gpp','audio/3gpp2','audio/flac'
      ])
      and case
        when (content_parts->0->>'size_bytes') ~ '^[0-9]+$'
          then (content_parts->0->>'size_bytes')::bigint between 1 and 20971520
        else false
      end
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
