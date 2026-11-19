# SARINA Connect — Lightweight One-to-One Communications

## Product contract

SARINA Connect is the system of record for the relationship, case linkage, channel consent, routing and operational events. WhatsApp, Telegram and future providers are transport adapters, not the canonical conversation database.

The first supported interaction model is strictly one farmer ↔ one assigned, verified specialist per consultation. Group rooms and multi-party sessions are out of scope.

## Reliability invariants

1. Ordinary communication must continue when AI credits are exhausted or AI services are unavailable.
2. Sending, receiving, delivery receipts and attachments do not call an AI model and do not debit AI credits.
3. AI analysis is an explicit, separate action and is charged only through the existing AI usage/credit pipeline.
4. External transport is provider-hosted wherever practical. SARINA does not build or relay voice/video media streams.
5. The existing `expert_consultations` and `expert_consultation_messages` remain the in-app consultation and message source of truth.
6. No specialist personal messaging account is required. Production external routes must use centrally managed SARINA provider connections.
7. A specialist may recommend a relevant product not listed in the SARINA marketplace. The case record can capture the recommendation and disclosure; marketplace presence is not a prerequisite.
8. No message content is copied into delivery queues or webhook audit rows. The outbox references the canonical message row.

## Data model added

- `sarina_connect_channel_routes`: one consented channel endpoint for one consultation participant. The provider endpoint is referenced through an opaque secret-vault reference; never store raw phone numbers, bot tokens or provider credentials here.
- `sarina_connect_delivery_jobs`: transactional outbox referencing an existing consultation message and a route. Idempotency key, retry state and delivery receipts live here.
- `sarina_connect_provider_events`: deduplicated webhook receipts with bounded, safe metadata only. Raw webhook payloads and message bodies are deliberately excluded.
- `sarina_connect_consent_events`: append-only audit of explicit grant, scope changes and revocation.

All four tables have RLS enabled and are inaccessible to anon/authenticated clients. Only trusted server-side provider adapters using the service role may read/write them. Never expose service-role credentials in a browser.

## Low-load message path

1. A participant sends a message through the existing consultation UI or an approved external channel.
2. The canonical message is stored once in `expert_consultation_messages`.
3. For outbound external delivery, a small outbox row references the message and the recipient's active route. No body copy, AI call or media relay is created.
4. A background worker claims jobs in batches, sends through the provider API, and updates status. Use bounded retries with exponential backoff, provider idempotency where supported, and a dead-letter state.
5. Provider webhooks are signature-verified before parsing. Store a deduplicated event reference and minimal safe metadata; normalize inbound content into the canonical consultation message table.
6. Delivery receipts and operational case events are separate from expert actions. A normal message is not counted as a consultation outcome.

Use object storage for attachments and provider-hosted media URLs where permitted. Validate MIME type, size and malware status before making an attachment available. Do not proxy voice/video streams through the SARINA application server.

## Consent, privacy and identity

- Consent is per user, per consultation and per channel; it is not implied by accepting an expert assignment.
- Revocation immediately disables further outbound delivery on that route.
- The farmer and specialist do not need to exchange personal phone numbers or account identifiers through SARINA.
- The route table is server-only. A future UI should expose only a safe connection status through a scoped server endpoint, never the provider endpoint reference.
- Admin access to message content must be purpose-limited, role-gated and auditable. Do not create unrestricted blanket transcript surveillance.
- Retention and deletion periods must be configurable by jurisdiction and provider policy before production rollout.

## Provider integration sequence

1. Implement and test the server-side outbox worker and signed-webhook ingress.
2. Pilot Telegram using one official SARINA bot; users must initiate bot contact before bot delivery.
3. Add WhatsApp Business Platform using a centrally controlled SARINA business number after country, template, opt-in and pricing eligibility checks.
4. Keep provider credentials in a managed secret store; store only opaque references in Postgres.
5. Add a safe user-facing channel-linking and consent flow.
6. Add monitoring for queue age, delivery latency, retry count, webhook signature failures, dead letters and provider rate limits.

No provider credentials, phone numbers, bot identities or real delivery integrations are configured by this schema migration. External channels remain disabled until the adapter, consent flow, secrets and provider verification are implemented.

## Capacity and cost controls

- Batch queue claims and provider calls; do not run a database query per message status poll.
- Keep queue rows narrow and indexed by ready state and availability time.
- Use webhook delivery receipts rather than frequent polling.
- Apply per-provider concurrency/rate limits and bounded retries.
- Do not enable Realtime subscriptions to every message row by default; use targeted notifications or provider-native push where appropriate.
- Keep messaging usage separate from AI credits and specialist workspace billing.
- Monitor provider charges separately from SARINA infrastructure and AI token costs.

## Acceptance checks

- Exhausted AI credit does not block in-app messages or provider delivery.
- A message is stored once; an outbound retry cannot create duplicate provider sends when provider idempotency is supported.
- Repeated provider webhook event IDs are ignored safely.
- A route without explicit consent cannot be activated or used for delivery.
- Revoked routes cannot receive new outbound jobs.
- A participant cannot read another participant's route or delivery queue through the client API.
- Group conversations cannot be created by this one-to-one workflow.
- No provider secret, raw phone number or raw webhook payload is exposed to the browser or stored in these tables.
- Provider outage queues messages with bounded retries; it does not block in-app communication.
- No messaging event consumes AI credits.
