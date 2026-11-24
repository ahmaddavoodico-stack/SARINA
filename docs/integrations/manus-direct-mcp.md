# SARINA ↔ Manus direct MCP integration

Status: implementation prepared on `feature/sarina-manus-mcp-direct`; not deployed or live-tested.

## Architecture

Manus connects directly to the SARINA Supabase Edge Function using Streamable HTTP MCP. Activepieces is not part of this route.

Endpoint after deployment:

`https://<SARINA_PROJECT_REF>.supabase.co/functions/v1/sarina-manus-mcp`

Manus authentication is a dedicated bearer token in the `Authorization` header. Never put the token in the URL, source code, GitHub, prompts, or chat messages.

## Initial permission boundary

The first release exposes only:
- `sarina_connection_check`
- `sarina_integration_capabilities`
- `save_market_research_draft`
- `list_market_research_drafts`
- `get_market_research_draft`

Manus cannot read farmer identities, farms, private conversations, orders, payment data, or the active product catalog. It cannot publish products, alter prices/inventory, contact companies, or publish external content.

Market research is saved to `public.sarina_manus_market_research_drafts` with status `pending_review`. The table has RLS enabled and no client policies; only the Edge Function's server-side service role can access it. Approval remains a human SARINA action.

## Required server secrets

Configure these only in Supabase Edge Function secrets:
- `SARINA_MANUS_ACCESS_TOKEN`: independently generated random secret, at least 32 characters.
- `SUPABASE_URL`: Supabase project URL (normally already available to Edge Functions).
- `SUPABASE_SERVICE_ROLE_KEY`: server-only service role key (normally already available to Edge Functions). Never expose it to Manus or browser clients.

The Manus token must be different from all Supabase API keys. Rotate it if exposed.

## Deployment and connection checklist

1. Review and test this branch before production deployment.
2. Apply migration `20261125010000_sarina_manus_direct_mcp_drafts.sql`.
3. Configure `SARINA_MANUS_ACCESS_TOKEN` as an Edge Function secret.
4. Deploy `sarina-manus-mcp` with platform JWT verification disabled because this endpoint authenticates using its own bearer token. The function rejects requests unless the token is present and valid.
5. Test the MCP handshake and tool listing with a valid token; confirm missing/invalid tokens return 401 and missing server secret returns 503.
6. In Manus → Connectors → Custom MCP → Direct configuration, add:
   - Name: `SARINA`
   - Transport: `HTTP`
   - URL: the endpoint above
   - Header: `Authorization` = `Bearer <SARINA_MANUS_ACCESS_TOKEN>`
7. Run `sarina_connection_check`, then verify a sample report can be saved as a private draft and appears in SARINA.
8. Do not merge or claim live connectivity until the acceptance checks pass.

## Rollback

Disable or delete the Edge Function and revoke/rotate `SARINA_MANUS_ACCESS_TOKEN`. The draft table is isolated and can remain in place for audit/history.
