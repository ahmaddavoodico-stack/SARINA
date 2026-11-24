# Activepieces ↔ SARINA Bridge

Status: implementation candidate; **not deployed or connected yet**.

## Purpose

Provide a server-to-server ingress from Activepieces into SARINA's own automation inbox. SARINA remains the system of record and decision authority. Activepieces is only an execution/orchestration client.

## Endpoint

After deployment, the endpoint is:

`POST https://<project-ref>.supabase.co/functions/v1/activepieces-sarina-bridge`

The Edge Function requires `verify_jwt = false` at the Supabase gateway because it authenticates each request itself with HMAC-SHA256. This is not an unauthenticated public webhook.

## Authentication

Set the Supabase Edge Function secret `ACTIVEPIECES_SARINA_HMAC_SECRET` to a randomly generated secret of at least 32 characters. The function also requires the platform-provided `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; neither is sent to Activepieces.

For each request:
- `x-sarina-timestamp`: Unix timestamp in seconds (10 digits).
- `x-sarina-signature`: `sha256=<lowercase hex HMAC-SHA256>`.
- Signed bytes: UTF-8 of `<timestamp>.<exact raw JSON request body>`.
- Reject timestamps more than five minutes from server time.
- Use a fresh event_id for each logical event. Duplicate event IDs are idempotently acknowledged.

The HMAC secret belongs in Activepieces' encrypted connection/secret storage only. Never place it in a code literal, Git, a URL, logs, or farmer-facing client code.

## Accepted event envelope

```json
{
  "event_id": "unique-id-generated-for-this-event",
  "event_type": "store.market.research.requested",
  "payload": {
    "query": "public market research topic",
    "locale": "fa"
  }
}
```

Allowed event types:
- `store.market.research.requested`
- `store.market.research.completed`
- `store.daily.summary.requested`

Payload limit: 64 KiB. Payload must be a JSON object. Do not send personal farmer data, credentials, payment details, or precise location data through this initial integration.

## Persistence and current boundary

Verified events are inserted into `public.activepieces_automation_inbox` with status `queued`. The table is not accessible to `anon` or `authenticated` roles. Duplicate event IDs return an idempotent acknowledgement.

**Important:** this change only implements authenticated ingress and durable queueing. It does not yet execute queued tasks, call an AI provider, alter products/orders/prices, or authorize business actions. A SARINA-owned worker and reviewed task handlers are a separate next step. No paid AI API is required for this bridge.

## Deployment checklist

1. Apply the SQL migration.
2. Set `ACTIVEPIECES_SARINA_HMAC_SECRET` as a Supabase Edge Function secret.
3. Deploy the Edge Function with gateway JWT verification disabled; HMAC validation is mandatory inside the function.
4. Configure the Activepieces HTTP step to POST the envelope and HMAC headers.
5. Verify accepted, duplicate, invalid-signature, stale-timestamp, unsupported-event, and oversized-payload cases before enabling the scheduled flow.
