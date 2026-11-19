# SARINA Connect implementation test plan

## Database foundation
- Confirm all four SARINA Connect tables exist and RLS is enabled.
- Confirm anon/authenticated have no table privileges and service_role has required access.
- Confirm delivery job idempotency key and provider event (provider_code, provider_event_ref) are unique.
- Confirm the delivery queue indexes cover queued/failed jobs.
- Confirm provider safe_metadata rejects non-object values and payloads larger than 8 KiB.
- Confirm consent scope is an object and is bounded to 4 KiB.

## Authorization
- Anonymous and authenticated clients cannot read or mutate routes, outbox jobs, provider events or consent audit.
- Service-side functions use only service-role credentials and never return endpoint_secret_ref to a client.
- A future status endpoint returns only channel code, connection state and consent state for the authenticated participant.

## Runtime (after provider adapters exist)
- AI credit balance zero: normal messaging remains available.
- AI provider timeout: normal messaging remains available.
- Provider timeout/rate limit: bounded retries and dead-letter after configured limit; in-app messages remain usable.
- Duplicate webhook: one canonical message/event only.
- Invalid webhook signature: reject before processing and do not persist payload.
- Revoked consent: no subsequent external outbound job.
- Attachment: validate MIME, size, ownership and malware scan before delivery.
- One consultation: exactly one farmer and one assigned verified specialist; no group participant expansion.

## Not yet covered by this foundation
- Actual Telegram and WhatsApp adapters.
- Secure channel linking/consent UI.
- Worker deployment, queue claiming and dead-letter operations.
- Provider template, regional availability and pricing checks.
- End-to-end delivery tests with sandbox provider accounts.
