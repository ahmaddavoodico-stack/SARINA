-- Regional sync engine storage and server-only execution primitives.
-- Additive and dormant: no ownership backfill, region activation or user-data transfer.

alter table public.regional_data_sources enable row level security;
alter table public.regional_datasets enable row level security;
revoke all on public.regional_data_sources from anon, authenticated;
revoke all on public.regional_datasets from anon, authenticated;
drop policy if exists regional_data_sources_deny_client_access on public.regional_data_sources;
create policy regional_data_sources_deny_client_access on public.regional_data_sources
  for all to anon, authenticated using (false) with check (false);
drop policy if exists regional_datasets_deny_client_access on public.regional_datasets;
create policy regional_datasets_deny_client_access on public.regional_datasets
  for all to anon, authenticated using (false) with check (false);
grant all on public.regional_data_sources to service_role;
grant all on public.regional_datasets to service_role;

alter table public.regional_data_sources add column if not exists region_id uuid references public.deployment_regions(id) on delete restrict;
alter table public.regional_datasets add column if not exists region_id uuid references public.deployment_regions(id) on delete restrict;
create index if not exists regional_data_sources_region_idx on public.regional_data_sources(region_id,is_active);
create index if not exists regional_datasets_region_idx on public.regional_datasets(region_id,dataset_type,retrieved_at desc);

alter table public.regional_data_transfer_consents
  drop constraint if exists regional_data_transfer_consents_subject_type_check;
alter table public.regional_data_transfer_consents
  add constraint regional_data_transfer_consents_subject_type_check
  check (subject_type in ('user','farm','consultation','reference_data'));

create table if not exists public.regional_sync_audit_events (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.deployment_regions(id) on delete restrict,
  event_id uuid, aggregate_type text, aggregate_id uuid,
  action_code text not null, outcome_code text not null,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=8192),
  occurred_at timestamptz not null default now()
);
create index if not exists regional_sync_audit_region_time_idx
  on public.regional_sync_audit_events(region_id,occurred_at desc);

create table if not exists public.regional_sync_request_nonces (
  id uuid primary key default gen_random_uuid(),
  source_region_id uuid not null references public.deployment_regions(id) on delete restrict,
  request_nonce text not null,
  expires_at timestamptz not null,
  received_at timestamptz not null default now(),
  constraint regional_sync_nonce_length check (length(request_nonce) between 16 and 128),
  constraint regional_sync_nonce_unique unique (source_region_id,request_nonce)
);
create index if not exists regional_sync_nonce_expiry_idx on public.regional_sync_request_nonces(expires_at);

create table if not exists public.regional_sync_projections (
  target_region_id uuid not null references public.deployment_regions(id) on delete restrict,
  source_region_id uuid not null references public.deployment_regions(id) on delete restrict,
  aggregate_type text not null check (aggregate_type in ('user','farm','consultation','reference_data')),
  aggregate_id uuid not null, last_event_id uuid not null,
  last_event_version integer not null check (last_event_version>0),
  schema_version integer not null check (schema_version>0),
  projection_data jsonb not null
    check (jsonb_typeof(projection_data)='object' and octet_length(projection_data::text)<=65536),
  source_updated_at timestamptz not null default now(),
  received_at timestamptz not null default now(),
  primary key (target_region_id,source_region_id,aggregate_type,aggregate_id),
  constraint regional_projection_distinct_regions check (target_region_id<>source_region_id)
);
create index if not exists regional_sync_projections_lookup_idx
  on public.regional_sync_projections(target_region_id,aggregate_type,aggregate_id);

create table if not exists public.regional_sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  source_region_id uuid not null references public.deployment_regions(id) on delete restrict,
  target_region_id uuid not null references public.deployment_regions(id) on delete restrict,
  aggregate_type text not null, aggregate_id uuid not null,
  incoming_event_id uuid not null, incoming_event_version integer not null,
  current_event_id uuid, current_event_version integer,
  conflict_code text not null,
  resolution_status text not null default 'open' check (resolution_status in ('open','resolved','ignored')),
  resolution_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(resolution_metadata)='object' and octet_length(resolution_metadata::text)<=8192),
  created_at timestamptz not null default now(), resolved_at timestamptz,
  constraint regional_sync_conflict_distinct_regions check (source_region_id<>target_region_id),
  constraint regional_sync_conflict_incoming_unique unique (source_region_id,incoming_event_id)
);
create index if not exists regional_sync_conflicts_open_idx
  on public.regional_sync_conflicts(target_region_id,created_at) where resolution_status='open';
create unique index if not exists regional_sync_outbox_aggregate_version_uidx
  on public.regional_sync_outbox(source_region_id,aggregate_type,aggregate_id,event_version);

