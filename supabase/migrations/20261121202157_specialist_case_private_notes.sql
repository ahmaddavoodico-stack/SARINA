-- Specialist case workspace: immutable, private expert notes.
-- This is the only new case table justified by the audit: no existing table stores
-- internal expert notes independently from farmer-facing reports or assistant state.

begin;

create table if not exists public.expert_case_notes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.expert_requests(id) on delete cascade,
  author_user_id uuid not null references public.users(id) on delete restrict,
  note_type text not null default 'observation'
    check (note_type in ('observation','assessment','follow_up','decision')),
  body text not null
    check (length(trim(body)) between 1 and 8000),
  source_refs jsonb not null default '[]'::jsonb
    check (jsonb_typeof(source_refs) = 'array'),
  created_at timestamptz not null default now()
);

create index if not exists expert_case_notes_request_created_idx
  on public.expert_case_notes (request_id, created_at desc);

alter table public.expert_case_notes enable row level security;

create policy expert_case_notes_assigned_expert_read
on public.expert_case_notes
for select to authenticated
using (
  exists (
    select 1
    from public.expert_request_assignments a
    join public.expert_profiles ep on ep.id = a.expert_profile_id
    where a.request_id = expert_case_notes.request_id
      and a.assignment_status = 'accepted'
      and ep.user_id = public.current_sarina_user_id()
      and ep.verification_status = 'verified'
  )
);

create policy expert_case_notes_assigned_expert_insert
on public.expert_case_notes
for insert to authenticated
with check (
  author_user_id = public.current_sarina_user_id()
  and exists (
    select 1
    from public.expert_request_assignments a
    join public.expert_profiles ep on ep.id = a.expert_profile_id
    where a.request_id = expert_case_notes.request_id
      and a.assignment_status = 'accepted'
      and ep.user_id = public.current_sarina_user_id()
      and ep.verification_status = 'verified'
  )
);

revoke all on public.expert_case_notes from anon, public;
grant select, insert on public.expert_case_notes to authenticated;

commit;
