-- Restrict case assistant updates to review fields and validate substitute credentials.
revoke update on public.expert_case_assistant_cases from authenticated;
grant update (assistant_status,completeness_status,missing_information,assistant_summary)
  on public.expert_case_assistant_cases to authenticated;
create or replace function private.validate_expert_availability_substitute()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.substitute_expert_profile_id is not null and not exists (
    select 1 from public.expert_profiles ep
    where ep.id=new.substitute_expert_profile_id and ep.verification_status='verified'
  ) then raise exception 'A substitute must be a verified expert'; end if;
  return new;
end; $$;
drop trigger if exists expert_availability_substitute_guard on public.expert_availability;
create trigger expert_availability_substitute_guard
before insert or update of substitute_expert_profile_id on public.expert_availability
for each row execute function private.validate_expert_availability_substitute();
