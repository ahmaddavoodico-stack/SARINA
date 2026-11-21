-- SARINA Agricultural Support Evidence & Farmer Utilization — Phase 2.
-- Reuses the existing private farmer-documents bucket and farm_documents metadata.
-- Organization access is granted only to a document explicitly linked to an allocation
-- the organization is authorized to read.

begin;

alter table public.farm_support_allocation_events
  add column if not exists disposition_code text;

alter table public.farm_support_allocation_events
  drop constraint if exists farm_support_allocation_events_event_type_check;

alter table public.farm_support_allocation_events
  add constraint farm_support_allocation_events_event_type_check
  check (event_type in (
    'dispatched','delivered','partially_delivered','delivery_failed',
    'rejected','cancelled','returned','farmer_acknowledged',
    'farmer_disputed','correction_note','utilization_reported'
  ));

alter table public.farm_support_allocation_events
  add constraint farm_support_allocation_events_disposition_check
  check (
    (event_type='utilization_reported' and disposition_code in (
      'used_as_intended','stored_for_later','returned',
      'damaged_or_expired','transferred_authorized','other'
    ))
    or
    (event_type<>'utilization_reported' and disposition_code is null)
  );

alter table public.farm_support_allocation_events
  add constraint farm_support_allocation_events_utilization_quantity_check
  check (
    event_type not in ('delivered','partially_delivered','utilization_reported')
    or event_quantity is not null
  );

create table if not exists public.farm_support_allocation_documents (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references public.farm_support_allocations(id) on delete restrict,
  farm_document_id uuid not null references public.farm_documents(id) on delete restrict,
  attached_by_user_id uuid not null references public.users(id) on delete restrict,
  attached_at timestamptz not null default now(),
  note text,
  unique (allocation_id,farm_document_id)
);

create index if not exists farm_support_allocation_documents_document_idx
  on public.farm_support_allocation_documents(farm_document_id);
create index if not exists farm_support_allocation_documents_allocation_idx
  on public.farm_support_allocation_documents(allocation_id,attached_at desc);

create or replace function sarina_internal.can_attach_farm_support_document(
  p_allocation_id uuid,p_farm_document_id uuid,p_actor_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_actor_user_id=public.current_sarina_user_id()
     and exists (
       select 1
         from public.farm_support_allocations a
         join public.farms f on f.id=a.farm_id
         join public.farm_documents d on d.id=p_farm_document_id
        where a.id=p_allocation_id
          and d.farm_id=a.farm_id
          and d.uploaded_by_user_id=public.current_sarina_user_id()
          and f.owner_user_id=public.current_sarina_user_id()
     );
$$;

revoke all on function sarina_internal.can_attach_farm_support_document(uuid,uuid,uuid) from public, anon;
grant execute on function sarina_internal.can_attach_farm_support_document(uuid,uuid,uuid) to authenticated;

alter table public.farm_support_allocation_documents enable row level security;

drop policy if exists farm_support_allocation_documents_admin_read
  on public.farm_support_allocation_documents;
create policy farm_support_allocation_documents_admin_read
on public.farm_support_allocation_documents
for select to authenticated
using ((select public.is_sarina_admin()));

drop policy if exists farm_support_allocation_documents_participant_read
  on public.farm_support_allocation_documents;
create policy farm_support_allocation_documents_participant_read
on public.farm_support_allocation_documents
for select to authenticated
using (sarina_internal.can_read_farm_support_allocation(allocation_id));

drop policy if exists farm_support_allocation_documents_farmer_insert
  on public.farm_support_allocation_documents;
create policy farm_support_allocation_documents_farmer_insert
on public.farm_support_allocation_documents
for insert to authenticated
with check (
  attached_by_user_id=(select public.current_sarina_user_id())
  and sarina_internal.can_attach_farm_support_document(
    allocation_id,farm_document_id,attached_by_user_id
  )
);

-- A linked evidence file is visible to an authorized organization only through
-- the allocation link. Unlinked farmer documents remain owner-only.
drop policy if exists farm_documents_support_allocation_read on public.farm_documents;
create policy farm_documents_support_allocation_read
on public.farm_documents
for select to authenticated
using (
  exists (
    select 1
      from public.farm_support_allocation_documents sad
     where sad.farm_document_id=farm_documents.id
       and sarina_internal.can_read_farm_support_allocation(sad.allocation_id)
  )
);

-- Storage objects are private. Add a narrowly-scoped read path for linked evidence.
drop policy if exists farmer_documents_read_linked_support_evidence on storage.objects;
create policy farmer_documents_read_linked_support_evidence
on storage.objects
for select to authenticated
using (
  bucket_id='farmer-documents'
  and exists (
    select 1
      from public.farm_documents fd
      join public.farm_support_allocation_documents sad
        on sad.farm_document_id=fd.id
     where fd.storage_path=storage.objects.name
       and sarina_internal.can_read_farm_support_allocation(sad.allocation_id)
  )
);

-- Keep existing owner deletion for unlinked files, but prevent deletion of evidence
-- already attached to a support allocation.
drop policy if exists farmer_documents_delete_own_farm on storage.objects;
create policy farmer_documents_delete_own_farm
on storage.objects
for delete to authenticated
using (
  bucket_id='farmer-documents'
  and exists (
    select 1 from public.farms f
    join public.users u on u.id=f.owner_user_id
    where f.id::text=(storage.foldername(name))[2]
      and u.auth_user_id=(select auth.uid())
      and (storage.foldername(name))[1]=(select auth.uid())::text
  )
  and not exists (
    select 1
      from public.farm_documents fd
      join public.farm_support_allocation_documents sad
        on sad.farm_document_id=fd.id
     where fd.storage_path=storage.objects.name
  )
);

-- Farmers may report utilization/disposition. These are self-reported events,
-- not verified proof of compliance or misconduct.
drop policy if exists farm_support_allocation_events_farmer_insert
  on public.farm_support_allocation_events;
create policy farm_support_allocation_events_farmer_insert
on public.farm_support_allocation_events
for insert to authenticated
with check (
  actor_user_id=(select public.current_sarina_user_id())
  and event_type in ('farmer_acknowledged','farmer_disputed','utilization_reported')
  and sarina_internal.is_farm_support_allocation_owner(allocation_id)
);

revoke all on public.farm_support_allocation_documents from public, anon, authenticated;
grant select,insert on public.farm_support_allocation_documents to authenticated;

comment on table public.farm_support_allocation_documents is
  'Farmer-owned private documents explicitly attached to a support allocation; authorized issuing organizations may read only linked evidence within scope.';
comment on column public.farm_support_allocation_events.disposition_code is
  'Farmer-reported support disposition for utilization_reported events; not an official compliance finding.';

commit;
