-- SARINA Agricultural Support Registry & Allocation Ledger — Phase 1.
-- Documentation-first implementation: no program seeds, no assumed legal terms.
-- Client access is organization-scoped and farm-owner scoped; all lifecycle events are append-only.

begin;

create table if not exists public.agricultural_support_programs (
  id uuid primary key default gen_random_uuid(),
  issuing_organization_id uuid not null references public.organizations(id) on delete restrict,
  program_code text not null,
  jurisdiction_country_id uuid references public.countries(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft','active','paused','closed')),
  created_by_user_id uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (issuing_organization_id, program_code),
  check (length(btrim(program_code)) between 2 and 80)
);

create table if not exists public.agricultural_support_program_versions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.agricultural_support_programs(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  program_name_fa text not null,
  program_name_en text,
  public_description text,
  support_type text not null
    check (support_type in ('cash','seed','fertilizer','machinery','irrigation_service','insurance','credit','training','other')),
  valid_from date not null,
  valid_to date,
  eligible_crop_codes text[] not null default '{}',
  eligible_geographic_codes text[] not null default '{}',
  eligibility_rules jsonb not null default '{}'::jsonb
    check (jsonb_typeof(eligibility_rules) = 'object'),
  terms jsonb not null default '{}'::jsonb
    check (jsonb_typeof(terms) = 'object'),
  conditions jsonb not null default '{}'::jsonb
    check (jsonb_typeof(conditions) = 'object'),
  evidence_requirements jsonb not null default '{}'::jsonb
    check (jsonb_typeof(evidence_requirements) = 'object'),
  allowed_dispositions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(allowed_dispositions) = 'array'),
  legal_basis text,
  source_reference text,
  source_url text,
  source_verified_at timestamptz,
  verified_by_user_id uuid references public.users(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft','published')),
  published_at timestamptz,
  published_by_user_id uuid references public.users(id) on delete restrict,
  created_by_user_id uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, version_number),
  check (valid_to is null or valid_to >= valid_from),
  check (
    status <> 'published'
    or (
      nullif(btrim(legal_basis), '') is not null
      and nullif(btrim(source_reference), '') is not null
      and source_verified_at is not null
      and verified_by_user_id is not null
      and published_at is not null
      and published_by_user_id is not null
    )
  )
);

create index if not exists agricultural_support_programs_issuer_status_idx
  on public.agricultural_support_programs(issuing_organization_id,status);
create index if not exists agricultural_support_program_versions_program_status_idx
  on public.agricultural_support_program_versions(program_id,status,version_number desc);

create table if not exists public.farm_support_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  program_version_id uuid not null references public.agricultural_support_program_versions(id) on delete restrict,
  farm_id uuid not null references public.farms(id) on delete restrict,
  field_id uuid references public.farm_fields(id) on delete restrict,
  crop_cycle_id uuid references public.crop_cycles(id) on delete restrict,
  support_item_code text,
  support_item_label text not null,
  support_type text not null
    check (support_type in ('cash','seed','fertilizer','machinery','irrigation_service','insurance','credit','training','other')),
  approved_quantity numeric(20,6) not null check (approved_quantity > 0),
  unit_code text not null,
  declared_value numeric(20,2) check (declared_value is null or declared_value >= 0),
  currency_code char(3),
  official_reference text,
  approved_at timestamptz not null default now(),
  approved_by_user_id uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check ((declared_value is null and currency_code is null) or (declared_value is not null and currency_code ~ '^[A-Z]{3}$')),
  check (length(btrim(support_item_label)) between 1 and 180),
  check (length(btrim(unit_code)) between 1 and 32)
);

create index if not exists farm_support_allocations_farm_date_idx
  on public.farm_support_allocations(farm_id,approved_at desc);
create index if not exists farm_support_allocations_org_date_idx
  on public.farm_support_allocations(organization_id,approved_at desc);
create index if not exists farm_support_allocations_crop_cycle_idx
  on public.farm_support_allocations(crop_cycle_id) where crop_cycle_id is not null;

