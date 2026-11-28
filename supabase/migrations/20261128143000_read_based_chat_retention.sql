-- Read-based 24-hour retention for SARINA and farmer-specialist messages.
-- Unread messages never expire. The timer starts exactly once, on the recipient's first view.
alter table public.ai_messages
  add column if not exists first_human_viewed_at timestamptz,
  add column if not exists retention_expires_at timestamptz;

create index if not exists ai_messages_retention_expiry_idx
  on public.ai_messages(retention_expires_at)
  where retention_expires_at is not null;

alter table public.expert_consultation_messages
  add column if not exists first_human_viewed_at timestamptz,
  add column if not exists retention_expires_at timestamptz,
  add column if not exists deleted_at timestamptz;

create index if not exists expert_consultation_messages_retention_expiry_idx
  on public.expert_consultation_messages(retention_expires_at)
  where retention_expires_at is not null;

create or replace function public.mark_expert_consultation_messages_viewed(p_message_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  v_user_id := public.current_sarina_user_id();
  if v_user_id is null then
    raise exception 'SARINA_USER_REQUIRED' using errcode = '42501';
  end if;
  update public.expert_consultation_messages m
  set first_human_viewed_at = now(),
      retention_expires_at = now() + interval '24 hours'
  from public.expert_consultations c
  join public.expert_requests r on r.id = c.request_id
  where m.id = any(coalesce(p_message_ids, array[]::uuid[]))
    and m.consultation_id = c.id
    and m.sender_user_id <> v_user_id
    and m.first_human_viewed_at is null
    and m.deleted_at is null
    and (
      r.requester_user_id = v_user_id
      or exists (
        select 1 from public.expert_request_assignments a
        join public.expert_profiles ep on ep.id = a.expert_profile_id
        where a.request_id = r.id
          and a.assignment_status in ('offered','accepted')
          and ep.user_id = v_user_id
          and ep.verification_status = 'verified'
      )
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.delete_expert_consultation_message(p_message_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_message public.expert_consultation_messages%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  v_user_id := public.current_sarina_user_id();
  if v_user_id is null then
    raise exception 'SARINA_USER_REQUIRED' using errcode = '42501';
  end if;
  select m.* into v_message
  from public.expert_consultation_messages m
  join public.expert_consultations c on c.id = m.consultation_id
  join public.expert_requests r on r.id = c.request_id
  where m.id = p_message_id
    and m.sender_user_id = v_user_id
    and (
      r.requester_user_id = v_user_id
      or exists (
        select 1 from public.expert_request_assignments a
        join public.expert_profiles ep on ep.id = a.expert_profile_id
        where a.request_id = r.id
          and a.assignment_status in ('offered','accepted')
          and ep.user_id = v_user_id
          and ep.verification_status = 'verified'
      )
    )
  for update;
  if not found then
    return jsonb_build_object('deleted', false, 'reason', 'not_found_or_not_sender');
  end if;
  if v_message.first_human_viewed_at is not null then
    return jsonb_build_object('deleted', false, 'reason', 'already_viewed');
  end if;
  update public.expert_consultation_messages
  set message_text = null, content_parts = '[]'::jsonb, deleted_at = now()
  where id = p_message_id;
  return jsonb_build_object('deleted', true, 'content_parts', v_message.content_parts);
end;
$$;

revoke all on function public.mark_expert_consultation_messages_viewed(uuid[]) from public, anon;
grant execute on function public.mark_expert_consultation_messages_viewed(uuid[]) to authenticated;
revoke all on function public.delete_expert_consultation_message(uuid) from public, anon;
grant execute on function public.delete_expert_consultation_message(uuid) to authenticated;
