-- SARINA Phase Zero: access-hardening candidate patch
-- Date: 2026-11-23
--
-- IMPORTANT:
-- This is deliberately stored under supabase/patches, NOT supabase/migrations.
-- Do not apply to production until the migration-history drift is reconciled,
-- an independent encrypted backup exists, and restore has passed on an isolated target.
-- Apply first to an isolated development database and run the companion regression test.
--
-- Scope:
-- 1) Fix the handover INSERT-policy owner-binding ambiguity.
-- 2) Independently bind the consent RPC to the real request owner.
-- 3) Remove DDL-like client privileges from existing public tables and future defaults.
-- 4) Make backend-owned AI/provider/channel tables server-only until explicit RLS policies exist.
-- 5) Keep notification clients limited to SELECT and UPDATE(read_at).

begin;

-- A. Existing client roles must never be able to maintain, truncate, add FK references,
-- or create triggers on public application tables.
revoke maintain, truncate, references, trigger
on all tables in schema public
from anon, authenticated;

-- B. Stop the broad default grants from being inherited by newly created public objects.
-- Explicit grants must be added by each future migration according to the table's role.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

alter default privileges for role supabase_admin in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role supabase_admin in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role supabase_admin in schema public
  revoke execute on functions from anon, authenticated;

-- C. These tables are backend-owned. No current frontend source uses direct
-- PostgREST access to them, and their RLS policies are intentionally absent.
-- Remove both table-level and column-level grants until explicit user policies exist.
do $$
declare
  v_table text;
  v_columns text;
begin
  foreach v_table in array array[
    'ai_conversations',
    'ai_messages',
    'ai_analysis_runs',
    'ai_message_feedback',
    'ai_models',
    'ai_providers',
    'ai_model_routing_rules',
    'communication_logs',
    'siacp_key_registry',
    'messaging_channels',
    'messaging_connections'
  ] loop
    if to_regclass(format('public.%I', v_table)) is null then
      continue;
    end if;

    select string_agg(format('%I', column_name), ', ' order by ordinal_position)
      into v_columns
    from information_schema.columns
    where table_schema = 'public' and table_name = v_table;

    if v_columns is not null then
      execute format(
        'revoke select (%1$s), insert (%1$s), update (%1$s), references (%1$s) on table public.%2$I from anon, authenticated',
        v_columns, v_table
      );
    end if;

    execute format(
      'revoke all privileges on table public.%I from anon, authenticated',
      v_table
    );
  end loop;
end
$$;

-- D. Preserve only the operations used by the farmer/specialist notification UI.
-- Recipient RLS policies remain the row-level boundary.
revoke all privileges on table public.expert_case_notifications
  from anon, authenticated;
revoke update (read_at) on table public.expert_case_notifications
  from authenticated;
grant select on table public.expert_case_notifications to authenticated;
grant update (read_at) on table public.expert_case_notifications to authenticated;

-- E. Handover rows are visible to participants and inserted by the assigned expert.
-- Farmer consent is performed only through the protected RPC below.
revoke all privileges on table public.expert_case_handovers
  from anon, authenticated;
grant select, insert on table public.expert_case_handovers to authenticated;

-- F. Fix the active INSERT policy. Explicitly qualify the outer target-table column;
-- the previous unqualified RHS was resolved by PostgreSQL to er.requester_user_id,
-- producing the tautology er.requester_user_id = er.requester_user_id.
drop policy if exists expert_case_handovers_assigned_expert_insert
  on public.expert_case_handovers;

create policy expert_case_handovers_assigned_expert_insert
on public.expert_case_handovers
for insert to authenticated
with check (
  status = 'awaiting_farmer_consent'
  and exists (
    select 1
    from public.expert_requests er
    join public.expert_profiles from_ep
      on from_ep.id = expert_case_handovers.from_expert_profile_id
    join public.expert_profiles to_ep
      on to_ep.id = expert_case_handovers.to_expert_profile_id
    where er.id = expert_case_handovers.request_id
      and er.requester_user_id = expert_case_handovers.requester_user_id
      and er.assigned_expert_profile_id = expert_case_handovers.from_expert_profile_id
      and from_ep.user_id = public.current_sarina_user_id()
      and from_ep.verification_status = 'verified'
      and to_ep.verification_status = 'verified'
      and to_ep.id <> from_ep.id
      and not exists (
        select 1
        from public.expert_availability av
        where av.expert_profile_id = to_ep.id
          and (
            av.pause_new_cases
            or (
              av.availability_status = 'away'
              and (av.vacation_end is null or now() <= av.vacation_end)
            )
            or (
              av.vacation_start is not null
              and now() >= av.vacation_start
              and (av.vacation_end is null or now() <= av.vacation_end)
            )
          )
      )
      and (
        select count(*)
        from public.expert_requests active
        where active.assigned_expert_profile_id = to_ep.id
          and active.status in ('submitted','assigned','in_progress','waiting_user')
      ) < coalesce((
        select av.max_open_cases
        from public.expert_availability av
        where av.expert_profile_id = to_ep.id
      ), 10)
  )
);

