-- Durable SCI task lifecycle, parent/child proposals, queue delivery and audit history.
-- Private task data stays outside exposed schemas. No worker or model is activated by this migration.

create extension if not exists pgmq;

do $$
begin
  if not exists (
    select 1 from pgmq.list_queues() where queue_name = 'sarina_sci_tasks'
  ) then
    perform pgmq.create('sarina_sci_tasks');
  end if;
end;
$$;

create schema if not exists sci_internal;
-- PGMQ is a server-side transport; clients must not access its schema or objects directly.
revoke all on schema pgmq from public, anon, authenticated;
revoke all on all functions in schema pgmq from public, anon, authenticated;
revoke all on all tables in schema pgmq from public, anon, authenticated;
revoke all on all sequences in schema pgmq from public, anon, authenticated;
grant usage on schema pgmq to service_role;
revoke all on schema sci_internal from public, anon, authenticated;
grant usage on schema sci_internal to service_role;
grant execute on function pgmq.send(text, jsonb, integer) to service_role;
grant execute on function pgmq.read(text, integer, integer) to service_role;
grant execute on function pgmq.archive(text, bigint) to service_role;
grant execute on function pgmq.set_vt(text, bigint, integer) to service_role;

create table if not exists sci_internal.sci_tasks (
  task_id uuid primary key default gen_random_uuid(),
  parent_task_id uuid references sci_internal.sci_tasks(task_id) on delete restrict,
  root_task_id uuid not null,
  task_kind text not null check (task_kind in ('parent', 'specialist_proposal')),
  owner_auth_user_id uuid not null references auth.users(id) on delete restrict,
  farm_id uuid not null references public.farms(id) on delete restrict,
  correlation_id uuid not null,
  channel text not null check (channel in ('chat', 'voice', 'api', 'internal')),
  intent text not null check (char_length(intent) between 1 and 160),
  domain text not null check (domain in (
    'conversation', 'agronomy', 'crop_diagnostics', 'knowledge', 'marketplace',
    'specialist', 'account', 'soil_water', 'irrigation', 'plant_nutrition',
    'plant_health', 'climate', 'agricultural_knowledge', 'market_intelligence',
    'trade_export', 'finance_economics', 'logistics_supply_chain'
  )),
  agent_id text not null,
  agent_lifecycle_state text not null check (
    agent_lifecycle_state in ('registered', 'simulated', 'enabled', 'paused', 'deprecated')
  ),
  status text not null check (status in (
    'received', 'validated', 'queued', 'assigned', 'running',
    'waiting_for_human', 'succeeded', 'failed', 'cancelled', 'timed_out'
  )),
  priority text not null check (priority in ('low', 'normal', 'high', 'urgent')),
  risk text not null check (risk in ('low', 'medium', 'high', 'critical')),
  modalities text[] not null check (cardinality(modalities) > 0),
  context_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(context_refs) = 'array'),
  payload_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(payload_refs) = 'array'),
  permissions text[] not null default '{}',
  request_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(request_payload) = 'object'),
  request_fingerprint text not null,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  human_review_required boolean not null default true,
  dispatch_authorized boolean not null default false,
  policy_decision_ref uuid,
  human_approval_ref uuid,
  available_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 8),
  queue_message_id bigint,
  lease_owner text,
  lease_token uuid,
  lease_expires_at timestamptz,
  result jsonb check (result is null or jsonb_typeof(result) = 'object'),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  constraint sci_tasks_parent_shape check (
    (task_kind = 'parent' and parent_task_id is null and root_task_id = task_id)
    or
    (task_kind = 'specialist_proposal' and parent_task_id is not null and root_task_id <> task_id)
  ),
  constraint sci_tasks_deadline_valid check (deadline_at > created_at),
  constraint sci_tasks_lease_shape check (
    (status = 'running' and lease_owner is not null and lease_token is not null and lease_expires_at is not null)
    or
    (status <> 'running' and lease_owner is null and lease_token is null and lease_expires_at is null)
  ),
  constraint sci_tasks_child_dispatch_guard check (
    task_kind <> 'specialist_proposal'
    or (status = 'waiting_for_human' and dispatch_authorized = false)
    or (status in ('queued', 'assigned', 'running', 'succeeded') and dispatch_authorized = true
        and agent_lifecycle_state = 'enabled' and policy_decision_ref is not null)
    or status in ('failed', 'cancelled', 'timed_out')
  ),
  unique (owner_auth_user_id, idempotency_key)
);

create index if not exists sci_tasks_queue_ready_idx
  on sci_internal.sci_tasks (priority, available_at, created_at)
  where status = 'queued' and dispatch_authorized = true;
create index if not exists sci_tasks_parent_idx
  on sci_internal.sci_tasks (parent_task_id, created_at);
create index if not exists sci_tasks_owner_history_idx
  on sci_internal.sci_tasks (owner_auth_user_id, created_at desc);
