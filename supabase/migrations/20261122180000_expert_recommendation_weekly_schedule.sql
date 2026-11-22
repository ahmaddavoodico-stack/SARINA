-- Structured, explicitly approved specialist recommendations scheduled in the farmer's weekly plan.
create table if not exists public.expert_recommendation_actions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.expert_requests(id) on delete cascade,
  consultation_id uuid not null references public.expert_consultations(id) on delete cascade,
  farm_id uuid not null references public.farms(id) on delete cascade,
  expert_profile_id uuid not null references public.expert_profiles(id) on delete restrict,
  author_user_id uuid not null references public.users(id) on delete restrict,
  title text not null check (length(trim(title)) between 3 and 180),
  instructions text not null check (length(trim(instructions)) between 3 and 4000),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  starts_on date not null default current_date,
  due_on date,
  status text not null default 'approved' check (status in ('approved','in_progress','completed','needs_review')),
  approved_at timestamptz not null default now(),
  completed_at timestamptz,
  farmer_note text check (farmer_note is null or length(farmer_note) <= 2000),
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array' and octet_length(evidence::text) <= 12000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expert_recommendation_due_after_start check (due_on is null or due_on >= starts_on)
);

create index if not exists expert_recommendation_actions_farm_schedule_idx
  on public.expert_recommendation_actions (farm_id, due_on, starts_on);
create index if not exists expert_recommendation_actions_request_idx
  on public.expert_recommendation_actions (request_id, created_at desc);

alter table public.expert_recommendation_actions enable row level security;
revoke all on public.expert_recommendation_actions from anon, authenticated;
grant select, insert on public.expert_recommendation_actions to authenticated;
grant update (status, farmer_note, evidence, completed_at, updated_at)
  on public.expert_recommendation_actions to authenticated;

create policy expert_recommendation_participant_read
on public.expert_recommendation_actions for select to authenticated
using (
  exists (
    select 1 from public.expert_requests r
    where r.id = request_id
      and (
        r.requester_user_id = public.current_sarina_user_id()
        or exists (
          select 1
          from public.expert_request_assignments a
          join public.expert_profiles ep on ep.id = a.expert_profile_id
          where a.request_id = r.id
            and a.expert_profile_id = expert_recommendation_actions.expert_profile_id
            and a.assignment_status = 'accepted'
            and ep.user_id = public.current_sarina_user_id()
            and ep.verification_status = 'verified'
        )
      )
  )
);

create policy expert_recommendation_verified_assignee_insert
on public.expert_recommendation_actions for insert to authenticated
with check (
  author_user_id = public.current_sarina_user_id()
  and status = 'approved'
  and approved_at is not null
  and exists (
    select 1
    from public.expert_requests r
    join public.expert_consultations c on c.request_id = r.id
    join public.expert_request_assignments a on a.request_id = r.id
    join public.expert_profiles ep on ep.id = a.expert_profile_id
    where r.id = request_id
      and c.id = consultation_id
      and r.farm_id = farm_id
      and a.expert_profile_id = expert_recommendation_actions.expert_profile_id
      and a.assignment_status = 'accepted'
      and ep.user_id = public.current_sarina_user_id()
      and ep.verification_status = 'verified'
  )
);

create policy expert_recommendation_farmer_update
on public.expert_recommendation_actions for update to authenticated
using (
  status in ('approved','in_progress')
  and exists (
    select 1 from public.expert_requests r
    where r.id = request_id and r.requester_user_id = public.current_sarina_user_id()
  )
)
with check (
  status in ('in_progress','completed','needs_review')
  and exists (
    select 1 from public.expert_requests r
    where r.id = request_id and r.requester_user_id = public.current_sarina_user_id()
  )
);

create or replace function public.touch_expert_recommendation_action()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.status = 'completed' and old.status <> 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.status <> 'completed' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger touch_expert_recommendation_action_before_update
before update on public.expert_recommendation_actions
for each row execute function public.touch_expert_recommendation_action();

create or replace function public.notify_expert_recommendation_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expert_user uuid;
begin
  if new.status = 'completed' and old.status <> 'completed' then
    select ep.user_id into expert_user
    from public.expert_profiles ep
    where ep.id = new.expert_profile_id;

    if expert_user is not null then
      insert into public.expert_case_notifications
        (recipient_user_id, actor_user_id, request_id, consultation_id, event_type, preview)
      values
        (expert_user, public.current_sarina_user_id(), new.request_id, new.consultation_id,
         'recommendation_completed', left('کشاورز اقدام توصیه‌شده را تکمیل کرد: ' || new.title, 240));
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.notify_expert_recommendation_completion() from public, anon, authenticated;
create trigger notify_expert_recommendation_completion_after_update
after update of status on public.expert_recommendation_actions
for each row execute function public.notify_expert_recommendation_completion();
