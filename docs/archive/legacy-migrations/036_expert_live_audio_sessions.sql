-- WebRTC call sessions for accepted farmer/expert consultations.
create table if not exists public.expert_audio_sessions (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.expert_consultations(id) on delete cascade,
  initiated_by uuid not null references public.users(id) on delete restrict,
  status text not null default 'ringing' check (status in ('ringing','accepted','rejected','ended','missed')),
  expires_at timestamptz not null default (now() + interval '90 seconds'),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists expert_audio_sessions_consultation_created_idx on public.expert_audio_sessions (consultation_id, created_at desc);
alter table public.expert_audio_sessions enable row level security;
revoke all on public.expert_audio_sessions from anon, public;
grant select, insert, update on public.expert_audio_sessions to authenticated;

create or replace function public.prevent_expert_audio_session_identity_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.consultation_id is distinct from old.consultation_id
     or new.initiated_by is distinct from old.initiated_by
     or new.expires_at is distinct from old.expires_at
     or new.created_at is distinct from old.created_at then
    raise exception 'Audio session identity fields are immutable';
  end if;
  return new;
end;
$$;
drop trigger if exists expert_audio_session_identity_immutable on public.expert_audio_sessions;
create trigger expert_audio_session_identity_immutable before update on public.expert_audio_sessions
for each row execute function public.prevent_expert_audio_session_identity_change();

drop policy if exists expert_audio_sessions_participant_select on public.expert_audio_sessions;
create policy expert_audio_sessions_participant_select on public.expert_audio_sessions
for select to authenticated using (
  exists (
    select 1 from public.expert_consultations c
    join public.expert_requests er on er.id = c.request_id
    join public.expert_request_assignments a on a.request_id = er.id
    join public.expert_profiles ep on ep.id = a.expert_profile_id
    where c.id = expert_audio_sessions.consultation_id and a.assignment_status = 'accepted'
      and (er.requester_user_id = current_sarina_user_id()
        or (ep.user_id = current_sarina_user_id() and ep.verification_status = 'verified'))
  )
);
drop policy if exists expert_audio_sessions_participant_insert on public.expert_audio_sessions;
create policy expert_audio_sessions_participant_insert on public.expert_audio_sessions
for insert to authenticated with check (
  initiated_by = current_sarina_user_id() and status = 'ringing' and expires_at > now()
  and exists (
    select 1 from public.expert_consultations c
    join public.expert_requests er on er.id = c.request_id
    join public.expert_request_assignments a on a.request_id = er.id
    join public.expert_profiles ep on ep.id = a.expert_profile_id
    where c.id = expert_audio_sessions.consultation_id and a.assignment_status = 'accepted'
      and (er.requester_user_id = current_sarina_user_id()
        or (ep.user_id = current_sarina_user_id() and ep.verification_status = 'verified'))
  )
);
drop policy if exists expert_audio_sessions_participant_update on public.expert_audio_sessions;
create policy expert_audio_sessions_participant_update on public.expert_audio_sessions
for update to authenticated
using (
  exists (
    select 1 from public.expert_consultations c
    join public.expert_requests er on er.id = c.request_id
    join public.expert_request_assignments a on a.request_id = er.id
    join public.expert_profiles ep on ep.id = a.expert_profile_id
    where c.id = expert_audio_sessions.consultation_id and a.assignment_status = 'accepted'
      and (er.requester_user_id = current_sarina_user_id()
        or (ep.user_id = current_sarina_user_id() and ep.verification_status = 'verified'))
  )
)
with check (
  status in ('ringing','accepted','rejected','ended','missed')
  and ((status = 'ringing' and initiated_by = current_sarina_user_id())
    or status in ('accepted','rejected','ended','missed'))
  and exists (
    select 1 from public.expert_consultations c
    join public.expert_requests er on er.id = c.request_id
    join public.expert_request_assignments a on a.request_id = er.id
    join public.expert_profiles ep on ep.id = a.expert_profile_id
    where c.id = expert_audio_sessions.consultation_id and a.assignment_status = 'accepted'
      and (er.requester_user_id = current_sarina_user_id()
        or (ep.user_id = current_sarina_user_id() and ep.verification_status = 'verified'))
  )
);

drop policy if exists sarina_consultation_call_receive on realtime.messages;
create policy sarina_consultation_call_receive on realtime.messages
for select to authenticated using (
  extension = 'broadcast'
  and realtime.topic() ~ '^consultation:[0-9a-fA-F-]{36}:call$'
  and exists (
    select 1 from public.expert_consultations c
    join public.expert_requests er on er.id = c.request_id
    join public.expert_request_assignments a on a.request_id = er.id
    join public.expert_profiles ep on ep.id = a.expert_profile_id
    where c.id::text = split_part(realtime.topic(), ':', 2) and a.assignment_status = 'accepted'
      and (er.requester_user_id = current_sarina_user_id()
        or (ep.user_id = current_sarina_user_id() and ep.verification_status = 'verified'))
  )
);
drop policy if exists sarina_consultation_call_send on realtime.messages;
create policy sarina_consultation_call_send on realtime.messages
for insert to authenticated with check (
  extension = 'broadcast'
  and realtime.topic() ~ '^consultation:[0-9a-fA-F-]{36}:call$'
  and exists (
    select 1 from public.expert_consultations c
    join public.expert_requests er on er.id = c.request_id
    join public.expert_request_assignments a on a.request_id = er.id
    join public.expert_profiles ep on ep.id = a.expert_profile_id
    where c.id::text = split_part(realtime.topic(), ':', 2) and a.assignment_status = 'accepted'
      and (er.requester_user_id = current_sarina_user_id()
        or (ep.user_id = current_sarina_user_id() and ep.verification_status = 'verified'))
  )
);
