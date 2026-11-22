create table if not exists public.expert_public_identifiers (
  id uuid primary key default gen_random_uuid(),
  expert_profile_id uuid not null unique references public.expert_profiles(id) on delete cascade,
  public_code text not null unique,
  status text not null default 'active' check (status in ('active','retired')),
  issued_at timestamptz not null default now(),
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  constraint expert_public_identifiers_code_format check (public_code ~ '^EXP-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$')
);
alter table public.expert_public_identifiers enable row level security;
revoke all on public.expert_public_identifiers from public, anon, authenticated;
grant select on public.expert_public_identifiers to authenticated;
create policy expert_public_identifiers_owner_read on public.expert_public_identifiers
for select to authenticated using (
  exists (select 1 from public.expert_profiles ep
    where ep.id=expert_profile_id and ep.user_id=public.current_sarina_user_id())
);

create table if not exists public.expert_authority_consents (
  id uuid primary key default gen_random_uuid(),
  expert_profile_id uuid not null references public.expert_profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  consent_scopes text[] not null default array['institutional_messaging']::text[],
  purpose_code text not null default 'jihad_official_communication',
  consent_version text not null default '2026-11-22-v1',
  status text not null default 'active' check (status in ('active','revoked','expired')),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint expert_authority_consent_scope_check check ('institutional_messaging'=any(consent_scopes))
);
create index if not exists expert_authority_consents_lookup_idx
on public.expert_authority_consents(expert_profile_id,organization_id,status,expires_at);
alter table public.expert_authority_consents enable row level security;
revoke all on public.expert_authority_consents from public,anon,authenticated;
grant select,insert,update on public.expert_authority_consents to authenticated;
create policy expert_authority_consents_owner_read on public.expert_authority_consents
for select to authenticated using (
 exists(select 1 from public.expert_profiles ep where ep.id=expert_profile_id and ep.user_id=public.current_sarina_user_id())
);
create policy expert_authority_consents_owner_grant on public.expert_authority_consents
for insert to authenticated with check (
 status='active' and revoked_at is null
 and consent_scopes @> array['institutional_messaging']::text[]
 and exists(select 1 from public.expert_profiles ep where ep.id=expert_profile_id
   and ep.user_id=public.current_sarina_user_id() and ep.verification_status='verified')
);
create policy expert_authority_consents_owner_revoke on public.expert_authority_consents
for update to authenticated
using (exists(select 1 from public.expert_profiles ep where ep.id=expert_profile_id and ep.user_id=public.current_sarina_user_id()))
with check (exists(select 1 from public.expert_profiles ep where ep.id=expert_profile_id and ep.user_id=public.current_sarina_user_id())
 and status='revoked' and revoked_at is not null);

