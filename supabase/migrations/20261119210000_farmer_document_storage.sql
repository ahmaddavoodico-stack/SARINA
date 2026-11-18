-- Farmer-owned document storage and metadata. Independent from AI provider APIs.
create table if not exists public.farm_documents (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  uploaded_by_user_id uuid not null references public.users(id) on delete cascade,
  document_type text not null default 'general',
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  created_at timestamptz not null default now()
);

alter table public.farm_documents enable row level security;

drop policy if exists farm_documents_owner_select on public.farm_documents;
create policy farm_documents_owner_select on public.farm_documents
for select to authenticated
using (exists (
  select 1 from public.farms f
  join public.users u on u.id = f.owner_user_id
  where f.id = farm_documents.farm_id and u.auth_user_id = (select auth.uid())
));

drop policy if exists farm_documents_owner_insert on public.farm_documents;
create policy farm_documents_owner_insert on public.farm_documents
for insert to authenticated
with check (
  uploaded_by_user_id = (select u.id from public.users u where u.auth_user_id = (select auth.uid()))
  and exists (
    select 1 from public.farms f
    join public.users u on u.id = f.owner_user_id
    where f.id = farm_documents.farm_id and u.auth_user_id = (select auth.uid())
  )
);

drop policy if exists farm_documents_owner_delete on public.farm_documents;
create policy farm_documents_owner_delete on public.farm_documents
for delete to authenticated
using (exists (
  select 1 from public.farms f
  join public.users u on u.id = f.owner_user_id
  where f.id = farm_documents.farm_id and u.auth_user_id = (select auth.uid())
));

grant select, insert, delete on public.farm_documents to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('farmer-documents', 'farmer-documents', false, 10485760,
  array['application/pdf','image/jpeg','image/png']::text[])
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists farmer_documents_upload_own_farm on storage.objects;
create policy farmer_documents_upload_own_farm on storage.objects
for insert to authenticated
with check (
  bucket_id = 'farmer-documents'
  and exists (
    select 1 from public.farms f
    join public.users u on u.id = f.owner_user_id
    where f.id::text = (storage.foldername(name))[2]
      and u.auth_user_id = (select auth.uid())
      and (storage.foldername(name))[1] = (select auth.uid())::text
  )
);

drop policy if exists farmer_documents_read_own_farm on storage.objects;
create policy farmer_documents_read_own_farm on storage.objects
for select to authenticated
using (
  bucket_id = 'farmer-documents'
  and exists (
    select 1 from public.farms f
    join public.users u on u.id = f.owner_user_id
    where f.id::text = (storage.foldername(name))[2]
      and u.auth_user_id = (select auth.uid())
      and (storage.foldername(name))[1] = (select auth.uid())::text
  )
);

drop policy if exists farmer_documents_delete_own_farm on storage.objects;
create policy farmer_documents_delete_own_farm on storage.objects
for delete to authenticated
using (
  bucket_id = 'farmer-documents'
  and exists (
    select 1 from public.farms f
    join public.users u on u.id = f.owner_user_id
    where f.id::text = (storage.foldername(name))[2]
      and u.auth_user_id = (select auth.uid())
      and (storage.foldername(name))[1] = (select auth.uid())::text
  )
);
