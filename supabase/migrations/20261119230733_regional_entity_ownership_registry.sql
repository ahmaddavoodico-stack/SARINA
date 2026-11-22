-- Inventory and classify all public tables/views for regional ownership.
-- Unknown or sensitive entities remain disabled until separately reviewed.
create table if not exists public.regional_entity_registry (
 entity_name text primary key,
 relation_kind text not null check (relation_kind in ('table','partitioned_table','view','materialized_view')),
 ownership_class text not null default 'review_required'
  check (ownership_class in ('canonical_user','canonical_farm','canonical_case','farm_child','user_child','case_child','organization_child','shared_reference','derived_view','system','review_required')),
 region_resolution text not null default 'unresolved'
  check (region_resolution in ('canonical_column','parent_farm','parent_consultation','parent_request','parent_user','parent_organization','global','unresolved')),
 data_classification text not null default 'unknown'
  check (data_classification in ('public','internal','private','restricted','unknown')),
 sync_mode text not null default 'disabled'
  check (sync_mode in ('disabled','allowlisted_projection','inherit_home_region','local_only','shared_reference')),
 ownership_paths jsonb not null default '[]'::jsonb check (jsonb_typeof(ownership_paths)='array'),
 review_status text not null default 'review_required' check (review_status in ('classified','review_required')),
 notes text,
 audited_at timestamptz not null default now()
);

insert into public.regional_entity_registry(entity_name,relation_kind,ownership_paths)
select c.relname,
 case c.relkind when 'p' then 'partitioned_table' when 'v' then 'view' when 'm' then 'materialized_view' else 'table' end,
 coalesce((
  select jsonb_agg(jsonb_build_object('column',sa.attname,'references_table',fk.confrelid::regclass::text,'references_column',da.attname) order by sa.attname)
  from pg_constraint fk
  cross join lateral unnest(fk.conkey) with ordinality src(attnum,ord)
  join pg_attribute sa on sa.attrelid=fk.conrelid and sa.attnum=src.attnum
  join lateral unnest(fk.confkey) with ordinality dst(attnum,ord) on dst.ord=src.ord
  join pg_attribute da on da.attrelid=fk.confrelid and da.attnum=dst.attnum
  where fk.contype='f' and fk.conrelid=c.oid
 ),'[]'::jsonb)
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p','v','m')
 and c.relname<>'regional_entity_registry'
on conflict(entity_name) do update set relation_kind=excluded.relation_kind,ownership_paths=excluded.ownership_paths,audited_at=now();

update public.regional_entity_registry set ownership_class='canonical_user',region_resolution='canonical_column',
 data_classification='private',sync_mode='allowlisted_projection',review_status='classified',
 notes='Home region is users.home_region_id; only strict profile projection fields may leave this region.'
where entity_name='users';
update public.regional_entity_registry set ownership_class='canonical_farm',region_resolution='canonical_column',
 data_classification='private',sync_mode='allowlisted_projection',review_status='classified',
 notes='Home region is farms.home_region_id; only strict farm summary projection fields may leave this region.'
where entity_name='farms';
update public.regional_entity_registry set ownership_class='canonical_case',region_resolution='canonical_column',
 data_classification='restricted',sync_mode='allowlisted_projection',review_status='classified',
 notes='Case region is expert_consultations.home_region_id; only status/scheduling metadata may be projected.'
where entity_name='expert_consultations';

update public.regional_entity_registry r set ownership_class='farm_child',region_resolution='parent_farm',
 data_classification='private',sync_mode='inherit_home_region',review_status='classified',
 notes='Ownership follows the referenced farm. Inheritance is routing metadata, not replication permission.'
where r.entity_name<>'farms' and exists(
 select 1 from pg_constraint fk join pg_attribute a on a.attrelid=fk.conrelid and a.attnum=any(fk.conkey)
 where fk.contype='f' and fk.conrelid=to_regclass('public.'||r.entity_name)
 and fk.confrelid='public.farms'::regclass and a.attname='farm_id');

