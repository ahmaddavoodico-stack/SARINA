create table if not exists public.expert_consultation_ai_messages (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.expert_consultations(id) on delete cascade,
  message_text text not null check (length(btrim(message_text)) between 1 and 12000),
  status text not null default 'complete' check (status in ('complete','unavailable','failed')),
  created_at timestamptz not null default now()
);
create index if not exists expert_consultation_ai_messages_timeline_idx
  on public.expert_consultation_ai_messages (consultation_id, created_at);
alter table public.expert_consultation_ai_messages enable row level security;
drop policy if exists expert_consultation_ai_messages_participant_read on public.expert_consultation_ai_messages;
create policy expert_consultation_ai_messages_participant_read
on public.expert_consultation_ai_messages for select to authenticated
using (
  exists (
    select 1
    from public.expert_consultations c
    join public.expert_requests r on r.id = c.request_id
    where c.id = expert_consultation_ai_messages.consultation_id
      and (
        r.requester_user_id = public.current_sarina_user_id()
        or exists (
          select 1
          from public.expert_request_assignments a
          join public.expert_profiles p on p.id = a.expert_profile_id
          where a.request_id = r.id
            and a.assignment_status in ('offered','accepted')
            and p.user_id = public.current_sarina_user_id()
            and p.verification_status = 'verified'
        )
      )
  )
);
revoke all on public.expert_consultation_ai_messages from anon, authenticated;
grant select on public.expert_consultation_ai_messages to authenticated;
grant select, insert on public.expert_consultation_ai_messages to service_role;
do $$
begin
  alter publication supabase_realtime add table public.expert_consultation_ai_messages;
exception when duplicate_object then null;
end $$;