create index if not exists sci_tasks_lease_expiry_idx
  on sci_internal.sci_tasks (lease_expires_at)
  where status = 'running';

create table if not exists sci_internal.sci_task_events (
  event_id bigint generated always as identity primary key,
  task_id uuid not null references sci_internal.sci_tasks(task_id) on delete restrict,
  event_type text not null,
  from_status text,
  to_status text not null,
  actor_kind text not null check (actor_kind in ('system', 'user', 'sci', 'worker')),
  actor_id text,
  reason_code text not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index if not exists sci_task_events_task_idx
  on sci_internal.sci_task_events (task_id, event_id);

alter table sci_internal.sci_tasks enable row level security;
alter table sci_internal.sci_task_events enable row level security;
revoke all on sci_internal.sci_tasks, sci_internal.sci_task_events from public, anon, authenticated;
grant select, insert, update on sci_internal.sci_tasks to service_role;
grant select, insert on sci_internal.sci_task_events to service_role;
grant usage, select on sequence sci_internal.sci_task_events_event_id_seq to service_role;

comment on schema sci_internal is
  'Private SARINA SCI task state. Access only through service-side, service_role RPCs.';
comment on table sci_internal.sci_tasks is
  'Durable SCI parent tasks and blocked specialist proposals. Raw farm context is not stored; only scoped references are retained.';
comment on table sci_internal.sci_task_events is
  'Append-only SCI task lifecycle history.';

create or replace function public.sci_create_task(p_task jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_task_id uuid;
  v_parent_id uuid;
  v_owner_id uuid;
  v_farm_id uuid;
  v_correlation_id uuid;
  v_kind text;
  v_status text;
  v_domain text;
  v_agent_id text;
  v_agent_state text;
  v_idempotency text;
  v_fingerprint text;
  v_root_id uuid;
  v_parent sci_internal.sci_tasks%rowtype;
  v_task sci_internal.sci_tasks%rowtype;
  v_existing sci_internal.sci_tasks%rowtype;
  v_child_count integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_task is null or jsonb_typeof(p_task) <> 'object' then
    raise exception 'Task payload must be an object' using errcode = '22023';
  end if;

  v_task_id := coalesce(nullif(p_task ->> 'task_id', '')::uuid, gen_random_uuid());
  v_parent_id := nullif(p_task ->> 'parent_task_id', '')::uuid;
  v_owner_id := (p_task ->> 'owner_auth_user_id')::uuid;
  v_farm_id := (p_task ->> 'farm_id')::uuid;
  v_correlation_id := (p_task ->> 'correlation_id')::uuid;
  v_kind := coalesce(p_task ->> 'task_kind', 'parent');
  v_status := coalesce(p_task ->> 'initial_status', 'waiting_for_human');
  v_domain := p_task ->> 'domain';
  v_agent_id := p_task ->> 'agent_id';
  v_agent_state := coalesce(p_task ->> 'agent_lifecycle_state', 'registered');
  v_idempotency := p_task ->> 'idempotency_key';

  if v_owner_id is null or v_farm_id is null or v_correlation_id is null
     or v_domain is null or v_agent_id is null
     or v_kind not in ('parent', 'specialist_proposal')
     or v_status not in ('validated', 'waiting_for_human')
     or v_agent_state not in ('registered', 'simulated', 'enabled', 'paused', 'deprecated')
     or v_idempotency is null or char_length(v_idempotency) < 8 or char_length(v_idempotency) > 200
     or coalesce(p_task ->> 'deadline_at', '') = ''
     or (p_task ->> 'deadline_at')::timestamptz <= now()
     or jsonb_typeof(coalesce(p_task -> 'request_payload', '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_task -> 'context_refs', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_task -> 'payload_refs', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_task -> 'modalities', '[]'::jsonb)) <> 'array'
     or case when jsonb_typeof(coalesce(p_task -> 'modalities', '[]'::jsonb)) = 'array'
       then jsonb_array_length(coalesce(p_task -> 'modalities', '[]'::jsonb)) = 0 else true end
     or case when jsonb_typeof(coalesce(p_task -> 'modalities', '[]'::jsonb)) = 'array'
       then exists (
         select 1 from jsonb_array_elements_text(coalesce(p_task -> 'modalities', '[]'::jsonb)) modality
         where modality not in ('text', 'image', 'document', 'audio', 'other')
       ) else true end
     or case when jsonb_typeof(coalesce(p_task -> 'context_refs', '[]'::jsonb)) = 'array'
       then exists (
         select 1 from jsonb_array_elements(coalesce(p_task -> 'context_refs', '[]'::jsonb)) ref
         where jsonb_typeof(ref) <> 'string'
       ) else true end
     or case when jsonb_typeof(coalesce(p_task -> 'payload_refs', '[]'::jsonb)) = 'array'
       then exists (
         select 1 from jsonb_array_elements(coalesce(p_task -> 'payload_refs', '[]'::jsonb)) ref
         where jsonb_typeof(ref) <> 'string'
       ) else true end then
    raise exception 'Invalid task envelope' using errcode = '22023';
  end if;

  if v_kind = 'specialist_proposal' and
     (v_parent_id is null or v_status <> 'waiting_for_human' or v_agent_state = 'enabled'
      or not (
        (v_domain = 'soil_water' and v_agent_id = 'soil_water_specialist')
        or (v_domain = 'irrigation' and v_agent_id = 'irrigation_specialist')
        or (v_domain = 'plant_nutrition' and v_agent_id = 'plant_nutrition_specialist')
        or (v_domain = 'plant_health' and v_agent_id = 'plant_health_specialist')
        or (v_domain = 'climate' and v_agent_id = 'climate_specialist')
        or (v_domain = 'agricultural_knowledge' and v_agent_id = 'agricultural_knowledge_specialist')
        or (v_domain = 'market_intelligence' and v_agent_id = 'market_intelligence_specialist')
        or (v_domain = 'trade_export' and v_agent_id = 'trade_export_specialist')
        or (v_domain = 'finance_economics' and v_agent_id = 'finance_economics_specialist')
        or (v_domain = 'logistics_supply_chain' and v_agent_id = 'logistics_supply_chain_specialist')
      )) then
    raise exception 'Specialist proposals must remain blocked until separately approved and enabled'
      using errcode = '42501';
  end if;
  if v_kind = 'parent' and v_parent_id is not null then
    raise exception 'Parent tasks cannot have a parent_task_id' using errcode = '22023';
  end if;

  v_fingerprint := md5(jsonb_build_object(
    'parent_task_id', v_parent_id,
    'farm_id', v_farm_id,
    'task_kind', v_kind,
    'domain', v_domain,
    'agent_id', v_agent_id,
    'agent_lifecycle_state', v_agent_state,
    'channel', coalesce(p_task ->> 'channel', 'chat'),
    'intent', coalesce(p_task ->> 'intent', 'general_request'),
    'priority', coalesce(p_task ->> 'priority', 'normal'),
    'risk', coalesce(p_task ->> 'risk', 'medium'),
    'modalities', coalesce(p_task -> 'modalities', '["text"]'::jsonb),
    'permissions', coalesce(p_task -> 'permissions', '[]'::jsonb),
    'human_review_required', coalesce((p_task ->> 'human_review_required')::boolean, true),
    'request_payload', coalesce(p_task -> 'request_payload', '{}'::jsonb),
    'context_refs', coalesce(p_task -> 'context_refs', '[]'::jsonb),
    'payload_refs', coalesce(p_task -> 'payload_refs', '[]'::jsonb)
  )::text);

  select * into v_existing
  from sci_internal.sci_tasks
  where owner_auth_user_id = v_owner_id and idempotency_key = v_idempotency;
  if found then
    if v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'Idempotency key reused for a different task' using errcode = '22023';
    end if;
    return jsonb_build_object('task_id', v_existing.task_id, 'status', v_existing.status, 'duplicate', true);
  end if;

  if v_kind = 'parent' then
    v_root_id := v_task_id;
  else
    select * into v_parent
    from sci_internal.sci_tasks
    where task_id = v_parent_id
    for update;
    if not found or v_parent.task_kind <> 'parent'
       or v_parent.owner_auth_user_id <> v_owner_id
       or v_parent.farm_id <> v_farm_id
       or v_parent.status in ('succeeded', 'failed', 'cancelled', 'timed_out') then
      raise exception 'Parent task unavailable or scope mismatch' using errcode = '42501';
    end if;
    select count(*) into v_child_count
    from sci_internal.sci_tasks where parent_task_id = v_parent_id;
    if v_child_count >= 4 then
      raise exception 'Specialist child task limit exceeded' using errcode = '22023';
    end if;
    v_root_id := v_parent.root_task_id;
  end if;

  insert into sci_internal.sci_tasks (
    task_id, parent_task_id, root_task_id, task_kind, owner_auth_user_id, farm_id,
    correlation_id, channel, intent, domain, agent_id, agent_lifecycle_state,
    status, priority, risk, modalities, context_refs, payload_refs, permissions,
    request_payload, request_fingerprint, idempotency_key, human_review_required,
    dispatch_authorized, available_at, deadline_at, max_attempts
  ) values (
    v_task_id, v_parent_id, v_root_id, v_kind, v_owner_id, v_farm_id,
    v_correlation_id, coalesce(p_task ->> 'channel', 'chat'),
    coalesce(p_task ->> 'intent', 'general_request'), v_domain, v_agent_id, v_agent_state,
    v_status, coalesce(p_task ->> 'priority', 'normal'), coalesce(p_task ->> 'risk', 'medium'),
    array(select jsonb_array_elements_text(coalesce(p_task -> 'modalities', '["text"]'::jsonb))),
    coalesce(p_task -> 'context_refs', '[]'::jsonb),
    coalesce(p_task -> 'payload_refs', '[]'::jsonb),
    array(select jsonb_array_elements_text(coalesce(p_task -> 'permissions', '[]'::jsonb))),
    coalesce(p_task -> 'request_payload', '{}'::jsonb), v_fingerprint, v_idempotency,
    coalesce((p_task ->> 'human_review_required')::boolean, true),
    false, now(), (p_task ->> 'deadline_at')::timestamptz,
    least(greatest(coalesce((p_task ->> 'max_attempts')::integer, 3), 1), 8)
  )
  on conflict (owner_auth_user_id, idempotency_key) do nothing
  returning * into v_task;

  if not found then
    select * into v_existing from sci_internal.sci_tasks
    where owner_auth_user_id = v_owner_id and idempotency_key = v_idempotency;
    if v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'Idempotency key reused for a different task' using errcode = '22023';
    end if;
    return jsonb_build_object('task_id', v_existing.task_id, 'status', v_existing.status, 'duplicate', true);
  end if;

  insert into sci_internal.sci_task_events(
    task_id, event_type, from_status, to_status, actor_kind, actor_id, reason_code, metadata
  ) values (
    v_task.task_id, 'task_created', null, v_task.status, 'sci',
    v_owner_id::text, 'TASK_ACCEPTED',
    jsonb_build_object('task_kind', v_kind, 'parent_task_id', v_parent_id)
  );

  return jsonb_build_object('task_id', v_task.task_id, 'status', v_task.status, 'duplicate', false);
end;
$function$;

create or replace function public.sci_authorize_task_dispatch(
  p_task_id uuid,
  p_policy_decision_ref uuid,
  p_human_approval_ref uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_task sci_internal.sci_tasks%rowtype;
  v_msg_id bigint;
  v_previous_status text;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_policy_decision_ref is null then
    raise exception 'SCI policy decision reference required' using errcode = '22023';
  end if;
  select * into v_task from sci_internal.sci_tasks where task_id = p_task_id for update;
  if not found then raise exception 'Task not found' using errcode = 'P0002'; end if;
  if v_task.status not in ('validated', 'waiting_for_human') or v_task.dispatch_authorized then
    raise exception 'Task is not awaiting dispatch authorization' using errcode = '42501';
  end if;
  if v_task.agent_lifecycle_state <> 'enabled' then
    raise exception 'Agent is not enabled' using errcode = '42501';
  end if;
  if v_task.parent_task_id is not null and exists (
    select 1 from sci_internal.sci_tasks parent
    where parent.task_id = v_task.parent_task_id
      and parent.status in ('succeeded', 'failed', 'cancelled', 'timed_out')
  ) then
    raise exception 'Parent task is already terminal' using errcode = '42501';
  end if;
  if v_task.human_review_required and p_human_approval_ref is null then
    raise exception 'Human approval reference required' using errcode = '42501';
  end if;
  v_previous_status := v_task.status;

  update sci_internal.sci_tasks
  set status = 'queued', dispatch_authorized = true,
      policy_decision_ref = p_policy_decision_ref,
      human_approval_ref = p_human_approval_ref,
      available_at = now(), updated_at = now()
  where task_id = p_task_id
  returning * into v_task;

  select * into strict v_task from sci_internal.sci_tasks where task_id = p_task_id;
  insert into sci_internal.sci_task_events(
    task_id, event_type, from_status, to_status, actor_kind, actor_id, reason_code, metadata
  ) values (
    p_task_id, 'dispatch_authorized', v_previous_status, 'queued', 'sci',
    null, 'SCI_POLICY_APPROVED',
    jsonb_build_object('policy_decision_ref', p_policy_decision_ref, 'human_approval_ref', p_human_approval_ref)
  );

  select * into v_msg_id from pgmq.send('sarina_sci_tasks', jsonb_build_object('task_id', p_task_id));
  update sci_internal.sci_tasks set queue_message_id = v_msg_id where task_id = p_task_id;
  return jsonb_build_object('task_id', p_task_id, 'status', 'queued', 'dispatch_authorized', true);
end;
$function$;

create or replace function public.sci_claim_tasks(
  p_worker_id text,
  p_limit integer default 1,
  p_lease_seconds integer default 60
)
returns setof jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_message record;
  v_task sci_internal.sci_tasks%rowtype;
  v_token uuid;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_worker_id is null or char_length(trim(p_worker_id)) = 0
     or p_limit is null or p_limit < 1 or p_limit > 20
     or p_lease_seconds is null or p_lease_seconds < 5 or p_lease_seconds > 300 then
    raise exception 'Invalid worker claim parameters' using errcode = '22023';
  end if;

  for v_message in
    select * from pgmq.read('sarina_sci_tasks', p_lease_seconds, p_limit)
  loop
    begin
      select * into v_task
      from sci_internal.sci_tasks
      where task_id = (v_message.message ->> 'task_id')::uuid
      for update;
    exception when others then
      perform pgmq.archive('sarina_sci_tasks', v_message.msg_id);
      continue;
    end;

    if not found then
      perform pgmq.archive('sarina_sci_tasks', v_message.msg_id);
      continue;
    end if;

    if v_task.parent_task_id is not null and exists (
      select 1 from sci_internal.sci_tasks parent
      where parent.task_id = v_task.parent_task_id
        and parent.status in ('succeeded', 'failed', 'cancelled', 'timed_out')
    ) then
      update sci_internal.sci_tasks
      set status = 'cancelled', dispatch_authorized = false,
          lease_owner = null, lease_token = null, lease_expires_at = null,
          queue_message_id = null, completed_at = now(), updated_at = now()
      where task_id = v_task.task_id;
      insert into sci_internal.sci_task_events(
        task_id, event_type, from_status, to_status, actor_kind, actor_id, reason_code
      ) values (
        v_task.task_id, 'child_task_cancelled', v_task.status, 'cancelled',
        'system', 'sci_scheduler', 'PARENT_TASK_TERMINAL'
      );
      perform pgmq.archive('sarina_sci_tasks', v_message.msg_id);
      continue;
    end if;

    if v_task.status = 'running' and v_task.lease_expires_at <= now()
       and v_task.dispatch_authorized and v_task.agent_lifecycle_state = 'enabled'
       and v_task.deadline_at > now() and v_task.attempt_count < v_task.max_attempts then
      v_token := gen_random_uuid();
      update sci_internal.sci_tasks
      set lease_owner = p_worker_id, lease_token = v_token,
          lease_expires_at = least(now() + make_interval(secs => p_lease_seconds), deadline_at),
          queue_message_id = v_message.msg_id, attempt_count = attempt_count + 1,
          updated_at = now()
      where task_id = v_task.task_id
      returning * into v_task;
      insert into sci_internal.sci_task_events(
        task_id, event_type, from_status, to_status, actor_kind, actor_id, reason_code, metadata
      ) values (
        v_task.task_id, 'task_lease_reclaimed', 'running', 'running', 'worker', p_worker_id,
        'EXPIRED_LEASE_RECLAIMED', jsonb_build_object('attempt', v_task.attempt_count)
      );
      return next jsonb_build_object(
        'task_id', v_task.task_id, 'parent_task_id', v_task.parent_task_id,
        'root_task_id', v_task.root_task_id, 'domain', v_task.domain,
        'agent_id', v_task.agent_id, 'request_payload', v_task.request_payload,
        'context_refs', v_task.context_refs, 'payload_refs', v_task.payload_refs,
        'lease_token', v_token, 'lease_expires_at', v_task.lease_expires_at,
        'attempt_count', v_task.attempt_count
      );
      continue;
    end if;

    if v_task.status = 'queued' and v_task.dispatch_authorized
       and v_task.agent_lifecycle_state <> 'enabled' then
      update sci_internal.sci_tasks
      set status = 'waiting_for_human', dispatch_authorized = false,
          queue_message_id = null, updated_at = now()
      where task_id = v_task.task_id;
      insert into sci_internal.sci_task_events(
        task_id, event_type, from_status, to_status, actor_kind, actor_id, reason_code
      ) values (
        v_task.task_id, 'dispatch_blocked', 'queued', 'waiting_for_human',
        'system', 'sci_scheduler', 'AGENT_NOT_ENABLED_AT_CLAIM'
      );
      perform pgmq.archive('sarina_sci_tasks', v_message.msg_id);
      continue;
    end if;

    if v_task.status <> 'queued' or not v_task.dispatch_authorized
       or v_task.deadline_at <= now() then
      if v_task.status = 'queued' and v_task.deadline_at <= now() then
        update sci_internal.sci_tasks
        set status = 'timed_out', updated_at = now(), completed_at = now(),
            queue_message_id = null
        where task_id = v_task.task_id;
        insert into sci_internal.sci_task_events(
          task_id, event_type, from_status, to_status, actor_kind, actor_id, reason_code
        ) values (v_task.task_id, 'task_timed_out', 'queued', 'timed_out', 'system', null, 'DEADLINE_EXCEEDED');
      elsif v_task.status = 'running' and v_task.lease_expires_at > now() then
        perform pgmq.set_vt(
          'sarina_sci_tasks', v_message.msg_id,
          greatest(1, least(300, ceil(extract(epoch from (v_task.lease_expires_at - now())))::integer))
        );
        continue;
      end if;
      perform pgmq.archive('sarina_sci_tasks', v_message.msg_id);
      continue;
    end if;

    v_token := gen_random_uuid();
    update sci_internal.sci_tasks
    set status = 'running', attempt_count = attempt_count + 1,
        lease_owner = p_worker_id, lease_token = v_token,
        lease_expires_at = least(now() + make_interval(secs => p_lease_seconds), deadline_at),
        queue_message_id = v_message.msg_id,
        started_at = coalesce(started_at, now()), updated_at = now()
    where task_id = v_task.task_id
    returning * into v_task;

    insert into sci_internal.sci_task_events(
      task_id, event_type, from_status, to_status, actor_kind, actor_id, reason_code, metadata
    ) values (
      v_task.task_id, 'task_claimed', 'queued', 'running', 'worker', p_worker_id,
      'WORKER_LEASE_ACQUIRED', jsonb_build_object('attempt', v_task.attempt_count)
    );

    return next jsonb_build_object(
      'task_id', v_task.task_id, 'parent_task_id', v_task.parent_task_id,
      'root_task_id', v_task.root_task_id, 'domain', v_task.domain,
      'agent_id', v_task.agent_id, 'request_payload', v_task.request_payload,
      'context_refs', v_task.context_refs, 'payload_refs', v_task.payload_refs,
      'lease_token', v_token, 'lease_expires_at', v_task.lease_expires_at,
      'attempt_count', v_task.attempt_count
    );
  end loop;
end;
$function$;

create or replace function public.sci_heartbeat_task(
  p_task_id uuid,
  p_lease_token uuid,
  p_lease_seconds integer default 60
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_task sci_internal.sci_tasks%rowtype;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_lease_seconds is null or p_lease_seconds < 5 or p_lease_seconds > 300 then
    raise exception 'Lease extension must be between 5 and 300 seconds' using errcode = '22023';
  end if;
  select * into v_task from sci_internal.sci_tasks
  where task_id = p_task_id for update;
  if not found or v_task.status <> 'running' or v_task.lease_token <> p_lease_token
     or v_task.lease_expires_at <= now() then
    raise exception 'Task lease is invalid or expired' using errcode = '42501';
  end if;
  update sci_internal.sci_tasks
  set lease_expires_at = least(now() + make_interval(secs => p_lease_seconds), deadline_at),
      updated_at = now()
  where task_id = p_task_id
  returning * into v_task;
  insert into sci_internal.sci_task_events(
    task_id, event_type, from_status, to_status, actor_kind, actor_id, reason_code
  ) values (
    p_task_id, 'task_lease_extended', 'running', 'running', 'worker',
    v_task.lease_owner, 'WORKER_HEARTBEAT'
  );
  return jsonb_build_object('task_id', p_task_id, 'lease_expires_at', v_task.lease_expires_at);
end;
$function$;

create or replace function public.sci_complete_task(
  p_task_id uuid,
  p_lease_token uuid,
  p_result jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_task sci_internal.sci_tasks%rowtype;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_result is null or jsonb_typeof(p_result) <> 'object' then
    raise exception 'Result must be a JSON object' using errcode = '22023';
  end if;
  select * into v_task from sci_internal.sci_tasks
  where task_id = p_task_id for update;
  if not found or v_task.status <> 'running' or v_task.lease_token <> p_lease_token
     or v_task.lease_expires_at <= now() then
    raise exception 'Task lease is invalid or expired' using errcode = '42501';
  end if;

  update sci_internal.sci_tasks
  set status = 'succeeded', result = p_result, lease_owner = null, lease_token = null,
      lease_expires_at = null, completed_at = now(), updated_at = now(), queue_message_id = null
  where task_id = p_task_id;
  if v_task.queue_message_id is not null then
    perform pgmq.archive('sarina_sci_tasks', v_task.queue_message_id);
  end if;
  insert into sci_internal.sci_task_events(
    task_id, event_type, from_status, to_status, actor_kind, actor_id, reason_code
  ) values (p_task_id, 'task_completed', 'running', 'succeeded', 'worker', v_task.lease_owner, 'RESULT_RECORDED');
  return jsonb_build_object('task_id', p_task_id, 'status', 'succeeded');
end;
$function$;

create or replace function public.sci_fail_task(
  p_task_id uuid,
  p_lease_token uuid,
  p_error_code text,
  p_retryable boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_task sci_internal.sci_tasks%rowtype;
  v_delay integer;
  v_next_status text;
  v_new_msg_id bigint;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  select * into v_task from sci_internal.sci_tasks
  where task_id = p_task_id for update;
  if not found or v_task.status <> 'running' or v_task.lease_token <> p_lease_token
     or v_task.lease_expires_at <= now() then
    raise exception 'Task lease is invalid or expired' using errcode = '42501';
  end if;

  v_delay := least(300, 5 * (2 ^ least(v_task.attempt_count - 1, 6))::integer);
  if p_retryable and v_task.attempt_count < v_task.max_attempts
     and now() + make_interval(secs => v_delay) < v_task.deadline_at then
    v_next_status := 'queued';
  elsif now() >= v_task.deadline_at then
    v_next_status := 'timed_out';
  else
    v_next_status := 'failed';
  end if;

  update sci_internal.sci_tasks
  set status = v_next_status,
      available_at = case when v_next_status = 'queued' then now() + make_interval(secs => v_delay) else available_at end,
      error_code = left(coalesce(nullif(trim(p_error_code), ''), 'WORKER_FAILED'), 120),
      lease_owner = null, lease_token = null, lease_expires_at = null,
      queue_message_id = null,
      completed_at = case when v_next_status in ('failed', 'timed_out') then now() else null end,
      updated_at = now()
  where task_id = p_task_id;

  if v_task.queue_message_id is not null then
    perform pgmq.archive('sarina_sci_tasks', v_task.queue_message_id);
  end if;
  if v_next_status = 'queued' then
    select * into v_new_msg_id from pgmq.send(
      'sarina_sci_tasks', jsonb_build_object('task_id', p_task_id), v_delay
    );
    update sci_internal.sci_tasks set queue_message_id = v_new_msg_id where task_id = p_task_id;
  end if;
  insert into sci_internal.sci_task_events(
    task_id, event_type, from_status, to_status, actor_kind, actor_id, reason_code, metadata
  ) values (
    p_task_id, 'task_failed_or_retried', 'running', v_next_status, 'worker',
    v_task.lease_owner, left(coalesce(nullif(trim(p_error_code), ''), 'WORKER_FAILED'), 120),
    jsonb_build_object('retryable', coalesce(p_retryable, false), 'delay_seconds', v_delay)
  );
  return jsonb_build_object('task_id', p_task_id, 'status', v_next_status, 'retry_delay_seconds', v_delay);
end;
$function$;

create or replace function public.sci_recover_expired_tasks(p_limit integer default 50)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_task sci_internal.sci_tasks%rowtype;
  v_new_status text;
  v_delay integer;
  v_new_msg_id bigint;
  v_recovered integer := 0;
  v_timed_out integer := 0;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' and current_user <> 'postgres' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception 'Recovery limit must be between 1 and 200' using errcode = '22023';
  end if;

  for v_task in
    select * from sci_internal.sci_tasks
    where (status = 'running' and lease_expires_at <= now())
       or (status in ('validated', 'waiting_for_human', 'queued') and deadline_at <= now())
    order by coalesce(lease_expires_at, deadline_at)
    for update skip locked
    limit p_limit
  loop
    if v_task.status <> 'running' or v_task.deadline_at <= now() then
      v_new_status := 'timed_out';
      update sci_internal.sci_tasks
      set status = v_new_status, lease_owner = null, lease_token = null,
          lease_expires_at = null, queue_message_id = null,
          completed_at = now(), updated_at = now()
      where task_id = v_task.task_id;
      if v_task.queue_message_id is not null then
        perform pgmq.archive('sarina_sci_tasks', v_task.queue_message_id);
      end if;
      v_timed_out := v_timed_out + 1;
    elsif v_task.agent_lifecycle_state <> 'enabled' then
      v_new_status := 'waiting_for_human';
      update sci_internal.sci_tasks
      set status = 'waiting_for_human', dispatch_authorized = false,
          lease_owner = null, lease_token = null, lease_expires_at = null,
          queue_message_id = null, updated_at = now()
      where task_id = v_task.task_id;
      if v_task.queue_message_id is not null then
        perform pgmq.archive('sarina_sci_tasks', v_task.queue_message_id);
      end if;
    elsif v_task.attempt_count < v_task.max_attempts then
      v_delay := least(300, 5 * (2 ^ greatest(v_task.attempt_count - 1, 0))::integer);
      v_new_status := 'queued';
      update sci_internal.sci_tasks
      set status = 'queued', available_at = now() + make_interval(secs => v_delay),
          lease_owner = null, lease_token = null, lease_expires_at = null,
          queue_message_id = null, updated_at = now()
      where task_id = v_task.task_id;
      if v_task.queue_message_id is not null then
        perform pgmq.archive('sarina_sci_tasks', v_task.queue_message_id);
      end if;
      select * into v_new_msg_id from pgmq.send(
        'sarina_sci_tasks', jsonb_build_object('task_id', v_task.task_id), v_delay
      );
      update sci_internal.sci_tasks set queue_message_id = v_new_msg_id where task_id = v_task.task_id;
      v_recovered := v_recovered + 1;
    else
      v_new_status := 'failed';
      update sci_internal.sci_tasks
      set status = 'failed', lease_owner = null, lease_token = null,
          lease_expires_at = null, queue_message_id = null,
          error_code = 'WORKER_LEASE_EXPIRED', completed_at = now(), updated_at = now()
      where task_id = v_task.task_id;
      if v_task.queue_message_id is not null then
        perform pgmq.archive('sarina_sci_tasks', v_task.queue_message_id);
      end if;
    end if;

    insert into sci_internal.sci_task_events(
      task_id, event_type, from_status, to_status, actor_kind, actor_id, reason_code
    ) values (
      v_task.task_id, 'task_recovered', v_task.status, v_new_status,
      'system', 'sci_recovery', case when v_new_status = 'queued' then 'EXPIRED_LEASE_REQUEUED' else 'TASK_EXPIRED_OR_RETRY_LIMIT' end
    );
  end loop;

  return jsonb_build_object('requeued', v_recovered, 'timed_out', v_timed_out);
end;
$function$;

create or replace function public.sci_cancel_task(
  p_task_id uuid,
  p_owner_auth_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_task sci_internal.sci_tasks%rowtype;
  v_count integer := 0;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_owner_auth_user_id is null then
    raise exception 'Task owner required' using errcode = '22023';
  end if;
  perform 1 from sci_internal.sci_tasks
  where task_id = p_task_id and owner_auth_user_id = p_owner_auth_user_id;
  if not found then
    raise exception 'Task not found' using errcode = 'P0002';
  end if;

  for v_task in
    with recursive descendants as (
      select task_id from sci_internal.sci_tasks
      where task_id = p_task_id and owner_auth_user_id = p_owner_auth_user_id
      union all
      select child.task_id from sci_internal.sci_tasks child
      join descendants parent on child.parent_task_id = parent.task_id
      where child.owner_auth_user_id = p_owner_auth_user_id
    )
    select t.* from sci_internal.sci_tasks t
    join descendants d on d.task_id = t.task_id
    where t.status not in ('succeeded', 'failed', 'cancelled', 'timed_out')
    for update
  loop
    update sci_internal.sci_tasks
    set status = 'cancelled', dispatch_authorized = false,
        lease_owner = null, lease_token = null, lease_expires_at = null,
        completed_at = now(), queue_message_id = null, updated_at = now()
    where task_id = v_task.task_id;
    if v_task.queue_message_id is not null then
      perform pgmq.archive('sarina_sci_tasks', v_task.queue_message_id);
    end if;
    insert into sci_internal.sci_task_events(
      task_id, event_type, from_status, to_status, actor_kind, actor_id, reason_code
    ) values (
      v_task.task_id, 'task_cancelled', v_task.status, 'cancelled', 'user',
      p_owner_auth_user_id::text, 'OWNER_CANCELLED_TASK_TREE'
    );
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('task_id', p_task_id, 'cancelled_count', v_count);
end;
$function$;

create or replace function public.sci_get_task_tree(
  p_task_id uuid,
  p_owner_auth_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  with recursive tree as (
    select task_id from sci_internal.sci_tasks
    where task_id = p_task_id and owner_auth_user_id = p_owner_auth_user_id
    union all
    select child.task_id from sci_internal.sci_tasks child
    join tree parent on child.parent_task_id = parent.task_id
    where child.owner_auth_user_id = p_owner_auth_user_id
  )
  select jsonb_build_object(
    'tasks', coalesce((
      select jsonb_agg(
        (to_jsonb(t) - 'lease_token' - 'queue_message_id')
        order by t.created_at
      )
      from sci_internal.sci_tasks t join tree on tree.task_id = t.task_id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.event_id)
      from sci_internal.sci_task_events e join tree on tree.task_id = e.task_id
    ), '[]'::jsonb)
  ) into v_result;

  if v_result -> 'tasks' = '[]'::jsonb then
    raise exception 'Task not found' using errcode = 'P0002';
  end if;
  return v_result;
end;
$function$;

revoke all on function public.sci_create_task(jsonb) from public, anon, authenticated;
revoke all on function public.sci_authorize_task_dispatch(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.sci_claim_tasks(text, integer, integer) from public, anon, authenticated;
revoke all on function public.sci_heartbeat_task(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.sci_complete_task(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.sci_fail_task(uuid, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.sci_recover_expired_tasks(integer) from public, anon, authenticated;
revoke all on function public.sci_cancel_task(uuid, uuid) from public, anon, authenticated;
revoke all on function public.sci_get_task_tree(uuid, uuid) from public, anon, authenticated;

grant execute on function public.sci_create_task(jsonb) to service_role;
grant execute on function public.sci_authorize_task_dispatch(uuid, uuid, uuid) to service_role;
grant execute on function public.sci_claim_tasks(text, integer, integer) to service_role;
grant execute on function public.sci_heartbeat_task(uuid, uuid, integer) to service_role;
grant execute on function public.sci_complete_task(uuid, uuid, jsonb) to service_role;
grant execute on function public.sci_fail_task(uuid, uuid, text, boolean) to service_role;
grant execute on function public.sci_recover_expired_tasks(integer) to service_role;
grant execute on function public.sci_cancel_task(uuid, uuid) to service_role;
grant execute on function public.sci_get_task_tree(uuid, uuid) to service_role;


-- Recovery runs independently of worker availability. It only requeues expired
-- leases or marks overdue work terminal; it never executes a specialist.
do $$
begin
  if not exists (
    select 1 from cron.job where jobname = 'sarina-sci-task-recovery'
  ) then
    perform cron.schedule(
      'sarina-sci-task-recovery',
      '* * * * *',
      'select public.sci_recover_expired_tasks(50);'
    );
  end if;
end;
$$;


-- Activation is intentionally controlled by SCI_DURABLE_TASKS_ENABLED.
-- Define request_payload retention/erasure rules before enabling durable task intake.
