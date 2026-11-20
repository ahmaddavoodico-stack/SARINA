-- Worker hardening: do not cancel valid events merely because a peer region is not active yet.
-- Consent revocation/expiry cancels; planned/paused regions hold queued events for later activation.

create or replace function public.regional_claim_sync_outbox(
  p_limit integer default 25,p_lease_seconds integer default 90
) returns setof public.regional_sync_outbox language plpgsql security definer
set search_path=pg_catalog,public as $$
begin
  update public.regional_sync_outbox o set delivery_status='cancelled',locked_at=null,
    last_error_code='consent_no_longer_valid',updated_at=now()
  where o.delivery_status in ('queued','retry') and not exists (
    select 1 from public.regional_data_transfer_consents c
    where c.id=o.consent_id and c.consent_status='granted'
      and (c.expires_at is null or c.expires_at>now())
      and c.source_region_id=o.source_region_id and c.target_region_id=o.target_region_id
      and c.subject_type=o.aggregate_type and c.subject_id=o.aggregate_id
      and c.permitted_categories @> o.data_categories
  );
  return query
  with picked as (
    select o.id from public.regional_sync_outbox o
    join public.deployment_regions sr on sr.id=o.source_region_id and sr.region_status='active'
    join public.deployment_regions tr on tr.id=o.target_region_id and tr.region_status='active'
    join public.regional_data_transfer_consents c on c.id=o.consent_id
    where ((o.delivery_status in ('queued','retry') and o.available_at<=now())
      or (o.delivery_status='processing' and o.locked_at<now()-make_interval(secs=>greatest(15,least(p_lease_seconds,900)))))
      and c.consent_status='granted' and (c.expires_at is null or c.expires_at>now())
      and c.source_region_id=o.source_region_id and c.target_region_id=o.target_region_id
      and c.subject_type=o.aggregate_type and c.subject_id=o.aggregate_id
      and c.permitted_categories @> o.data_categories
    order by o.available_at,o.created_at for update of o skip locked limit greatest(1,least(p_limit,100))
  )
  update public.regional_sync_outbox o set delivery_status='processing',attempt_count=o.attempt_count+1,
    locked_at=now(),updated_at=now() from picked where o.id=picked.id returning o.*;
end $$;