do $$
declare t text;
begin
  foreach t in array array['regional_sync_audit_events','regional_sync_request_nonces','regional_sync_projections','regional_sync_conflicts'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon,authenticated',t);
    execute format('grant all on public.%I to service_role',t);
    execute format('drop policy if exists %I on public.%I',t||'_deny_client_access',t);
    execute format('create policy %I on public.%I for all to anon,authenticated using(false) with check(false)',t||'_deny_client_access',t);
  end loop;
end $$;

create or replace function public.regional_enqueue_sync_event(
  p_source_region_id uuid,p_target_region_id uuid,p_consent_id uuid,
  p_aggregate_type text,p_aggregate_id uuid,p_event_type text,
  p_event_version integer,p_schema_version integer,p_idempotency_key text,
  p_data_categories jsonb,p_event_payload jsonb
) returns uuid language plpgsql security definer
set search_path=pg_catalog,public as $$
declare v_consent public.regional_data_transfer_consents%rowtype; v_event public.regional_sync_outbox%rowtype;
begin
  if p_source_region_id=p_target_region_id then raise exception 'regional_sync_same_region' using errcode='22023'; end if;
  if p_aggregate_type not in ('user','farm','consultation','reference_data') or p_event_version<1 or p_schema_version<1
    or p_idempotency_key is null or length(p_idempotency_key) not between 16 and 200
    or jsonb_typeof(p_data_categories)<>'array' or jsonb_typeof(p_event_payload)<>'object'
    or octet_length(p_event_payload::text)>65536 then
    raise exception 'regional_sync_invalid_envelope' using errcode='22023';
  end if;
  select * into v_consent from public.regional_data_transfer_consents c
  where c.id=p_consent_id and c.subject_type=p_aggregate_type and c.subject_id=p_aggregate_id
    and c.source_region_id=p_source_region_id and c.target_region_id=p_target_region_id
    and c.consent_status='granted' and (c.expires_at is null or c.expires_at>now()) for share;
  if not found or not (v_consent.permitted_categories @> p_data_categories) then
    raise exception 'regional_sync_consent_missing_or_insufficient' using errcode='42501';
  end if;
  insert into public.regional_sync_outbox(source_region_id,target_region_id,consent_id,aggregate_type,aggregate_id,
    event_type,event_version,schema_version,idempotency_key,data_categories,event_payload)
  values(p_source_region_id,p_target_region_id,p_consent_id,p_aggregate_type,p_aggregate_id,
    p_event_type,p_event_version,p_schema_version,p_idempotency_key,p_data_categories,p_event_payload)
  on conflict(idempotency_key) do nothing;
  select * into v_event from public.regional_sync_outbox where idempotency_key=p_idempotency_key for share;
  if v_event.id is null or v_event.source_region_id<>p_source_region_id or v_event.target_region_id<>p_target_region_id
    or v_event.consent_id<>p_consent_id or v_event.aggregate_type<>p_aggregate_type or v_event.aggregate_id<>p_aggregate_id
    or v_event.event_version<>p_event_version or v_event.schema_version<>p_schema_version
    or v_event.data_categories<>p_data_categories or v_event.event_payload<>p_event_payload then
    raise exception 'regional_sync_idempotency_key_reused' using errcode='23505';
  end if;
  insert into public.regional_sync_audit_events(region_id,event_id,aggregate_type,aggregate_id,action_code,outcome_code,metadata)
  values(p_source_region_id,v_event.id,p_aggregate_type,p_aggregate_id,'enqueue','queued',
    jsonb_build_object('target_region_id',p_target_region_id,'schema_version',p_schema_version));
  return v_event.id;
end $$;

create or replace function public.regional_record_sync_delivery(
  p_event_id uuid,p_success boolean,p_error_code text default null,p_retry_after_seconds integer default 0
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public as $$
declare v_row public.regional_sync_outbox%rowtype;
begin
  select * into v_row from public.regional_sync_outbox where id=p_event_id for update;
  if not found then raise exception 'regional_sync_event_not_found' using errcode='P0002'; end if;
  if v_row.delivery_status<>'processing' then
    return jsonb_build_object('event_id',p_event_id,'status',v_row.delivery_status,'changed',false);
  end if;
  if p_success then
    update public.regional_sync_outbox set delivery_status='acknowledged',sent_at=coalesce(sent_at,now()),
      acknowledged_at=now(),locked_at=null,last_error_code=null,updated_at=now() where id=p_event_id;
    insert into public.regional_sync_audit_events(region_id,event_id,aggregate_type,aggregate_id,action_code,outcome_code,metadata)
    values(v_row.source_region_id,p_event_id,v_row.aggregate_type,v_row.aggregate_id,'delivery','acknowledged',
      jsonb_build_object('attempt_count',v_row.attempt_count));
    return jsonb_build_object('event_id',p_event_id,'status','acknowledged','changed',true);
  end if;
  update public.regional_sync_outbox set
    delivery_status=case when attempt_count>=12 then 'dead_letter' else 'retry' end,
    available_at=now()+make_interval(secs=>greatest(5,least(coalesce(nullif(p_retry_after_seconds,0),
      least(3600,15*(2^least(attempt_count,8))::integer),3600))),
    locked_at=null,last_error_code=left(coalesce(p_error_code,'remote_delivery_failed'),120),updated_at=now()
  where id=p_event_id returning * into v_row;
  insert into public.regional_sync_audit_events(region_id,event_id,aggregate_type,aggregate_id,action_code,outcome_code,metadata)
  values(v_row.source_region_id,p_event_id,v_row.aggregate_type,v_row.aggregate_id,'delivery',v_row.delivery_status,
    jsonb_build_object('attempt_count',v_row.attempt_count,'error_code',v_row.last_error_code));
  return jsonb_build_object('event_id',p_event_id,'status',v_row.delivery_status,'changed',true);
end $$;
