-- Limit the Manus integration's database role to the operations its MCP tools need.
revoke all on table public.sarina_manus_market_research_drafts from service_role;
grant select, insert on table public.sarina_manus_market_research_drafts to service_role;