create table if not exists public.farm_support_allocation_events (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references public.farm_support_allocations(id) on delete restrict,
  event_type text not null
    check (event_type in (
      'dispatched','delivered','partially_delivered','delivery_failed',
      'rejected','cancelled','returned','farmer_acknowledged',
      'farmer_disputed','correction_note'
    )),
  event_quantity numeric(20,6) check (event_quantity is null or event_quantity > 0),
  unit_code text,
  event_reference text,
  note text,
  evidence_refs jsonb not null default '[]'::jsonb
    check (jsonb_typeof(evidence_refs) = 'array'),
  actor_user_id uuid not null references public.users(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check ((event_quantity is null and unit_code is null) or (event_quantity is not null and nullif(btrim(unit_code),'') is not null)),
  check (event_type not in ('delivered','partially_delivered') or event_quantity is not null)
);

create index if not exists farm_support_allocation_events_timeline_idx
  on public.farm_support_allocation_events(allocation_id,occurred_at,id);

-- Trigger-only validators. Fixed search_path and fully-qualified references are
-- intentional; client roles cannot execute these functions directly.
create or replace function public.validate_agricultural_support_program_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_issuer_status text;
begin
  if tg_op = 'DELETE' and old.status = 'published' then
    raise exception 'Published support program versions are immutable; create a new version.';
  end if;

  if tg_op = 'UPDATE' and old.status = 'published' then
    raise exception 'Published support program versions are immutable; create a new version.';
  end if;

  if new.status = 'published' then
    select o.status::text
      into v_issuer_status
      from public.agricultural_support_programs p
      join public.organizations o on o.id = p.issuing_organization_id
     where p.id = new.program_id;

    if v_issuer_status is distinct from 'verified' then
      raise exception 'Only a verified issuing organization can publish a support program.';
    end if;

    if new.published_by_user_id is distinct from public.current_sarina_user_id()
       or new.verified_by_user_id is distinct from public.current_sarina_user_id() then
      raise exception 'The publishing and verification actor must match the authenticated SARINA user.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.validate_farm_support_allocation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_field_farm_id uuid;
  v_cycle_farm_id uuid;
  v_program_issuer_id uuid;
  v_program_status text;
  v_version_status text;
begin
  if tg_op <> 'INSERT' then
    raise exception 'Support allocations are append-only; record corrections as events.';
  end if;

  if new.approved_by_user_id is distinct from public.current_sarina_user_id() then
    raise exception 'The allocation approver must match the authenticated SARINA user.';
  end if;

  if new.field_id is not null then
    select ff.farm_id into v_field_farm_id
      from public.farm_fields ff
     where ff.id = new.field_id;
    if v_field_farm_id is distinct from new.farm_id then
      raise exception 'The selected field must belong to the selected farm.';
    end if;
  end if;

  if new.crop_cycle_id is not null then
    select cc.farm_id into v_cycle_farm_id
      from public.crop_cycles cc
     where cc.id = new.crop_cycle_id;
    if v_cycle_farm_id is distinct from new.farm_id then
      raise exception 'The selected crop cycle must belong to the selected farm.';
    end if;
  end if;

  select p.issuing_organization_id, p.status, pv.status
    into v_program_issuer_id, v_program_status, v_version_status
    from public.agricultural_support_program_versions pv
    join public.agricultural_support_programs p on p.id = pv.program_id
   where pv.id = new.program_version_id;

  if v_program_issuer_id is distinct from new.organization_id
     or v_program_status is distinct from 'active'
     or v_version_status is distinct from 'published' then
    raise exception 'Allocation must reference a published active program version issued by the allocating organization.';
  end if;

  return new;
end;
$$;

create or replace function public.validate_farm_support_allocation_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'Support allocation events are append-only.';
  end if;

  if new.actor_user_id is distinct from public.current_sarina_user_id() then
    raise exception 'The event actor must match the authenticated SARINA user.';
  end if;

  return new;
end;
$$;

drop trigger if exists agricultural_support_program_version_guard
  on public.agricultural_support_program_versions;
create trigger agricultural_support_program_version_guard
before insert or update or delete on public.agricultural_support_program_versions
for each row execute function public.validate_agricultural_support_program_version();

drop trigger if exists farm_support_allocation_guard
  on public.farm_support_allocations;
create trigger farm_support_allocation_guard
before insert or update or delete on public.farm_support_allocations
for each row execute function public.validate_farm_support_allocation();

drop trigger if exists farm_support_allocation_event_guard
  on public.farm_support_allocation_events;
create trigger farm_support_allocation_event_guard
before insert or update or delete on public.farm_support_allocation_events
for each row execute function public.validate_farm_support_allocation_event();

alter table public.agricultural_support_programs enable row level security;
alter table public.agricultural_support_program_versions enable row level security;
alter table public.farm_support_allocations enable row level security;
alter table public.farm_support_allocation_events enable row level security;

drop policy if exists agricultural_support_programs_admin_manage
  on public.agricultural_support_programs;
create policy agricultural_support_programs_admin_manage
on public.agricultural_support_programs
for all to authenticated
using ((select public.is_sarina_admin()))
with check ((select public.is_sarina_admin()));

drop policy if exists agricultural_support_programs_published_read
  on public.agricultural_support_programs;
create policy agricultural_support_programs_published_read
on public.agricultural_support_programs
for select to authenticated
using (
  status = 'active'
  and exists (
    select 1 from public.agricultural_support_program_versions pv
    where pv.program_id = agricultural_support_programs.id
      and pv.status = 'published'
  )
);

drop policy if exists agricultural_support_program_versions_admin_manage
  on public.agricultural_support_program_versions;
create policy agricultural_support_program_versions_admin_manage
on public.agricultural_support_program_versions
for all to authenticated
using ((select public.is_sarina_admin()))
with check ((select public.is_sarina_admin()));

drop policy if exists agricultural_support_program_versions_published_read
  on public.agricultural_support_program_versions;
create policy agricultural_support_program_versions_published_read
on public.agricultural_support_program_versions
for select to authenticated
using (
  status = 'published'
  and exists (
    select 1 from public.agricultural_support_programs p
    where p.id = agricultural_support_program_versions.program_id
      and p.status = 'active'
  )
);

drop policy if exists farm_support_allocations_admin_read
  on public.farm_support_allocations;
create policy farm_support_allocations_admin_read
on public.farm_support_allocations
for select to authenticated
using ((select public.is_sarina_admin()));

drop policy if exists farm_support_allocations_farmer_read
  on public.farm_support_allocations;
create policy farm_support_allocations_farmer_read
on public.farm_support_allocations
for select to authenticated
using (
  exists (
    select 1 from public.farms f
    where f.id = farm_support_allocations.farm_id
      and f.owner_user_id = (select public.current_sarina_user_id())
  )
);

drop policy if exists farm_support_allocations_organization_read
  on public.farm_support_allocations;
create policy farm_support_allocations_organization_read
on public.farm_support_allocations
for select to authenticated
using (
  exists (
    select 1
      from public.farms f
      join public.organizations o on o.id = farm_support_allocations.organization_id
     where f.id = farm_support_allocations.farm_id
       and o.status = 'verified'
       and (
         public.organization_has_scoped_access(
           farm_support_allocations.organization_id,
           'support.allocations.read',
           f.owner_user_id,
           f.country_id,
           f.id
         )
         or public.organization_has_scoped_access(
           farm_support_allocations.organization_id,
           'support.allocations.write',
           f.owner_user_id,
           f.country_id,
           f.id
         )
       )
  )
);

drop policy if exists farm_support_allocations_organization_insert
  on public.farm_support_allocations;
create policy farm_support_allocations_organization_insert
on public.farm_support_allocations
for insert to authenticated
with check (
  approved_by_user_id = (select public.current_sarina_user_id())
  and exists (
    select 1
      from public.farms f
      join public.organizations o on o.id = farm_support_allocations.organization_id
      join public.agricultural_support_program_versions pv
        on pv.id = farm_support_allocations.program_version_id
      join public.agricultural_support_programs p on p.id = pv.program_id
     where f.id = farm_support_allocations.farm_id
       and o.status = 'verified'
       and p.issuing_organization_id = o.id
       and p.status = 'active'
       and pv.status = 'published'
       and public.organization_has_scoped_access(
         o.id,
         'support.allocations.write',
         f.owner_user_id,
         f.country_id,
         f.id
       )
  )
);

drop policy if exists farm_support_allocation_events_admin_read
  on public.farm_support_allocation_events;
create policy farm_support_allocation_events_admin_read
on public.farm_support_allocation_events
for select to authenticated
using ((select public.is_sarina_admin()));

drop policy if exists farm_support_allocation_events_participant_read
  on public.farm_support_allocation_events;
create policy farm_support_allocation_events_participant_read
on public.farm_support_allocation_events
for select to authenticated
using (
  exists (
    select 1
      from public.farm_support_allocations a
      join public.farms f on f.id = a.farm_id
     where a.id = farm_support_allocation_events.allocation_id
       and (
         f.owner_user_id = (select public.current_sarina_user_id())
         or exists (
           select 1 from public.organizations o
            where o.id = a.organization_id
              and o.status = 'verified'
              and (
                public.organization_has_scoped_access(
                  a.organization_id,'support.allocations.read',
                  f.owner_user_id,f.country_id,f.id
                )
                or public.organization_has_scoped_access(
                  a.organization_id,'support.allocations.write',
                  f.owner_user_id,f.country_id,f.id
                )
              )
         )
       )
  )
);

drop policy if exists farm_support_allocation_events_organization_insert
  on public.farm_support_allocation_events;
create policy farm_support_allocation_events_organization_insert
on public.farm_support_allocation_events
for insert to authenticated
with check (
  actor_user_id = (select public.current_sarina_user_id())
  and event_type in (
    'dispatched','delivered','partially_delivered','delivery_failed',
    'rejected','cancelled','returned','correction_note'
  )
  and exists (
    select 1
      from public.farm_support_allocations a
      join public.farms f on f.id = a.farm_id
      join public.organizations o on o.id = a.organization_id
     where a.id = farm_support_allocation_events.allocation_id
       and o.status = 'verified'
       and public.organization_has_scoped_access(
         a.organization_id,'support.allocations.write',
         f.owner_user_id,f.country_id,f.id
       )
  )
);

drop policy if exists farm_support_allocation_events_farmer_insert
  on public.farm_support_allocation_events;
create policy farm_support_allocation_events_farmer_insert
on public.farm_support_allocation_events
for insert to authenticated
with check (
  actor_user_id = (select public.current_sarina_user_id())
  and event_type in ('farmer_acknowledged','farmer_disputed')
  and exists (
    select 1
      from public.farm_support_allocations a
      join public.farms f on f.id = a.farm_id
     where a.id = farm_support_allocation_events.allocation_id
       and f.owner_user_id = (select public.current_sarina_user_id())
  )
);

-- Explicit least-privilege grants. No anonymous access and no client UPDATE/DELETE
-- on allocations or their event history.
revoke all on public.agricultural_support_programs from public, anon, authenticated;
revoke all on public.agricultural_support_program_versions from public, anon, authenticated;
revoke all on public.farm_support_allocations from public, anon, authenticated;
revoke all on public.farm_support_allocation_events from public, anon, authenticated;

grant select, insert, update, delete
  on public.agricultural_support_programs to authenticated;
grant select, insert, update, delete
  on public.agricultural_support_program_versions to authenticated;
grant select, insert
  on public.farm_support_allocations to authenticated;
grant select, insert
  on public.farm_support_allocation_events to authenticated;

revoke all on function public.validate_agricultural_support_program_version() from public, anon, authenticated;
revoke all on function public.validate_farm_support_allocation() from public, anon, authenticated;
revoke all on function public.validate_farm_support_allocation_event() from public, anon, authenticated;

comment on table public.agricultural_support_programs is
  'Authority-verified support program registry. Program terms are maintained in immutable published versions.';
comment on table public.agricultural_support_program_versions is
  'Versioned official support terms. Publishing requires a verified issuer, source reference, legal basis and named verifier.';
comment on table public.farm_support_allocations is
  'Append-only approved support allocations linked to a farm and optional field/crop cycle. Delivery is recorded as separate events.';
comment on table public.farm_support_allocation_events is
  'Append-only support allocation lifecycle and farmer acknowledgement/dispute events. Events are not legal findings.';

commit;