update public.regional_entity_registry r set ownership_class='case_child',
 region_resolution=case when exists(
  select 1 from pg_constraint fk join pg_attribute a on a.attrelid=fk.conrelid and a.attnum=any(fk.conkey)
  where fk.contype='f' and fk.conrelid=to_regclass('public.'||r.entity_name)
   and fk.confrelid='public.expert_consultations'::regclass and a.attname='consultation_id')
 then 'parent_consultation' else 'parent_request' end,
 data_classification='restricted',sync_mode='local_only',review_status='classified',
 notes='Case/request child. Private case content is not replicated; only separately consented status projections are permitted.'
where r.ownership_class='review_required' and (
 exists(select 1 from pg_constraint fk join pg_attribute a on a.attrelid=fk.conrelid and a.attnum=any(fk.conkey)
  where fk.contype='f' and fk.conrelid=to_regclass('public.'||r.entity_name) and fk.confrelid='public.expert_consultations'::regclass and a.attname='consultation_id')
 or exists(select 1 from pg_constraint fk join pg_attribute a on a.attrelid=fk.conrelid and a.attnum=any(fk.conkey)
  where fk.contype='f' and fk.conrelid=to_regclass('public.'||r.entity_name) and fk.confrelid='public.expert_requests'::regclass and a.attname='request_id'));

update public.regional_entity_registry r set ownership_class='organization_child',region_resolution='parent_organization',
 data_classification='private',sync_mode='local_only',review_status='classified',
 notes='Organization-linked; local-only until organization home-region ownership is designed.'
where r.ownership_class='review_required' and exists(
 select 1 from pg_constraint fk join pg_attribute a on a.attrelid=fk.conrelid and a.attnum=any(fk.conkey)
 where fk.contype='f' and fk.conrelid=to_regclass('public.'||r.entity_name)
 and fk.confrelid='public.organizations'::regclass and a.attname='organization_id');

update public.regional_entity_registry r set ownership_class='user_child',region_resolution='parent_user',
 data_classification='private',sync_mode='local_only',review_status='classified',
 notes='User-linked; local-only until a specific field-level transfer contract is approved.'
where r.ownership_class='review_required' and exists(
 select 1 from pg_constraint fk join pg_attribute a on a.attrelid=fk.conrelid and a.attnum=any(fk.conkey)
 where fk.contype='f' and fk.conrelid=to_regclass('public.'||r.entity_name) and fk.confrelid='public.users'::regclass);

update public.regional_entity_registry set data_classification='restricted',sync_mode='local_only',
 notes=coalesce(notes,'')||' Sensitive content; excluded from general cross-region projections.'
where entity_name=any(array['ai_analysis_runs','ai_conversations','ai_messages','ai_message_feedback','ai_usage_events',
 'communication_logs','expert_audio_sessions','expert_case_assistant_cases','expert_case_handovers','expert_case_notifications',
 'expert_consultation_messages','expert_impact_records','expert_request_reports','expert_reviews','farm_documents','farm_locations',
 'location_permissions','messaging_connections','integration_connections','sarina_connect_channel_routes','service_contracts']);

update public.regional_entity_registry set ownership_class='shared_reference',region_resolution='global',
 data_classification='internal',sync_mode='shared_reference',review_status='classified',
 notes='Regional source catalogue; dataset licences and field-level contracts are required before transfer.'
where entity_name='regional_data_sources';
update public.regional_entity_registry set ownership_class='system',region_resolution='global',
 data_classification='internal',sync_mode='local_only',review_status='classified',
 notes='Regional control-plane metadata; never replicated as user business data.'
where entity_name like 'regional_sync_%' or entity_name='deployment_regions';
update public.regional_entity_registry set ownership_class='derived_view',region_resolution='unresolved',
 data_classification='internal',sync_mode='disabled',review_status='classified',
 notes='Rebuild from local authoritative data instead of replicating.'
where relation_kind in ('view','materialized_view');

alter table public.regional_entity_registry enable row level security;
revoke all on public.regional_entity_registry from anon,authenticated;
grant all on public.regional_entity_registry to service_role;
drop policy if exists regional_entity_registry_deny_client_access on public.regional_entity_registry;
create policy regional_entity_registry_deny_client_access on public.regional_entity_registry
 for all to anon,authenticated using(false) with check(false);
create index if not exists regional_entity_registry_scope_idx on public.regional_entity_registry(ownership_class,region_resolution,sync_mode);
create index if not exists regional_entity_registry_review_idx on public.regional_entity_registry(review_status,entity_name);
