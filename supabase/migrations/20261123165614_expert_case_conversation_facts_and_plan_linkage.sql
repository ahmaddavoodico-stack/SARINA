create table if not exists public.expert_case_conversation_facts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.expert_requests(id) on delete cascade,
  consultation_id uuid not null references public.expert_consultations(id) on delete cascade,
  source_message_id uuid not null references public.expert_consultation_messages(id) on delete cascade,
  fact_text text not null check (length(btrim(fact_text)) between 1 and 6000),
  fact_kind text not null default 'farmer_report' check (fact_kind in ('farmer_report','specialist_finding','decision','follow_up')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_by uuid not null references public.users(id),
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source_message_id, fact_kind)
);
create index if not exists expert_case_conversation_facts_request_idx
  on public.expert_case_conversation_facts(request_id, status, created_at desc);
alter table public.expert_case_conversation_facts enable row level security;
drop policy if exists expert_case_conversation_facts_read on public.expert_case_conversation_facts;
create policy expert_case_conversation_facts_read on public.expert_case_conversation_facts
for select to authenticated using (
  (status = 'approved' and exists (
    select 1 from public.expert_requests r
    where r.id = request_id and r.requester_user_id = public.current_sarina_user_id()
  ))
  or exists (
    select 1 from public.expert_request_assignments a
    join public.expert_profiles p on p.id = a.expert_profile_id
    where a.request_id = expert_case_conversation_facts.request_id
      and a.assignment_status = 'accepted'
      and p.user_id = public.current_sarina_user_id()
      and p.verification_status = 'verified'
  )
);
drop policy if exists expert_case_conversation_facts_expert_insert on public.expert_case_conversation_facts;
create policy expert_case_conversation_facts_expert_insert on public.expert_case_conversation_facts
for insert to authenticated with check (
  status = 'approved'
  and reviewed_by = public.current_sarina_user_id()
  and reviewed_at is not null
  and created_by = public.current_sarina_user_id()
  and exists (
    select 1 from public.expert_request_assignments a
    join public.expert_profiles p on p.id = a.expert_profile_id
    where a.request_id = expert_case_conversation_facts.request_id
      and a.assignment_status = 'accepted'
      and p.user_id = public.current_sarina_user_id()
      and p.verification_status = 'verified'
  )
  and exists (
    select 1 from public.expert_consultations c
    where c.id = expert_case_conversation_facts.consultation_id
      and c.request_id = expert_case_conversation_facts.request_id
  )
  and exists (
    select 1 from public.expert_consultation_messages m
    where m.id = expert_case_conversation_facts.source_message_id
      and m.consultation_id = expert_case_conversation_facts.consultation_id
  )
);
grant select, insert on public.expert_case_conversation_facts to authenticated;
alter table public.farm_improvement_plans
  add column if not exists source_request_id uuid references public.expert_requests(id) on delete set null,
  add column if not exists source_consultation_id uuid references public.expert_consultations(id) on delete set null;
create index if not exists farm_improvement_plans_source_request_idx
  on public.farm_improvement_plans(source_request_id) where source_request_id is not null;