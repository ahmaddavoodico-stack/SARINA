insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('organization-documents','organization-documents',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists organization_documents_insert on storage.objects;
create policy organization_documents_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'organization-documents'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1 from public.users u
    join public.user_roles ur on ur.user_id=u.id
    join public.roles r on r.id=ur.role_id
    where u.auth_user_id=(select auth.uid())
      and r.code='organization'
      and ur.scope_type='global' and ur.scope_id is null
  )
);

drop policy if exists organization_documents_read on storage.objects;
create policy organization_documents_read
on storage.objects for select to authenticated
using (
  bucket_id = 'organization-documents'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1 from public.users u
    join public.user_roles ur on ur.user_id=u.id
    join public.roles r on r.id=ur.role_id
    where u.auth_user_id=(select auth.uid())
      and r.code='organization'
      and ur.scope_type='global' and ur.scope_id is null
  )
);

drop policy if exists organization_documents_delete on storage.objects;
create policy organization_documents_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'organization-documents'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1 from public.users u
    join public.user_roles ur on ur.user_id=u.id
    join public.roles r on r.id=ur.role_id
    where u.auth_user_id=(select auth.uid())
      and r.code='organization'
      and ur.scope_type='global' and ur.scope_id is null
  )
);

create or replace function public.approve_organization_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_has_uploaded_document boolean;
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    select exists (
      select 1
      from jsonb_array_elements(coalesce(new.legal_documents,'[]'::jsonb)) d
      join storage.objects so
        on so.bucket_id = 'organization-documents'
       and so.name = d->>'storage_path'
      where nullif(d->>'storage_path','') is not null
    ) into v_has_uploaded_document;
    if not v_has_uploaded_document then
      raise exception 'Organization approval requires at least one uploaded legal document';
    end if;

    select id into v_organization_id
      from public.organizations
      where metadata->>'application_id' = new.id::text
      limit 1;

    if v_organization_id is null then
      insert into public.organizations (
        legal_name, display_name, organization_type, country_id, website_url,
        status, registration_number, city, address, contact_email, contact_phone,
        description, service_regions, specialties, creation_source, metadata
      ) values (
        new.legal_name, new.display_name, new.organization_type, new.country_id, new.website_url,
        'verified', new.registration_number, new.city, new.address, new.contact_email, new.contact_phone,
        new.description, coalesce(new.service_regions, '{}'::text[]), coalesce(new.support_areas, '{}'::text[]),
        'application_approved',
        jsonb_build_object(
          'application_id', new.id,
          'country_name', new.country_name,
          'contact_phones', new.contact_phones,
          'social_links', new.social_links,
          'office_locations', new.office_locations,
          'legal_documents', new.legal_documents,
          'latitude', new.latitude,
          'longitude', new.longitude
        )
      ) returning id into v_organization_id;
    else
      update public.organizations set status='verified', updated_at=now() where id=v_organization_id;
    end if;

    insert into public.organization_members (
      organization_id, user_id, membership_role, status, joined_at
    ) values (
      v_organization_id, new.applicant_user_id, 'owner', 'active', now()
    )
    on conflict (organization_id, user_id) do update
      set membership_role = 'owner', status = 'active', joined_at = coalesce(public.organization_members.joined_at, now());

    update public.organization_profiles
      set status = 'verified', reviewed_at = now(), updated_at = now()
      where applicant_user_id = new.applicant_user_id;
  end if;
  return new;
end;
$$;
