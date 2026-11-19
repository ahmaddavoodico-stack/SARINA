# SARINA Connect implementation test plan

## Database foundation
- Confirm all four SARINA Connect tables exist and RLS is enabled.
- Confirm anon/authenticated have no table privileges and service_role has required access.
- Confirm delivery job idempotency key and provider event (provider_code, provider_event_ref) are unique.
- Confirm the delivery queue indexes cover queued/failed jobs.
- Confirm provider safe_metadata rejects non-object values and payloads larger than 8 KiB.
- Confirm consent scope is an object and is bounded to 4 KiB.

## Authorization and privacy
- Anonymous and authenticated clients cannot read or mutate routes, outbox jobs, provider events or consent audit.
- Service-side functions use only service-role credentials and never return endpoint_secret_ref to a client.
- A future status endpoint returns only channel code, connection state and consent state for the authenticated participant.
- A farmer cannot resolve another farmer's provider identity, route, messages or consultation.
- Admin access to message content is purpose-limited and auditable.
- Revocation prevents new outbound delivery immediately.
- Retention/deletion jobs follow configured policy without exposing secrets or raw webhook payloads.

## Identity and routing
- One central SARINA Telegram bot can serve many isolated private chats.
- One central SARINA WhatsApp Business identity can serve multiple independent customer conversations subject to provider limits.
- A relayed specialist message visibly identifies the actual assigned specialist represented by SARINA.
- Provider sender identity is never misrepresented as the specialist's personal account.
- Multiple consultations for one farmer remain separate and correctly routed.
- Inbound webhook identity maps to exactly one authorized SARINA user and active consultation; ambiguous mappings fail closed.
- Telegram bot cannot initiate a conversation before the user starts it.
- WhatsApp opt-in, template, service-window, region, quality and throughput rules are enforced.
- Disabling one provider does not interrupt in-app messaging or another provider.

## Runtime and reliability (after provider adapters exist)
- AI credit balance zero: normal messaging remains available.
- AI provider timeout: normal messaging remains available.
- Provider timeout/rate limit: bounded retries and dead-letter after configured limit; in-app messages remain usable.
- Duplicate webhook: one canonical message/event only.
- Invalid webhook signature: reject before processing and do not persist payload.
- Attachment: validate MIME, size, ownership and malware scan before delivery.
- Delivery receipts update status without invoking AI or creating duplicate messages.
- A normal message, attachment, delivery receipt or field note does not debit AI credits.
- AI analysis is explicit and uses the separate AI metering path.
- Queue worker uses batch claims, bounded retries/backoff and dead-letter monitoring; no per-message polling loop.

## Human freedom and field workflow
- Farmer and specialist may exchange contact details or communicate outside SARINA without product lockout.
- A specialist may recommend a suitable product outside the SARINA marketplace with transparent case documentation.
- In-person visits and direct calls remain possible; no server-side voice/video media relay is required in v1.
- Field visit summaries are recorded only with appropriate awareness/consent and preserve author attribution.
- Everyday, specialist and field communication are organized as modes, not forced group rooms.

## Not yet covered by the current foundation
- Actual Telegram and WhatsApp adapters.
- Secure channel linking/consent UI.
- Worker deployment, queue claiming and dead-letter operations.
- Provider template, regional availability and pricing checks.
- End-to-end delivery tests with sandbox provider accounts.
- Production secret-vault integration and monitoring/alerting.