create or replace function public.regional_accept_sync_event(
  p_source_region_id uuid,p_target_region_id uuid,p_source_event_id uuid,p_request_nonce text,
  p_consent_id uuid,p_aggregate_type text,p_aggregate_id uuid,p_event_type text,
  p_event_version integer,p_schema_version integer,p_payload_sha256 text,p_data_categories jsonb,
  p_event_payload jsonb,p_source_updated_at timestamptz default now()
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public as $$
declare
  v_consent public.regional_data_transfer_consents%rowtype;
  v_existing public.regional_sync_projections%rowtype;
  v_inbox_id uuid;
  v_nonce_id uuid;
begin
  if p_source_region_id=p_target_region_id or p_aggregate_type not in ('user','farm','consultation','reference_data')
    or p_event_version<1 or p_schema_version<1 or p_payload_sha256 !~ '^[a-f0-9]{64}$'
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
  if not exists(select 1 from public.deployment_regions where id=p_target_region_id and region_status='active') then
    raise exception 'regional_sync_target_not_active' using errcode='55000';
  end if;
  insert into public.regional_sync_request_nonces(source_region_id,request_nonce,expires_at)
  values(p_source_region_id,p_request_nonce,now()+interval '10 minutes')
  on conflict(source_region_id,request_nonce) do nothing returning id into v_nonce_id;
  if v_nonce_id is null then return jsonb_build_object('status','replay_rejected'); end if;
  select id into v_inbox_id from public.regional_sync_inbox
    where source_region_id=p_source_region_id and source_event_id=p_source_event_id;
  if v_inbox_id is not null then return jsonb_build_object('status','duplicate','inbox_id',v_inbox_id); end if;

  perform pg_advisory_xact_lock(hashtextextended(p_target_region_id::text||':'||p_source_region_id::text||':'||
    p_aggregate_type||':'||p_aggregate_id::text,0));
  select * into v_existing from public.regional_sync_projections
  where target_region_id=p_target_region_id and source_region_id=p_source_region_id
    and aggregate_type=p_aggregate_type and aggregate_id=p_aggregate_id for update;

  if found and v_existing.last_event_version>=p_event_version then
    insert into public.regional_sync_inbox(source_region_id,target_region_id,source_event_id,consent_id,
      aggregate_type,aggregate_id,event_type,event_version,schema_version,payload_sha256,event_payload,
      processing_status,processed_at,error_code)
    values(p_source_region_id,p_target_region_id,p_source_event_id,p_consent_id,p_aggregate_type,p_aggregate_id,
      p_event_type,p_event_version,p_schema_version,p_payload_sha256,p_event_payload,'conflict',now(),'stale_or_same_version')
    returning id into v_inbox_id;
    insert into public.regional_sync_conflicts(source_region_id,target_region_id,aggregate_type,aggregate_id,
      incoming_event_id,incoming_event_version,current_event_id,current_event_version,conflict_code)
    values(p_source_region_id,p_target_region_id,p_aggregate_type,p_aggregate_id,p_source_event_id,p_event_version,
      v_existing.last_event_id,v_existing.last_event_version,'stale_or_same_version')
    on conflict(source_region_id,incoming_event_id) do nothing;
    insert into public.regional_sync_audit_events(region_id,event_id,aggregate_type,aggregate_id,action_code,outcome_code,metadata)
    values(p_target_region_id,p_source_event_id,p_aggregate_type,p_aggregate_id,'receive','conflict',
      jsonb_build_object('incoming_version',p_event_version,'current_version',v_existing.last_event_version));
    return jsonb_build_object('status','conflict','inbox_id',v_inbox_id);
  end if;

  insert into public.regional_sync_inbox(source_region_id,target_region_id,source_event_id,consent_id,
    aggregate_type,aggregate_id,event_type,event_version,schema_version,payload_sha256,event_payload,processing_status,processed_at)
  values(p_source_region_id,p_target_region_id,p_source_event_id,p_consent_id,p_aggregate_type,p_aggregate_id,
    p_event_type,p_event_version,p_schema_version,p_payload_sha256,p_event_payload,'applied',now())
  returning id into v_inbox_id;
  insert into public.regional_sync_projections(target_region_id,source_region_id,aggregate_type,aggregate_id,
    last_event_id,last_event_version,schema_version,projection_data,source_updated_at,received_at)
  values(p_target_region_id,p_source_region_id,p_aggregate_type,p_aggregate_id,p_source_event_id,
    p_event_version,p_schema_version,p_event_payload,coalesce(p_source_updated_at,now()),now())
  on conflict(target_region_id,source_region_id,aggregate_type,aggregate_id)
  do update set last_event_id=excluded.last_event_id,last_event_version=excluded.last_event_version,
    schema_version=excluded.schema_version,projection_data=excluded.projection_data,
    source_updated_at=excluded.source_updated_at,received_at=now()
  where public.regional_sync_projections.last_event_version<excluded.last_event_version;
  insert into public.regional_sync_audit_events(region_id,event_id,aggregate_type,aggregate_id,action_code,outcome_code,metadata)
  values(p_target_region_id,p_source_event_id,p_aggregate_type,p_aggregate_id,'receive','applied',
    jsonb_build_object('event_version',p_event_version,'schema_version',p_schema_version));
  return jsonb_build_object('status','applied','inbox_id',v_inbox_id);
end $$;

revoke all on function public.regional_claim_sync_outbox(integer,integer) from public,anon,authenticated;
revoke all on function public.regional_accept_sync_event(uuid,uuid,uuid,text,uuid,text,uuid,text,integer,integer,text,jsonb,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.regional_claim_sync_outbox(integer,integer) to service_role;
grant execute on function public.regional_accept_sync_event(uuid,uuid,uuid,text,uuid,text,uuid,text,integer,integer,text,jsonb,jsonb,timestamptz) to service_role;

-- Keep all privileged RPCs unavailable to browser roles after replaying this migration set.
revoke all on function public.regional_enqueue_sync_event(uuid,uuid,uuid,text,uuid,text,integer,integer,text,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.regional_record_sync_delivery(uuid,boolean,text,integer) from public,anon,authenticated;
grant execute on function public.regional_enqueue_sync_event(uuid,uuid,uuid,text,uuid,text,integer,integer,text,jsonb,jsonb) to service_role;
grant execute on function public.regional_record_sync_delivery(uuid,boolean,text,integer) to service_role;
