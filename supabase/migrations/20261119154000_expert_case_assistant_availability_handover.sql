-- Expert case intake assistant, availability and consent-based handover
create table if not exists public.expert_availability (
  id uuid primary key default gen_random_uuid(),
  expert_profile_id uuid not null unique references public.expert_profiles(id) on delete cascade,
  availability_status text not null default 'available' check (availability_status in ('available','busy','away')),
  pause_new_cases boolean not null default false,
  vacation_start timestamptz,
  vacation_end timestamptz,
  substitute_expert_profile_id uuid references public.expert_profiles(id) on delete set null,
  max_open_cases integer not null default 10 check (max_open_cases between 1 and 100),
  working_hours jsonb not null default '{}'::jsonb,
  status_note text,
  updated_at timestamptz not null default now(),
  constraint expert_availability_vacation_range check (vacation_end is null or vacation_start is null or vacation_end > vacation_start),
  constraint expert_availability_no_self_substitute check (substitute_expert_profile_id is null or substitute_expert_profile_id <> expert_profile_id)
);
create index if not exists expert_availability_status_idx on public.expert_availability (availability_status, pause_new_cases);

create table if not exists public.expert_case_assistant_cases (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.expert_requests(id) on delete cascade,
  assistant_status text not null default 'received'
    check (assistant_status in ('received','initial_review','needs_information','awaiting_expert','expert_reviewed')),
  completeness_status text not null default 'not_checked'
    check (completeness_status in ('not_checked','appears_complete','missing_information')),
  missing_information text[] not null default '{}'::text[],
  assistant_summary text,
  received_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by_user_id uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists expert_case_assistant_status_idx on public.expert_case_assistant_cases (assistant_status, received_at desc);

create table if not exists public.expert_case_handovers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.expert_requests(id) on delete cascade,
  requester_user_id uuid not null references public.users(id) on delete restrict,
  from_expert_profile_id uuid not null references public.expert_profiles(id) on delete restrict,
  to_expert_profile_id uuid not null references public.expert_profiles(id) on delete restrict,
  status text not null default 'awaiting_farmer_consent'
    check (status in ('awaiting_farmer_consent','awaiting_substitute_acceptance','completed','declined','cancelled')),
  reason text,
  initiated_at timestamptz not null default now(),
  farmer_responded_at timestamptz,
  completed_at timestamptz,
  constraint expert_case_handovers_different_experts check (from_expert_profile_id <> to_expert_profile_id)
);
create index if not exists expert_case_handovers_request_idx on public.expert_case_handovers (request_id, initiated_at desc);
create unique index if not exists expert_case_handovers_one_pending_idx
  on public.expert_case_handovers (request_id)
  where status in ('awaiting_farmer_consent','awaiting_substitute_acceptance');

alter table public.expert_availability enable row level security;
alter table public.expert_case_assistant_cases enable row level security;
alter table public.expert_case_handovers enable row level security;

drop policy if exists expert_availability_owner_read on public.expert_availability;
create policy expert_availability_owner_read on public.expert_availability
for select to authenticated
using (exists (select 1 from public.expert_profiles ep where ep.id=expert_profile_id and ep.user_id=public.current_sarina_user_id()));

drop policy if exists expert_availability_directory_read on public.expert_availability;
create policy expert_availability_directory_read on public.expert_availability
for select to authenticated
using (exists (select 1 from public.expert_profiles ep where ep.id=expert_profile_id and ep.verification_status='verified' and ep.profile_visibility in ('directory','public')));

drop policy if exists expert_availability_owner_insert on public.expert_availability;
create policy expert_availability_owner_insert on public.expert_availability
for insert to authenticated
with check (exists (select 1 from public.expert_profiles ep where ep.id=expert_profile_id and ep.user_id=public.current_sarina_user_id()));

drop policy if exists expert_availability_owner_update on public.expert_availability;
create policy expert_availability_owner_update on public.expert_availability
for update to authenticated
using (exists (select 1 from public.expert_profiles ep where ep.id=expert_profile_id and ep.user_id=public.current_sarina_user_id()))
with check (exists (select 1 from public.expert_profiles ep where ep.id=expert_profile_id and ep.user_id=public.current_sarina_user_id()));

drop policy if exists expert_case_assistant_participant_read on public.expert_case_assistant_cases;
create policy expert_case_assistant_participant_read on public.expert_case_assistant_cases
for select to authenticated
using (
  exists (
    select 1 from public.expert_requests er
    where er.id=request_id and (
      er.requester_user_id=public.current_sarina_user_id()
      or exists (
        select 1 from public.expert_request_assignments a
        join public.expert_profiles ep on ep.id=a.expert_profile_id
        where a.request_id=er.id and a.assignment_status in ('offered','accepted')
          and ep.user_id=public.current_sarina_user_id() and ep.verification_status='verified'
      )
    )
  )
);

