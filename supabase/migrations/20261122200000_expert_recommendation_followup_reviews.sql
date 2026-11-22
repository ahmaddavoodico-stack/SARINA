-- Specialist-only assessment of farmer-reported execution and observed outcomes.
-- This is a separate expert review record: farmer status remains self-reported.
create table if not exists public.expert_recommendation_reviews (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null unique
    references public.expert_recommendation_actions(id) on delete cascade,
  reviewer_user_id uuid not null references public.users(id) on delete restrict,
  outcome_status text not null
    check (outcome_status in ('acknowledged','verified','needs_followup')),
  outcome_summary text not null
    check (length(trim(outcome_summary)) between 3 and 2000),
  evidence_assessment text
    check (evidence_assessment is null or length(evidence_assessment) <= 2000),
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expert_recommendation_reviews_reviewer_idx
  on public.expert_recommendation_reviews (reviewer_user_id, reviewed_at desc);

alter table public.expert_recommendation_reviews enable row level security;
revoke all on public.expert_recommendation_reviews from anon, authenticated;
grant select, insert on public.expert_recommendation_reviews to authenticated;
grant update (outcome_status, outcome_summary, evidence_assessment, reviewed_at, updated_at)
  on public.expert_recommendation_reviews to authenticated;

-- Internal review notes are visible only to the currently assigned, verified specialist.
create policy expert_recommendation_review_assigned_expert_read
on public.expert_recommendation_reviews for select to authenticated
using (
  exists (
    select 1
    from public.expert_recommendation_actions ra
    join public.expert_requests r on r.id = ra.request_id
    join public.expert_request_assignments a on a.request_id = r.id
      and a.expert_profile_id = ra.expert_profile_id
      and a.assignment_status = 'accepted'
    join public.expert_profiles ep on ep.id = a.expert_profile_id
    where ra.id = recommendation_id
      and ep.user_id = public.current_sarina_user_id()
      and ep.verification_status = 'verified'
  )
);

create policy expert_recommendation_review_assigned_expert_insert
on public.expert_recommendation_reviews for insert to authenticated
with check (
  reviewer_user_id = public.current_sarina_user_id()
  and exists (
    select 1
    from public.expert_recommendation_actions ra
    join public.expert_requests r on r.id = ra.request_id
    join public.expert_request_assignments a on a.request_id = r.id
      and a.expert_profile_id = ra.expert_profile_id
      and a.assignment_status = 'accepted'
    join public.expert_profiles ep on ep.id = a.expert_profile_id
    where ra.id = recommendation_id
      and ep.user_id = public.current_sarina_user_id()
      and ep.verification_status = 'verified'
  )
);

create policy expert_recommendation_review_assigned_expert_update
on public.expert_recommendation_reviews for update to authenticated
using (
  exists (
    select 1
    from public.expert_recommendation_actions ra
    join public.expert_requests r on r.id = ra.request_id
    join public.expert_request_assignments a on a.request_id = r.id
      and a.expert_profile_id = ra.expert_profile_id
      and a.assignment_status = 'accepted'
    join public.expert_profiles ep on ep.id = a.expert_profile_id
    where ra.id = recommendation_id
      and ep.user_id = public.current_sarina_user_id()
      and ep.verification_status = 'verified'
  )
)
with check (
  reviewer_user_id = public.current_sarina_user_id()
  and exists (
    select 1
    from public.expert_recommendation_actions ra
    join public.expert_requests r on r.id = ra.request_id
    join public.expert_request_assignments a on a.request_id = r.id
      and a.expert_profile_id = ra.expert_profile_id
      and a.assignment_status = 'accepted'
    join public.expert_profiles ep on ep.id = a.expert_profile_id
    where ra.id = recommendation_id
      and ep.user_id = public.current_sarina_user_id()
      and ep.verification_status = 'verified'
  )
);
