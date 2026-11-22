create table if not exists public.organization_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reviewer_user_id uuid not null references public.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  review_text text check (review_text is null or char_length(review_text) <= 2000),
  status text not null default 'published' check (status in ('published','hidden','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, reviewer_user_id)
);
create index if not exists organization_reviews_public_idx
  on public.organization_reviews(organization_id,status,created_at desc);
alter table public.organization_reviews enable row level security;
drop policy if exists organization_reviews_read_public on public.organization_reviews;
create policy organization_reviews_read_public on public.organization_reviews
for select to anon, authenticated using (status='published');
revoke all on public.organization_reviews from anon, authenticated;
grant select on public.organization_reviews to anon, authenticated;

create or replace view public.organization_rating_summary
with (security_invoker=true) as
select organization_id,
       round(avg(rating)::numeric,2) as average_rating,
       count(*)::integer as review_count
from public.organization_reviews
where status='published'
group by organization_id;
grant select on public.organization_rating_summary to anon, authenticated;

create or replace function public.submit_organization_review(
  p_organization_id uuid,
  p_rating integer,
  p_review_text text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_review_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_rating < 1 or p_rating > 5 then raise exception 'Rating must be between 1 and 5'; end if;
  if p_review_text is not null and char_length(p_review_text) > 2000 then raise exception 'Review is too long'; end if;

  select id into v_profile_id
  from public.users
  where auth_user_id = auth.uid() and account_status = 'active';
  if v_profile_id is null then raise exception 'Active user profile required'; end if;

  if not exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id=ur.role_id
    where ur.user_id=v_profile_id and r.code='farmer'
      and ur.scope_type='global' and ur.scope_id is null
  ) then raise exception 'Only farmer accounts can review companies'; end if;

  if not exists (
    select 1 from public.organizations o
    where o.id=p_organization_id and o.status='verified'
  ) then raise exception 'Only verified organizations can be reviewed'; end if;

  insert into public.organization_reviews(organization_id,reviewer_user_id,rating,review_text,status)
  values(p_organization_id,v_profile_id,p_rating,nullif(trim(p_review_text),''),'published')
  on conflict (organization_id,reviewer_user_id)
  do update set rating=excluded.rating,review_text=excluded.review_text,
                status='published',updated_at=now()
  returning id into v_review_id;

  return v_review_id;
end;
$$;
revoke all on function public.submit_organization_review(uuid,integer,text) from public, anon;
grant execute on function public.submit_organization_review(uuid,integer,text) to authenticated;
