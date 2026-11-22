alter table public.expert_requests
  add column if not exists referral_source text not null default 'farmer_selected',
  add column if not exists referral_context jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.expert_requests'::regclass
      and conname = 'expert_requests_referral_source_check'
  ) then
    alter table public.expert_requests
      add constraint expert_requests_referral_source_check
      check (referral_source in ('farmer_selected', 'sarina_suggested'));
  end if;
end
$$;

create index if not exists expert_requests_referral_source_created_at_idx
  on public.expert_requests (referral_source, created_at desc);

comment on column public.expert_requests.referral_source is
  'Farmer-facing referral path: farmer_selected or sarina_suggested. This is workflow attribution, not an authorization claim.';
comment on column public.expert_requests.referral_context is
  'Non-sensitive snapshot of the farm-relative expert origin classification and the rule-based suggestion context at request submission.';