create table if not exists public.institutional_message_threads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  created_by_user_id uuid not null references public.users(id) on delete restrict,
  recipient_user_id uuid not null references public.users(id) on delete restrict,
  recipient_kind text not null check (recipient_kind in ('farmer','expert')),
  recipient_code text not null,
  recipient_country_id uuid references public.countries(id) on delete set null,
  subject text not null check (length(trim(subject)) between 1 and 180),
  status text not null default 'active' check (status in ('active','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,recipient_user_id)
);
create index if not exists institutional_message_threads_recipient_idx
on public.institutional_message_threads(recipient_user_id,updated_at desc);
create index if not exists institutional_message_threads_org_idx
on public.institutional_message_threads(organization_id,updated_at desc);
alter table public.institutional_message_threads enable row level security;
revoke all on public.institutional_message_threads from public,anon,authenticated;
grant select on public.institutional_message_threads to authenticated;

create table if not exists public.institutional_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.institutional_message_threads(id) on delete cascade,
  sender_user_id uuid not null references public.users(id) on delete restrict,
  message_text text not null check (length(trim(message_text)) between 1 and 5000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists institutional_messages_thread_created_idx
on public.institutional_messages(thread_id,created_at desc);
alter table public.institutional_messages enable row level security;
revoke all on public.institutional_messages from public,anon,authenticated;
grant select on public.institutional_messages to authenticated;

create or replace function public.ensure_my_expert_public_identifier()
returns text language plpgsql security definer set search_path=''
as $function$
declare v_user_id uuid; v_profile_id uuid; v_code text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  v_user_id:=public.current_sarina_user_id();
  select ep.id into v_profile_id from public.expert_profiles ep join public.users u on u.id=ep.user_id
    where ep.user_id=v_user_id and ep.verification_status='verified' and u.account_status='active';
  if v_profile_id is null then raise exception 'Verified active specialist profile required'; end if;
  select public_code into v_code from public.expert_public_identifiers where expert_profile_id=v_profile_id and status='active';
  if v_code is not null then return v_code; end if;
  loop
    v_code:='EXP-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,4))||'-'||
      upper(substr(replace(gen_random_uuid()::text,'-',''),1,4))||'-'||
      upper(substr(replace(gen_random_uuid()::text,'-',''),1,4))||'-'||
      upper(substr(replace(gen_random_uuid()::text,'-',''),1,4));
    begin insert into public.expert_public_identifiers(expert_profile_id,public_code) values(v_profile_id,v_code); exit;
    exception when unique_violation then v_code:=null; end;
  end loop;
  return v_code;
end
$function$;
revoke all on function public.ensure_my_expert_public_identifier() from public,anon;
grant execute on function public.ensure_my_expert_public_identifier() to authenticated;

create or replace function public.resolve_institutional_message_recipient(p_organization_id uuid,p_public_code text)
returns table(recipient_user_id uuid,recipient_kind text,public_code text,display_name text,country_id uuid,consent_expires_at timestamptz)
language plpgsql security definer set search_path=''
as $function$
declare v_code text; v_user uuid; v_kind text; v_name text; v_country uuid; v_expiry timestamptz;
begin
  if (select auth.uid()) is null or public.current_sarina_user_id() is null then return; end if;
  if p_organization_id is null or not exists(select 1 from public.organizations o where o.id=p_organization_id
    and o.status='verified' and o.organization_type in ('government','regulator','support_agency','public_institution')) then return; end if;
  v_code:=upper(trim(coalesce(p_public_code,'')));
  if v_code ~ '^SRN-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$' then
    select i.user_id,u.full_name,u.country_id,c.expires_at into v_user,v_name,v_country,v_expiry
    from public.farmer_public_identifiers i join public.users u on u.id=i.user_id and u.account_status='active'
    join public.farmer_authority_consents c on c.user_id=i.user_id and c.organization_id=p_organization_id
    where i.public_code=v_code and i.status='active' and c.status='active'
      and (c.expires_at is null or c.expires_at>now())
      and c.consent_scopes @> array['identity_summary','institutional_messaging']::text[]
      and c.purpose_code='jihad_farmer_support_oversight'
    order by c.granted_at desc limit 1;
    if v_user is null then return; end if; v_kind:='farmer';
  elsif v_code ~ '^EXP-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$' then
    select ep.user_id,ep.public_name,ep.country_id,c.expires_at into v_user,v_name,v_country,v_expiry
    from public.expert_public_identifiers i join public.expert_profiles ep on ep.id=i.expert_profile_id and ep.verification_status='verified'
    join public.users u on u.id=ep.user_id and u.account_status='active'
    join public.expert_authority_consents c on c.expert_profile_id=ep.id and (c.organization_id=p_organization_id or c.organization_id is null)
    where i.public_code=v_code and i.status='active' and c.status='active'
      and (c.expires_at is null or c.expires_at>now()) and 'institutional_messaging'=any(c.consent_scopes)
    order by (c.organization_id=p_organization_id) desc,c.granted_at desc limit 1;
    if v_user is null then return; end if; v_kind:='expert';
  else return; end if;
  if not public.organization_has_scoped_access(p_organization_id,'communications.send',v_user,v_country,null) then return; end if;
  return query select v_user,v_kind,v_code,v_name,v_country,v_expiry;
end
$function$;
revoke all on function public.resolve_institutional_message_recipient(uuid,text) from public,anon,authenticated;

create or replace function public.lookup_institutional_message_recipient(p_organization_id uuid,p_public_code text)
returns table(recipient_kind text,public_code text,display_name text,consent_expires_at timestamptz)
language plpgsql security definer set search_path=''
as $function$
declare v record;
begin
  if p_organization_id is null or not exists(select 1 from public.organizations o where o.id=p_organization_id
    and o.status='verified' and o.organization_type in ('government','regulator','support_agency','public_institution')) then return; end if;
  select * into v from public.resolve_institutional_message_recipient(p_organization_id,p_public_code) limit 1;
  insert into public.institutional_access_audit_events(organization_id,actor_user_id,action_code,resource_type,resource_user_id,country_id,purpose_code,access_decision,metadata)
  values(p_organization_id,public.current_sarina_user_id(),'institutional.message.recipient_lookup','institutional_message',
    v.recipient_user_id,v.country_id,'jihad_official_communication',case when v.recipient_user_id is null then 'scope_denied' else 'granted' end,
    jsonb_build_object('recipient_code',upper(trim(coalesce(p_public_code,''))),'recipient_kind',v.recipient_kind));
  if v.recipient_user_id is null then return; end if;
  return query select v.recipient_kind,v.public_code,v.display_name,v.consent_expires_at;
end
$function$;
revoke all on function public.lookup_institutional_message_recipient(uuid,text) from public,anon;
grant execute on function public.lookup_institutional_message_recipient(uuid,text) to authenticated;

create or replace function public.send_institutional_message(p_organization_id uuid,p_public_code text,p_subject text,p_message text)
returns table(thread_id uuid,message_id uuid,recipient_kind text,recipient_name text)
language plpgsql security definer set search_path=''
as $function$
declare v record; v_actor uuid; v_thread uuid; v_message uuid; v_subject text; v_body text; v_org_name text;
begin
  v_actor:=public.current_sarina_user_id(); v_subject:=trim(coalesce(p_subject,'')); v_body:=trim(coalesce(p_message,''));
  if (select auth.uid()) is null or v_actor is null then raise exception 'Authentication required'; end if;
  if length(v_subject)<1 or length(v_subject)>180 or length(v_body)<1 or length(v_body)>5000 then raise exception 'Subject or message length is invalid'; end if;
  select o.display_name into v_org_name from public.organizations o where o.id=p_organization_id and o.status='verified'
    and o.organization_type in ('government','regulator','support_agency','public_institution');
  if v_org_name is null then raise exception 'Verified public authority organization required'; end if;
  select * into v from public.resolve_institutional_message_recipient(p_organization_id,p_public_code) limit 1;
  if v.recipient_user_id is null then
    insert into public.institutional_access_audit_events(organization_id,actor_user_id,action_code,resource_type,purpose_code,access_decision,metadata)
    values(p_organization_id,v_actor,'institutional.message.send','institutional_message','jihad_official_communication','scope_denied',
      jsonb_build_object('recipient_code',upper(trim(coalesce(p_public_code,'')))));
    raise exception 'Recipient not found, consent missing, or organization scope does not permit messaging';
  end if;
  insert into public.institutional_message_threads(organization_id,created_by_user_id,recipient_user_id,recipient_kind,recipient_code,recipient_country_id,subject)
  values(p_organization_id,v_actor,v.recipient_user_id,v.recipient_kind,v.public_code,v.country_id,v_subject)
  on conflict(organization_id,recipient_user_id) do update set recipient_kind=excluded.recipient_kind,recipient_code=excluded.recipient_code,
    recipient_country_id=excluded.recipient_country_id,subject=excluded.subject,status='active',updated_at=now()
  returning id into v_thread;
  insert into public.institutional_messages(thread_id,sender_user_id,message_text) values(v_thread,v_actor,v_body) returning id into v_message;
  update public.institutional_message_threads set updated_at=now() where id=v_thread;
  insert into public.institutional_access_audit_events(organization_id,actor_user_id,action_code,resource_type,resource_user_id,country_id,purpose_code,access_decision,metadata)
  values(p_organization_id,v_actor,'institutional.message.send','institutional_message',v.recipient_user_id,v.country_id,
    'jihad_official_communication','granted',jsonb_build_object('recipient_code',v.public_code,'recipient_kind',v.recipient_kind,'thread_id',v_thread,'message_id',v_message));
  return query select v_thread,v_message,v.recipient_kind,v.display_name;
end
$function$;
revoke all on function public.send_institutional_message(uuid,text,text,text) from public,anon;
grant execute on function public.send_institutional_message(uuid,text,text,text) to authenticated;

create or replace function public.reply_institutional_message(p_thread_id uuid,p_message text)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_user uuid; v_id uuid; v_org uuid; v_code text; v_country uuid;
begin
  v_user:=public.current_sarina_user_id();
  if (select auth.uid()) is null or v_user is null then raise exception 'Authentication required'; end if;
  if length(trim(coalesce(p_message,'')))<1 or length(trim(p_message))>5000 then raise exception 'Message length is invalid'; end if;
  select organization_id,recipient_code,recipient_country_id into v_org,v_code,v_country
  from public.institutional_message_threads where id=p_thread_id and recipient_user_id=v_user and status='active' for update;
  if v_org is null then raise exception 'Active recipient thread not found'; end if;
  insert into public.institutional_messages(thread_id,sender_user_id,message_text) values(p_thread_id,v_user,trim(p_message)) returning id into v_id;
  update public.institutional_message_threads set updated_at=now() where id=p_thread_id;
  insert into public.institutional_access_audit_events(organization_id,actor_user_id,action_code,resource_type,resource_user_id,country_id,purpose_code,access_decision,metadata)
  values(v_org,v_user,'institutional.message.reply','institutional_message',v_user,v_country,'jihad_official_communication','granted',
    jsonb_build_object('recipient_code',v_code,'thread_id',p_thread_id,'message_id',v_id));
  return v_id;
end
$function$;
revoke all on function public.reply_institutional_message(uuid,text) from public,anon;
grant execute on function public.reply_institutional_message(uuid,text) to authenticated;

create or replace function public.mark_institutional_thread_read(p_thread_id uuid)
returns integer language plpgsql security definer set search_path=''
as $function$
declare v_user uuid; v_count integer;
begin
  v_user:=public.current_sarina_user_id();
  if (select auth.uid()) is null or v_user is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.institutional_message_threads t where t.id=p_thread_id and t.recipient_user_id=v_user) then raise exception 'Recipient thread not found'; end if;
  update public.institutional_messages m set read_at=now() where m.thread_id=p_thread_id and m.sender_user_id<>v_user and m.read_at is null;
  get diagnostics v_count=row_count; return v_count;
end
$function$;
revoke all on function public.mark_institutional_thread_read(uuid) from public,anon;
grant execute on function public.mark_institutional_thread_read(uuid) to authenticated;

create policy institutional_message_threads_participant_read on public.institutional_message_threads
for select to authenticated using (
 recipient_user_id=public.current_sarina_user_id()
 or public.organization_has_scoped_access(organization_id,'communications.read',recipient_user_id,recipient_country_id,null)
);
create policy institutional_messages_participant_read on public.institutional_messages
for select to authenticated using (
 exists(select 1 from public.institutional_message_threads t where t.id=thread_id and (
  t.recipient_user_id=public.current_sarina_user_id()
  or public.organization_has_scoped_access(t.organization_id,'communications.read',t.recipient_user_id,t.recipient_country_id,null)
 ))
);
