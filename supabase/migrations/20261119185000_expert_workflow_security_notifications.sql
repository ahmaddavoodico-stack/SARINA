-- Harden expert identity, add private credential storage and case-message notifications.
create or replace function private.guard_expert_profile_verification()
returns trigger
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
begin
  if old.user_id = current_sarina_user_id()
     and not coalesce(is_sarina_admin(), false)
     and (new.user_id is distinct from old.user_id
          or new.verification_status is distinct from old.verification_status) then
    raise exception 'Expert verification is controlled by authorized reviewers';
  end if;
  return new;
end;
$$;

drop trigger if exists expert_profile_verification_guard on public.expert_profiles;
create trigger expert_profile_verification_guard
before update on public.expert_profiles
for each row execute function private.guard_expert_profile_verification();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('expert-credentials', 'expert-credentials', false, 10485760,
        array['application/pdf','image/jpeg','image/png']::text[])
on conflict (id) do update
set public = false, file_size_limit = 10485760,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists expert_credentials_storage_owner_upload on storage.objects;
create policy expert_credentials_storage_owner_upload
on storage.objects for insert to authenticated
with check (
  bucket_id = 'expert-credentials'
  and (storage.foldername(name))[2] = current_sarina_user_id()::text
  and exists (
    select 1 from public.expert_profiles ep
    where ep.id::text = (storage.foldername(name))[1]
      and ep.user_id = current_sarina_user_id()
      and ep.verification_status <> 'suspended'
  )
);

drop policy if exists expert_credentials_storage_scoped_read on storage.objects;
create policy expert_credentials_storage_scoped_read
on storage.objects for select to authenticated
using (
  bucket_id = 'expert-credentials'
  and (
    exists (
      select 1 from public.expert_profiles ep
      where ep.id::text = (storage.foldername(name))[1]
        and ep.user_id = current_sarina_user_id()
    )
    or coalesce(public.is_sarina_admin(), false)
    or exists (
      select 1
      from public.expert_credentials ec
      join public.expert_profiles ep on ep.id = ec.expert_profile_id
      join public.organization_members om on om.user_id = current_sarina_user_id()
      where ec.expert_profile_id::text = (storage.foldername(name))[1]
        and ec.document_ref = name
        and public.organization_has_scoped_access(
          om.organization_id, 'expert_credential.review',
          ep.user_id, ep.country_id, null::uuid
        )
    )
  )
);

drop policy if exists expert_credentials_storage_owner_delete on storage.objects;
create policy expert_credentials_storage_owner_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'expert-credentials'
  and (storage.foldername(name))[2] = current_sarina_user_id()::text
  and exists (
    select 1 from public.expert_profiles ep
    where ep.id::text = (storage.foldername(name))[1]
      and ep.user_id = current_sarina_user_id()
      and ep.verification_status <> 'verified'
  )
);

create table if not exists public.expert_case_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null,
  actor_user_id uuid,
  request_id uuid not null references public.expert_requests(id) on delete cascade,
  consultation_id uuid references public.expert_consultations(id) on delete cascade,
  event_type text not null check (event_type in ('new_message','assignment_accepted','assignment_declined')),
  preview text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists expert_case_notifications_recipient_unread_idx
  on public.expert_case_notifications (recipient_user_id, created_at desc)
  where read_at is null;
alter table public.expert_case_notifications enable row level security;
revoke all on public.expert_case_notifications from anon;
grant select, update on public.expert_case_notifications to authenticated;

drop policy if exists expert_case_notifications_recipient_read on public.expert_case_notifications;
create policy expert_case_notifications_recipient_read
on public.expert_case_notifications for select to authenticated
using (recipient_user_id = current_sarina_user_id());
drop policy if exists expert_case_notifications_recipient_mark_read on public.expert_case_notifications;
create policy expert_case_notifications_recipient_mark_read
on public.expert_case_notifications for update to authenticated
using (recipient_user_id = current_sarina_user_id())
with check (recipient_user_id = current_sarina_user_id());

create or replace function private.notify_expert_case_message()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_requester uuid;
  v_expert uuid;
  v_request uuid;
  v_recipient uuid;
begin
  select er.id, er.requester_user_id, ep.user_id
    into v_request, v_requester, v_expert
  from public.expert_consultations c
  join public.expert_requests er on er.id = c.request_id
  join public.expert_request_assignments a on a.request_id = er.id
    and a.assignment_status in ('offered','accepted')
  join public.expert_profiles ep on ep.id = a.expert_profile_id
  where c.id = new.consultation_id
  order by a.offered_at desc
  limit 1;

  if v_request is null then return new; end if;
  if new.sender_user_id = v_requester then
    v_recipient := v_expert;
  else
    v_recipient := v_requester;
  end if;

  if v_recipient is not null and v_recipient <> new.sender_user_id then
    insert into public.expert_case_notifications
      (recipient_user_id, actor_user_id, request_id, consultation_id, event_type, preview)
    values
      (v_recipient, new.sender_user_id, v_request, new.consultation_id,
       'new_message', left(coalesce(new.message_text, 'پیام صوتی'), 180));
  end if;
  return new;
end;
$$;

drop trigger if exists expert_case_message_notification on public.expert_consultation_messages;
create trigger expert_case_message_notification
after insert on public.expert_consultation_messages
for each row execute function private.notify_expert_case_message();

create or replace function private.notify_expert_assignment_response()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_requester uuid;
  v_actor uuid;
begin
  if old.assignment_status = 'offered'
     and new.assignment_status in ('accepted','declined')
     and new.assignment_status is distinct from old.assignment_status then
    select er.requester_user_id, ep.user_id
      into v_requester, v_actor
    from public.expert_requests er
    join public.expert_profiles ep on ep.id = new.expert_profile_id
    where er.id = new.request_id;
    if v_requester is not null then
      insert into public.expert_case_notifications
        (recipient_user_id, actor_user_id, request_id, event_type, preview)
      values
        (v_requester, v_actor, new.request_id,
         case when new.assignment_status = 'accepted'
              then 'assignment_accepted' else 'assignment_declined' end,
         case when new.assignment_status = 'accepted'
              then 'کارشناس درخواست همکاری را پذیرفت'
              else 'کارشناس درخواست همکاری را نپذیرفت' end);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists expert_assignment_response_notification on public.expert_request_assignments;
create trigger expert_assignment_response_notification
after update of assignment_status on public.expert_request_assignments
for each row execute function private.notify_expert_assignment_response();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'expert_case_notifications'
  ) then
    alter publication supabase_realtime add table public.expert_case_notifications;
  end if;
end $$;
