-- Human-view-gated deletion for farmer-specialist messages.
-- Apply only after review in an isolated Supabase development database.
begin;

alter table public.expert_consultation_messages
  add column if not exists first_human_viewed_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_user_id uuid references public.users(id);

alter table public.expert_case_notifications
  add column if not exists message_id uuid references public.expert_consultation_messages(id) on delete set null;

create index if not exists expert_case_notifications_message_id_idx
  on public.expert_case_notifications(message_id)
  where message_id is not null;

create or replace function private.notify_expert_case_message()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $function$
declare
  v_requester uuid;
  v_expert uuid;
  v_request uuid;
  v_recipient uuid;
begin
  select er.id, er.requester_user_id, ep.user_id
    into v_request, v_requester, v_expert
  from public.expert_consultations c
  join public.expert_requests er on er.id = c.request_id
  join public.expert_request_assignments a on a.request_id = er.id
    and a.assignment_status in ('offered','accepted')
  join public.expert_profiles ep on ep.id = a.expert_profile_id
  where c.id = new.consultation_id
  order by a.offered_at desc
  limit 1;

  if v_request is null then return new; end if;
  if new.sender_user_id = v_requester then
    v_recipient := v_expert;
  else
    v_recipient := v_requester;
  end if;

  if v_recipient is not null and v_recipient <> new.sender_user_id then
    insert into public.expert_case_notifications
      (recipient_user_id, actor_user_id, request_id, consultation_id, message_id, event_type, preview)
    values
      (v_recipient, new.sender_user_id, v_request, new.consultation_id, new.id,
       'new_message', left(coalesce(new.message_text, 'پیام پیوست‌دار'), 180));
  end if;
  return new;
end;
$function$;

create or replace function public.mark_expert_consultation_messages_viewed(p_message_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid;
  v_count integer := 0;
begin
  v_user_id := public.current_sarina_user_id();
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if coalesce(array_length(p_message_ids, 1), 0) = 0 then
    return 0;
  end if;
  if array_length(p_message_ids, 1) > 200 then
    raise exception 'too_many_message_ids' using errcode = '22023';
  end if;

  update public.expert_consultation_messages m
     set first_human_viewed_at = clock_timestamp()
    from public.expert_consultations c
    join public.expert_requests er on er.id = c.request_id
   where m.id = any(p_message_ids)
     and m.consultation_id = c.id
     and m.sender_user_id <> v_user_id
     and m.first_human_viewed_at is null
     and m.deleted_at is null
     and (
       er.requester_user_id = v_user_id
       or exists (
         select 1
           from public.expert_request_assignments a
           join public.expert_profiles ep on ep.id = a.expert_profile_id
          where a.request_id = er.id
            and a.assignment_status in ('offered','accepted')
            and ep.user_id = v_user_id
            and ep.verification_status = 'verified'
       )
     );

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

create or replace function public.delete_expert_consultation_message(p_message_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid;
  v_message public.expert_consultation_messages%rowtype;
  v_parts jsonb;
begin
  v_user_id := public.current_sarina_user_id();
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select * into v_message
    from public.expert_consultation_messages
   where id = p_message_id
   for update;

  if not found then
    return jsonb_build_object('deleted', false, 'reason', 'not_found');
  end if;
  if v_message.sender_user_id <> v_user_id then
    raise exception 'message_owner_required' using errcode = '42501';
  end if;
  if v_message.deleted_at is not null then
    return jsonb_build_object('deleted', false, 'reason', 'already_deleted');
  end if;
  if v_message.first_human_viewed_at is not null then
    return jsonb_build_object('deleted', false, 'reason', 'already_viewed');
  end if;

  v_parts := v_message.content_parts;

  update public.expert_consultation_messages
     set message_text = null,
         content_parts = '[]'::jsonb,
         deleted_at = clock_timestamp(),
         deleted_by_user_id = v_user_id
   where id = p_message_id;

  update public.expert_case_notifications
     set preview = 'پیام حذف شد'
   where message_id = p_message_id;

  return jsonb_build_object(
    'deleted', true,
    'content_parts', coalesce(v_parts, '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.mark_expert_consultation_messages_viewed(uuid[]) from public, anon, authenticated;
revoke all on function public.delete_expert_consultation_message(uuid) from public, anon, authenticated;
grant execute on function public.mark_expert_consultation_messages_viewed(uuid[]) to authenticated;
grant execute on function public.delete_expert_consultation_message(uuid) to authenticated;

commit;
