-- Direct Manus MCP integration for SARINA.
-- Manus can only create research drafts; it cannot publish products or mutate farm/user records.

create table if not exists public.sarina_manus_market_research_drafts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  market_scope text not null check (char_length(market_scope) between 1 and 300),
  summary text not null check (char_length(summary) between 1 and 8000),
  findings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(findings) = 'array'),
  sources jsonb not null default '[]'::jsonb
    check (jsonb_typeof(sources) = 'array'),
  recommendations jsonb not null default '[]'::jsonb
    check (jsonb_typeof(recommendations) = 'array'),
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'rejected')),
  submitted_by text not null default 'manus',
  created_at timestamptz not null default now()
);

create index if not exists sarina_manus_market_research_drafts_created_at_idx
  on public.sarina_manus_market_research_drafts (created_at desc);

alter table public.sarina_manus_market_research_drafts enable row level security;

revoke all on table public.sarina_manus_market_research_drafts
  from public, anon, authenticated;
grant select, insert on table public.sarina_manus_market_research_drafts
  to service_role;

comment on table public.sarina_manus_market_research_drafts is
  'Private Manus-submitted agricultural market research drafts. All entries require SARINA human review before use.';
