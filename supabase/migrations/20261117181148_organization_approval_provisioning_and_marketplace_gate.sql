create or replace function public.approve_organization_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
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

drop trigger if exists trg_approve_organization_application on public.organization_applications;
create trigger trg_approve_organization_application
after update of status on public.organization_applications
for each row execute function public.approve_organization_application();

revoke all on function public.approve_organization_application() from public, anon, authenticated;

create or replace function private.marketplace_seller_is_verified(p_seller_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'public', 'pg_temp'
as $$
  select exists (
    select 1
    from public.marketplace_sellers s
    where s.id = p_seller_id
      and s.verification_status = 'verified'
      and (
        s.seller_type <> 'company'
        or exists (
          select 1
          from public.organizations o
          join public.organization_members om
            on om.organization_id = o.id
           and om.user_id = s.owner_user_id
           and om.membership_role = 'owner'
           and om.status = 'active'
          join public.organization_profiles op
            on op.applicant_user_id = om.user_id
           and op.status = 'verified'
          where o.id = s.organization_id
            and o.status = 'verified'
        )
      )
  );
$$;