drop policy if exists expert_case_assistant_assigned_expert_update on public.expert_case_assistant_cases;
create policy expert_case_assistant_assigned_expert_update on public.expert_case_assistant_cases
for update to authenticated
using (
  exists (select 1 from public.expert_requests er
    join public.expert_profiles ep on ep.id=er.assigned_expert_profile_id
    where er.id=request_id and ep.user_id=public.current_sarina_user_id() and ep.verification_status='verified')
)
with check (
  exists (select 1 from public.expert_requests er
    join public.expert_profiles ep on ep.id=er.assigned_expert_profile_id
    where er.id=request_id and ep.user_id=public.current_sarina_user_id() and ep.verification_status='verified')
);

drop policy if exists expert_case_handovers_participant_read on public.expert_case_handovers;
create policy expert_case_handovers_participant_read on public.expert_case_handovers
for select to authenticated
using (
  requester_user_id=public.current_sarina_user_id()
  or exists (select 1 from public.expert_profiles ep
    where ep.id in (from_expert_profile_id,to_expert_profile_id) and ep.user_id=public.current_sarina_user_id())
);

drop policy if exists expert_case_handovers_assigned_expert_insert on public.expert_case_handovers;
create policy expert_case_handovers_assigned_expert_insert on public.expert_case_handovers
for insert to authenticated
with check (
  status='awaiting_farmer_consent'
  and exists (select 1 from public.expert_requests er
    join public.expert_profiles from_ep on from_ep.id=from_expert_profile_id
    join public.expert_profiles to_ep on to_ep.id=to_expert_profile_id
    where er.id=request_id and er.requester_user_id=requester_user_id
      and er.assigned_expert_profile_id=from_expert_profile_id
      and from_ep.user_id=public.current_sarina_user_id()
      and from_ep.verification_status='verified'
      and to_ep.verification_status='verified'
      and to_ep.id<>from_ep.id
      and not exists (select 1 from public.expert_availability av
        where av.expert_profile_id=to_ep.id
          and (av.pause_new_cases or av.availability_status='away'
            or (av.vacation_start is not null and now() between av.vacation_start and coalesce(av.vacation_end,'infinity'::timestamptz))))
  )
);

grant select, insert, update on public.expert_availability to authenticated;
grant select, update on public.expert_case_assistant_cases to authenticated;
grant select, insert on public.expert_case_handovers to authenticated;
revoke all on public.expert_case_assistant_cases from anon;
revoke all on public.expert_case_handovers from anon;
revoke all on public.expert_availability from anon;

create or replace function private.initialize_expert_case_assistant()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_expert_user_id uuid;
begin
  insert into public.expert_case_assistant_cases(request_id, assistant_status, assistant_summary)
  values (new.id, 'received', concat_ws(E'\\n', new.subject, new.problem_description))
  on conflict (request_id) do nothing;
  select ep.user_id into v_expert_user_id from public.expert_profiles ep where ep.id=new.assigned_expert_profile_id;
  insert into public.expert_case_notifications(recipient_user_id, actor_user_id, request_id, event_type, preview)
  values (new.requester_user_id, null, new.id, 'case_received',
    'پرونده شما دریافت شد و برای بررسی اولیه در صف دستیار متخصص قرار گرفت. اگر اطلاعات تکمیلی لازم باشد از همین مسیر اطلاع می‌دهیم.');
  if v_expert_user_id is not null then
    insert into public.expert_case_notifications(recipient_user_id, actor_user_id, request_id, event_type, preview)
    values (v_expert_user_id, new.requester_user_id, new.id, 'case_assistant_intake',
      'پرونده جدید دریافت شد و آماده بررسی اولیه در دستیار پرونده‌هاست.');
  end if;
  return new;
end; $$;
drop trigger if exists expert_case_assistant_initialize on public.expert_requests;
create trigger expert_case_assistant_initialize after insert on public.expert_requests
for each row execute function private.initialize_expert_case_assistant();

create or replace function private.guard_expert_case_assistant_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if new.assistant_status='expert_reviewed' and old.assistant_status is distinct from 'expert_reviewed' then
    new.reviewed_at := now();
    new.reviewed_by_user_id := public.current_sarina_user_id();
  end if;
  return new;
end; $$;
drop trigger if exists expert_case_assistant_guard_update on public.expert_case_assistant_cases;
create trigger expert_case_assistant_guard_update before update on public.expert_case_assistant_cases
for each row execute function private.guard_expert_case_assistant_update();

create or replace function private.notify_expert_case_assistant_update()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_farmer_id uuid; v_preview text;
begin
  if old.assistant_status is distinct from new.assistant_status
     or old.completeness_status is distinct from new.completeness_status
     or old.missing_information is distinct from new.missing_information then
    select er.requester_user_id into v_farmer_id from public.expert_requests er where er.id=new.request_id;
    v_preview := case new.assistant_status
      when 'initial_review' then 'دستیار متخصص بررسی اولیه پرونده شما را آغاز کرده است.'
      when 'needs_information' then 'برای ادامه بررسی پرونده، اطلاعات تکمیلی موردنیاز است. لطفاً گفت‌وگوی پرونده را بررسی کنید.'
      when 'awaiting_expert' then 'بررسی اولیه پرونده انجام شد و پرونده در انتظار نظر متخصص است.'
      when 'expert_reviewed' then 'متخصص بررسی پرونده شما را مشاهده و پیگیری آن را آغاز کرده است.'
      else 'وضعیت بررسی اولیه پرونده شما به‌روزرسانی شد.' end;
    insert into public.expert_case_notifications(recipient_user_id, actor_user_id, request_id, event_type, preview)
    values (v_farmer_id, public.current_sarina_user_id(), new.request_id, 'case_assistant_update', v_preview);
  end if;
  return new;
