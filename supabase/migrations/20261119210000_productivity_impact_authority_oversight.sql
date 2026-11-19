begin;
create table if not exists public.farm_productivity_outcome_reviews (
 id uuid primary key default gen_random_uuid(),
 farm_id uuid not null references public.farms(id) on delete cascade,
 baseline_id uuid references public.farm_productivity_baselines(id) on delete set null,
 evaluation_period_start date, evaluation_period_end date,
 classification text not null check (classification in ('breakthrough','limited_progress','decline','insufficient_evidence')),
 attribution_type text not null default 'unclear' check (attribution_type in ('sarina_led','expert_led','joint','farmer_led','external','unclear')),
 attribution_confidence text not null default 'unknown' check (attribution_confidence in ('high','medium','low','unknown')),
 expert_impact_record_id uuid references public.expert_impact_records(id) on delete set null,
 change_summary jsonb not null default '{}'::jsonb,
 evidence_quality text not null default 'unknown' check (evidence_quality in ('high','medium','low','unknown')),
 followup_priority text not null default 'routine' check (followup_priority in ('routine','monitor','high','urgent')),
 followup_status text not null default 'open' check (followup_status in ('open','assigned','in_progress','resolved','not_required')),
 review_notes text, reviewed_by uuid references public.users(id) on delete set null,
 reviewed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (evaluation_period_start is null or evaluation_period_end is null or evaluation_period_end >= evaluation_period_start)
);
create index if not exists farm_productivity_outcome_farm_date_idx on public.farm_productivity_outcome_reviews(farm_id,created_at desc);
create index if not exists farm_productivity_outcome_queue_idx on public.farm_productivity_outcome_reviews(classification,followup_priority,followup_status,created_at desc);
create table if not exists public.farm_productivity_authority_consents (
 id uuid primary key default gen_random_uuid(),
 farm_id uuid not null references public.farms(id) on delete cascade,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 granted_by_user_id uuid not null references public.users(id) on delete restrict,
 access_scope text not null default 'summary' check (access_scope in ('summary','followup')),
 status text not null default 'active' check (status in ('active','revoked')),
 granted_at timestamptz not null default now(), revoked_at timestamptz, created_at timestamptz not null default now(),
 check ((status='active' and revoked_at is null) or (status='revoked' and revoked_at is not null))
);
create unique index if not exists farm_productivity_authority_active_consent_idx on public.farm_productivity_authority_consents(farm_id,organization_id) where status='active';
create index if not exists farm_productivity_authority_org_idx on public.farm_productivity_authority_consents(organization_id,status,farm_id);
create table if not exists public.farm_productivity_knowledge_candidates (
 id uuid primary key default gen_random_uuid(),
 outcome_review_id uuid not null references public.farm_productivity_outcome_reviews(id) on delete cascade,
 farm_id uuid not null references public.farms(id) on delete cascade,
 contribution_type text not null check (contribution_type in ('sarina_led','expert_led','joint','farmer_led','external')),
 title text not null, anonymized_summary text not null, context_snapshot jsonb not null default '{}'::jsonb,
 status text not null default 'candidate' check (status in ('candidate','in_review','approved','rejected','restricted')),
 farmer_consent_at timestamptz, expert_consent_at timestamptz, anonymized_at timestamptz,
 approved_by uuid references public.users(id) on delete set null, approved_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (status <> 'approved' or (farmer_consent_at is not null and anonymized_at is not null and (contribution_type not in ('expert_led','joint') or expert_consent_at is not null)))
);
create index if not exists farm_productivity_knowledge_status_idx on public.farm_productivity_knowledge_candidates(status,created_at desc);
alter table public.farm_productivity_outcome_reviews enable row level security;
alter table public.farm_productivity_authority_consents enable row level security;
alter table public.farm_productivity_knowledge_candidates enable row level security;
create policy productivity_outcome_admin_all on public.farm_productivity_outcome_reviews for all to authenticated using ((select public.is_sarina_admin())) with check ((select public.is_sarina_admin()));
create policy productivity_outcome_farmer_read on public.farm_productivity_outcome_reviews for select to authenticated using (exists(select 1 from public.farms f where f.id=farm_productivity_outcome_reviews.farm_id and f.owner_user_id=(select public.current_sarina_user_id())));
create policy productivity_outcome_authority_read on public.farm_productivity_outcome_reviews for select to authenticated using (exists(
 select 1 from public.farms f join public.organization_members om on om.user_id=(select public.current_sarina_user_id()) and om.status='active'
 join public.farm_productivity_authority_consents c on c.farm_id=f.id and c.organization_id=om.organization_id and c.status='active'
 where f.id=farm_productivity_outcome_reviews.farm_id
 and public.organization_has_scoped_access(om.organization_id,'oversight.productivity.read',f.owner_user_id,f.country_id,f.id)
));
create policy productivity_authority_consent_farmer_manage on public.farm_productivity_authority_consents for all to authenticated
 using (exists(select 1 from public.farms f where f.id=farm_productivity_authority_consents.farm_id and f.owner_user_id=(select public.current_sarina_user_id())))
 with check (granted_by_user_id=(select public.current_sarina_user_id()) and exists(
  select 1 from public.farms f join public.organizations o on o.id=farm_productivity_authority_consents.organization_id
  where f.id=farm_productivity_authority_consents.farm_id and f.owner_user_id=(select public.current_sarina_user_id()) and o.status='verified'
 ));
create policy productivity_authority_consent_admin_read on public.farm_productivity_authority_consents for select to authenticated using ((select public.is_sarina_admin()));
create policy productivity_authority_consent_org_read on public.farm_productivity_authority_consents for select to authenticated using (status='active' and exists(
 select 1 from public.farms f join public.organization_members om on om.organization_id=farm_productivity_authority_consents.organization_id and om.user_id=(select public.current_sarina_user_id()) and om.status='active'
 where f.id=farm_productivity_authority_consents.farm_id and public.organization_has_scoped_access(om.organization_id,'oversight.productivity.read',f.owner_user_id,f.country_id,f.id)
));
create policy productivity_knowledge_admin_all on public.farm_productivity_knowledge_candidates for all to authenticated using ((select public.is_sarina_admin())) with check ((select public.is_sarina_admin()));
grant select,insert,update on public.farm_productivity_outcome_reviews to authenticated;
grant select,insert,update on public.farm_productivity_authority_consents to authenticated;
grant select,insert,update on public.farm_productivity_knowledge_candidates to authenticated;
comment on table public.farm_productivity_outcome_reviews is 'Reviewed productivity outcomes with explicit attribution and follow-up status; not causal claims by default.';
comment on table public.farm_productivity_authority_consents is 'Farmer-controlled revocable consent for verified regional authority access within separately approved geographic scope.';
comment on table public.farm_productivity_knowledge_candidates is 'Internal learning candidates; approval requires anonymization and farmer consent, plus expert consent for expert-led or joint work.';
commit;