-- G. Defense in depth: the SECURITY DEFINER RPC independently joins the handover
-- to its source request and requires the authenticated caller to be that request's
-- actual farmer. A handover row's requester_user_id is never trusted by itself.
create or replace function public.respond_to_expert_case_handover(
  p_handover_id uuid,
  p_accept boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_handover public.expert_case_handovers%rowtype;
  v_capacity integer := 10;
  v_open_count integer := 0;
  v_availability public.expert_availability%rowtype;
begin
  select h.*
    into v_handover
  from public.expert_case_handovers h
  join public.expert_requests er on er.id = h.request_id
  where h.id = p_handover_id
    and er.requester_user_id = public.current_sarina_user_id()
    and h.requester_user_id = er.requester_user_id
  for update of h;

  if not found or v_handover.status <> 'awaiting_farmer_consent' then
    raise exception 'Handover request is unavailable for this farmer';
  end if;

  if p_accept then
    select *
      into v_availability
    from public.expert_availability
    where expert_profile_id = v_handover.to_expert_profile_id
    for update;

    if found then
      if v_availability.pause_new_cases
        or (
          v_availability.availability_status = 'away'
          and (v_availability.vacation_end is null or now() <= v_availability.vacation_end)
        )
        or (
          v_availability.vacation_start is not null
          and now() >= v_availability.vacation_start
          and (v_availability.vacation_end is null or now() <= v_availability.vacation_end)
        ) then
        raise exception 'The proposed substitute is currently unavailable';
      end if;
      v_capacity := v_availability.max_open_cases;
    end if;

    select count(*)
      into v_open_count
    from public.expert_requests er
    where er.assigned_expert_profile_id = v_handover.to_expert_profile_id
      and er.status in ('submitted','assigned','in_progress','waiting_user');

    if v_open_count >= v_capacity then
      raise exception 'The proposed substitute has reached the open-case capacity';
    end if;

    update public.expert_case_handovers
      set status = 'awaiting_substitute_acceptance',
          farmer_responded_at = now()
    where id = p_handover_id;

    insert into public.expert_request_assignments(
      request_id, expert_profile_id, assignment_status, offered_at
    )
    values (
      v_handover.request_id, v_handover.to_expert_profile_id, 'offered', now()
    )
    on conflict (request_id, expert_profile_id) do update
      set assignment_status = 'offered',
          offered_at = now(),
          responded_at = null;

    insert into public.expert_case_notifications(
      recipient_user_id, actor_user_id, request_id, event_type, preview
    )
    select
      ep.user_id,
      public.current_sarina_user_id(),
      v_handover.request_id,
      'case_handover_offered',
      'یک پرونده با رضایت کشاورز برای پذیرش جایگزینی به شما ارجاع شده است.'
    from public.expert_profiles ep
    where ep.id = v_handover.to_expert_profile_id;
  else
    update public.expert_case_handovers
      set status = 'declined',
          farmer_responded_at = now()
    where id = p_handover_id;

    insert into public.expert_case_notifications(
      recipient_user_id, actor_user_id, request_id, event_type, preview
    )
    values (
      v_handover.requester_user_id,
      public.current_sarina_user_id(),
      v_handover.request_id,
      'case_handover_declined',
      'درخواست جایگزینی متخصص تأیید نشد؛ پرونده نزد متخصص فعلی باقی می‌ماند.'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'status',
    case when p_accept then 'awaiting_substitute_acceptance' else 'declined' end
  );
end;
$function$;

revoke all on function public.respond_to_expert_case_handover(uuid, boolean)
  from public, anon;
grant execute on function public.respond_to_expert_case_handover(uuid, boolean)
  to authenticated;

commit;