end; $$;
drop trigger if exists expert_case_assistant_notify_update on public.expert_case_assistant_cases;
create trigger expert_case_assistant_notify_update after update on public.expert_case_assistant_cases
for each row execute function private.notify_expert_case_assistant_update();

create or replace function public.respond_to_expert_case_handover(p_handover_id uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_handover public.expert_case_handovers%rowtype;
begin
  select * into v_handover from public.expert_case_handovers where id=p_handover_id for update;
  if not found or v_handover.requester_user_id <> public.current_sarina_user_id()
     or v_handover.status <> 'awaiting_farmer_consent' then
    raise exception 'Handover request is unavailable for this farmer';
  end if;
  if p_accept then
    update public.expert_case_handovers set status='awaiting_substitute_acceptance', farmer_responded_at=now() where id=p_handover_id;
    insert into public.expert_request_assignments(request_id, expert_profile_id, assignment_status, offered_at)
    values (v_handover.request_id, v_handover.to_expert_profile_id, 'offered', now())
    on conflict (request_id, expert_profile_id) do update
      set assignment_status='offered', offered_at=now(), responded_at=null;
    insert into public.expert_case_notifications(recipient_user_id, actor_user_id, request_id, event_type, preview)
    select ep.user_id, public.current_sarina_user_id(), v_handover.request_id, 'case_handover_offered',
      'یک پرونده با رضایت کشاورز برای پذیرش جایگزینی به شما ارجاع شده است.'
    from public.expert_profiles ep where ep.id=v_handover.to_expert_profile_id;
  else
    update public.expert_case_handovers set status='declined', farmer_responded_at=now() where id=p_handover_id;
    insert into public.expert_case_notifications(recipient_user_id, actor_user_id, request_id, event_type, preview)
    values (v_handover.requester_user_id, public.current_sarina_user_id(), v_handover.request_id,
      'case_handover_declined', 'درخواست جایگزینی متخصص تأیید نشد؛ پرونده نزد متخصص فعلی باقی می‌ماند.');
  end if;
  return jsonb_build_object('success', true, 'status', case when p_accept then 'awaiting_substitute_acceptance' else 'declined' end);
end; $$;
revoke all on function public.respond_to_expert_case_handover(uuid,boolean) from public, anon;
grant execute on function public.respond_to_expert_case_handover(uuid,boolean) to authenticated;

create or replace function private.complete_expert_case_handover()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_handover public.expert_case_handovers%rowtype;
begin
  if new.assignment_status not in ('accepted','declined') or old.assignment_status is not distinct from new.assignment_status then return new; end if;
  select * into v_handover from public.expert_case_handovers
    where request_id=new.request_id and to_expert_profile_id=new.expert_profile_id
      and status='awaiting_substitute_acceptance'
    order by initiated_at desc limit 1 for update;
  if not found then return new; end if;
  if new.assignment_status='accepted' then
    update public.expert_request_assignments set assignment_status='revoked', responded_at=now()
      where request_id=new.request_id and expert_profile_id=v_handover.from_expert_profile_id
        and assignment_status in ('offered','accepted');
    update public.expert_requests set assigned_expert_profile_id=v_handover.to_expert_profile_id, status='assigned', updated_at=now()
      where id=new.request_id;
    update public.expert_case_handovers set status='completed', completed_at=now() where id=v_handover.id;
    insert into public.expert_case_notifications(recipient_user_id, actor_user_id, request_id, event_type, preview)
    select er.requester_user_id, ep.user_id, new.request_id, 'case_handover_completed',
      'جایگزینی متخصص با رضایت شما انجام شد؛ متخصص جدید اکنون مسئول پیگیری پرونده است.'
    from public.expert_requests er join public.expert_profiles ep on ep.id=v_handover.to_expert_profile_id where er.id=new.request_id;
  else
    update public.expert_case_handovers set status='declined' where id=v_handover.id;
    insert into public.expert_case_notifications(recipient_user_id, actor_user_id, request_id, event_type, preview)
    select er.requester_user_id, ep.user_id, new.request_id, 'case_handover_substitute_declined',
      'متخصص جایگزین امکان پذیرش پرونده را نداشت؛ پرونده همچنان نزد متخصص قبلی باقی مانده است.'
    from public.expert_requests er join public.expert_profiles ep on ep.id=v_handover.from_expert_profile_id where er.id=new.request_id;
  end if;
  return new;
end; $$;
drop trigger if exists expert_case_handover_assignment_response on public.expert_request_assignments;
create trigger expert_case_handover_assignment_response after update of assignment_status on public.expert_request_assignments
for each row execute function private.complete_expert_case_handover();
