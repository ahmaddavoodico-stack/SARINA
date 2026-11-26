-- Immutable, versioned environmental assessment snapshots per farm.
-- Client writes are append-only; specialists can read only through the existing farm expert contract.

create table if not exists public.farm_environmental_assessments (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  version integer not null,
  assessment_schema_version text not null default '1.0',
  assessment_status text not null default 'partial'
    check (assessment_status in ('partial', 'complete', 'needs_review')),
  assessed_at timestamptz not null default now(),
  valid_until timestamptz,
  source_manifest jsonb not null default '[]'::jsonb,
  evidence_payload jsonb not null default '{}'::jsonb,
  quality_summary jsonb not null default '{}'::jsonb,
  missing_domains jsonb not null default '[]'::jsonb,
  created_by_auth_user_id uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint farm_environmental_assessments_farm_version_unique unique (farm_id, version),
  constraint farm_environmental_assessments_version_positive check (version > 0),
  constraint farm_environmental_assessments_manifest_array check (jsonb_typeof(source_manifest) = 'array'),
  constraint farm_environmental_assessments_missing_array check (jsonb_typeof(missing_domains) = 'array')
);

create index if not exists idx_farm_environmental_assessments_farm_version
  on public.farm_environmental_assessments (farm_id, version desc);

alter table public.farm_environmental_assessments enable row level security;

revoke all on public.farm_environmental_assessments from anon;
revoke update, delete, truncate on public.farm_environmental_assessments from authenticated;
grant select, insert on public.farm_environmental_assessments to authenticated;

drop policy if exists "farmers read own environmental assessments" on public.farm_environmental_assessments;
create policy "farmers read own environmental assessments"
  on public.farm_environmental_assessments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.farms f
      join public.users u on u.id = f.owner_user_id
      where f.id = farm_environmental_assessments.farm_id
        and u.auth_user_id = (select auth.uid())
    )
    or public.is_current_user_active_expert_for_farm(farm_id)
  );

drop policy if exists "farmers create own environmental assessments" on public.farm_environmental_assessments;
create policy "farmers create own environmental assessments"
  on public.farm_environmental_assessments
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.farms f
      join public.users u on u.id = f.owner_user_id
      where f.id = farm_environmental_assessments.farm_id
        and u.auth_user_id = (select auth.uid())
    )
  );

create or replace function public.assign_farm_environmental_assessment_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.farm_id::text, 0));
  select coalesce(max(a.version), 0) + 1
    into new.version
    from public.farm_environmental_assessments a
    where a.farm_id = new.farm_id;
  return new;
end;
$$;

revoke all on function public.assign_farm_environmental_assessment_version() from public, anon, authenticated;

drop trigger if exists trg_assign_farm_environmental_assessment_version on public.farm_environmental_assessments;
create trigger trg_assign_farm_environmental_assessment_version
  before insert on public.farm_environmental_assessments
  for each row execute function public.assign_farm_environmental_assessment_version();

comment on table public.farm_environmental_assessments is
  'Append-only, versioned environmental assessment snapshots. Regional/model estimates must remain distinguishable from farm-level measurements.';
comment on column public.farm_environmental_assessments.evidence_payload is
  'Raw provider/context evidence for this snapshot; never treat model estimates as laboratory or on-farm measurements.';
comment on column public.farm_environmental_assessments.source_manifest is
  'Per-source provenance including provider, source type, retrieval/observation time, spatial resolution and limitations when known.';
