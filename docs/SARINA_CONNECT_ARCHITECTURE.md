# SARINA Connect — Lightweight One-to-One Communications

## Product contract

SARINA Connect is the system of record for the relationship, case linkage, channel consent, routing and operational events. WhatsApp, Telegram, Bale and future providers are transport adapters, not the canonical conversation database.

The first supported interaction model is strictly one farmer ↔ one assigned, verified specialist per consultation. Group rooms and multi-party sessions are out of scope. A farmer may have multiple independent private consultation threads with different specialists.

## Communication experience and identity

- The official SARINA identity is the shared entry point for external messaging: one centrally managed Telegram bot, one centrally managed Bale bot for users in Iran, and, where eligible, one centrally managed WhatsApp Business identity can serve many independent private conversations.
- This is a mediated/relayed conversation, not a native peer-to-peer chat between the farmer's personal account and the specialist's personal account. The provider-facing sender is SARINA.
- Every relayed specialist message must clearly identify the human specialist it represents (for example, “Message from your SARINA verified specialist: [display name]”). Never imply that the central SARINA account is the specialist's personal account.
- Each provider user/chat identifier is mapped server-side to the canonical SARINA user and the correct consultation. One user's thread must never leak into another user's thread.
- Telegram and Bale bot users must initiate the bot conversation before the bot can message them. WhatsApp outbound messaging must obey current opt-in, template, service-window, quality, throughput, regional and pricing rules.
- Iran-based users may choose Bale as a domestic channel. The selected channel and provider connection are explicit per user/consultation; an Iranian phone number is not required merely to use Bale bot messaging. Any phone-based verification remains a separate identity flow.
- Channels are independently enableable/disableable. A Telegram, Bale or WhatsApp outage/restriction must not take down in-app messaging or another provider.
- The product encourages keeping useful work context in SARINA but never forcibly prevents farmers and specialists from communicating directly, exchanging contact details, meeting in person, or using other channels. No marketplace-only product recommendation rule is allowed.

## Communication modes

The product may label and organize communication as:
1. Everyday communication.
2. Specialist consultation communication.
3. Field communication (farm visits, observations and follow-up).

These are organizational modes, not separate group chats. A field visit remains free and direct; when the parties choose, its agreed summary, observations, measurements, recommendations and next steps can be recorded in the consultation case. Do not silently record calls or visits.

## Reliability invariants

1. Ordinary communication must continue when AI credits are exhausted or AI services are unavailable.
2. Sending, receiving, delivery receipts and attachments do not call an AI model and do not debit AI credits.
3. AI analysis is an explicit, separate action and is charged only through the existing AI usage/credit pipeline.
4. External transport is provider-hosted wherever practical. SARINA does not build or relay voice/video media streams in the first release.
5. The existing `expert_consultations` and `expert_consultation_messages` remain the in-app consultation and message source of truth.
6. No specialist personal messaging account is required. Production external routes use centrally managed SARINA provider connections.
7. A specialist may recommend a relevant product not listed in the SARINA marketplace. The case record can capture the recommendation and disclosure; marketplace presence is not a prerequisite.
8. No message content is copied into delivery queues or webhook audit rows. The outbox references the canonical message row.
9. Ordinary messaging, file transfer and delivery receipts are operationally and financially independent from AI credits and specialist AI usage.
10. Provider failure, exhausted AI credits or AI downtime must never block in-app communication or direct human contact.

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
5. Provider webhooks are verified using the strongest mechanism the provider supports; where Bale does not document a signed webhook mechanism, use a high-entropy per-bot secret URL/path, strict method/content-size limits, source-independent update idempotency, and do not treat IP allowlisting as the sole control. Store a deduplicated event reference and minimal safe metadata; raw webhook payloads are not persisted.
6. Delivery receipts and operational case events are separate from expert actions. A normal message is not counted as a consultation outcome.
7. Preserve the original human author and the represented specialist identity in the canonical record and UI; provider transport identity alone is not sufficient for attribution.

Use object storage for attachments and provider-hosted media URLs where permitted. Validate MIME type, size, ownership and malware status before making an attachment available. Do not proxy voice/video streams through the SARINA application server.

## Consent, privacy and identity

- Consent is per user, per consultation and per channel; it is not implied by accepting an expert assignment.
- Revocation immediately disables further outbound delivery on that route.
- The farmer and specialist do not need to exchange personal phone numbers or account identifiers through SARINA.
- The route table is server-only. A future UI should expose only a safe connection status through a scoped server endpoint, never the provider endpoint reference.
- Admin access to message content must be purpose-limited, role-gated and auditable. Do not create unrestricted blanket transcript surveillance.
- Field-visit notes and summaries should be added to a case only with appropriate participant awareness/consent; never imply background audio/video recording.
- Retention and deletion periods must be configurable by jurisdiction and provider policy before production rollout.

## Provider adapter design

Each provider implements a narrow adapter contract: normalize inbound update, validate provider-specific webhook/request, resolve provider chat identity, send text/media, acknowledge callback/update where supported, and translate provider delivery/errors into SARINA's canonical status model. Provider-specific payloads must not leak into the core domain model.

### Bale (Iran domestic channel)

- Implement a dedicated `BaleProviderAdapter` and one centrally managed official SARINA Bale bot. Do not create one bot per farmer or specialist; one official bot serves many independent private chats, while SARINA keeps each consultation isolated internally.
- Create the bot through Bale's official `@botfather` and keep its token in the managed secret store. Never commit the token, expose it to the browser, or store it in a client-readable table.
- Official API base URL is `https://tapi.bale.ai/bot<TOKEN>/METHOD_NAME`; Bale documents that its Bot API is based on Telegram's API with small changes. Reuse shared transport/normalization code only behind the provider adapter; do not assume full Telegram feature parity.
- Prefer HTTPS webhook ingress for production. Bale also supports `getUpdates` long polling. Its current docs state updates are retained up to 2,000 messages for 24 hours; therefore webhook availability, backlog age and recovery must be monitored, and polling is a controlled fallback rather than a second concurrent consumer.
- Bale's documented webhook ports are 443 and 88. The current public docs describe `setWebhook` and HTTPS POST updates but do not document a Telegram-equivalent signed secret header. Until verified otherwise, use a unique high-entropy secret path per bot, strict request validation, update-id deduplication, payload size limits and rapid acknowledgement; do not claim cryptographic provider signature verification.
- Initial pilot scope: private one-to-one text messages, `/start` onboarding, language selection, link/consent confirmation, consultation routing, specialist identity labels, help/stop commands, and safe error responses. Add photo/document/location/voice support only after file limits, MIME validation, malware scanning, privacy and storage behavior are tested.
- Ignore group/channel updates for consultation routing in v1. Do not enable broadcast or unsolicited outbound campaigns. The user must initiate the bot chat and explicitly link/consent to a consultation.
- Keep Bale's numeric provider chat/user IDs as opaque provider identifiers, not as SARINA user IDs or phone numbers. Store the mapping server-side and isolate it by provider and bot identity.
- Do not use Bale's payment/wallet methods for SARINA billing in this phase. AI credits and payments remain on separate, reviewed payment rails.
- Test actual bot creation, getMe, setWebhook/getWebhookInfo, inbound updates, sendMessage, callback keyboards, duplicate updates, unavailable users, rate limits, file transfers and provider outage recovery in a sandbox before enabling production.

### Telegram

- Use one official SARINA bot. Users must initiate the bot conversation before the bot can message them.
- Preserve provider-specific webhook validation and rate-limit behavior in the Telegram adapter.

### WhatsApp

- Use one centrally controlled SARINA WhatsApp Business identity after country, template, opt-in, service-window and pricing eligibility checks.
- Outbound messaging must obey current WhatsApp Business Platform policy and throughput limits.

## Provider integration sequence

1. Implement and test the server-side outbox worker and signed/secret-protected webhook ingress.
2. Pilot Telegram and Bale as separate adapters against their official bot APIs; use one central SARINA bot per provider and keep provider credentials separate.
3. Add WhatsApp Business Platform using a centrally controlled SARINA business number after country, template, opt-in and pricing eligibility checks.
4. Keep provider credentials in a managed secret store; store only opaque references in Postgres.
5. Add a safe user-facing channel-linking and per-consultation consent flow, including revocation.
6. Add monitoring for queue age, delivery latency, retry count, webhook validation failures, dead letters and provider rate limits.
7. Add provider sandbox tests and a staged pilot before enabling any production route.

No provider credentials, phone numbers, bot identities or real delivery integrations are configured by this schema migration. External channels remain disabled until the adapter, consent flow, secrets and provider verification are implemented.

## Capacity and cost controls

- Batch queue claims and provider calls; do not run a database query per message status poll.
- Keep queue rows narrow and indexed by ready state and availability time.
- Use webhook delivery receipts rather than frequent polling.
- Apply per-provider concurrency/rate limits and bounded retries.
- Do not enable Realtime subscriptions to every message row by default; use targeted notifications or provider-native push where appropriate.
- Keep messaging usage separate from AI credits, specialist workspace billing and any valid expert-farmer service contract.
- Monitor provider charges separately from SARINA infrastructure and AI token costs.
- A single central identity supports many independent private chats, but never promise unlimited throughput; enforce provider-specific limits and graceful queueing.

## Acceptance checks

- Exhausted AI credit does not block in-app messages or provider delivery.
- An AI provider timeout does not block ordinary communication.
- A message is stored once; an outbound retry cannot create duplicate provider sends when provider idempotency is supported.
- Repeated provider webhook event IDs are ignored safely.
- A route without explicit consent cannot be activated or used for delivery.
- Revoked routes cannot receive new outbound jobs.
- A participant cannot read another participant's route or delivery queue through the client API.
- Group conversations cannot be created by this one-to-one workflow.
- No provider secret, raw phone number or raw webhook payload is exposed to the browser or stored in these tables.
- Provider outage queues messages with bounded retries; it does not block in-app communication or other independent channels.
- Outbound specialist messages visibly identify the human specialist represented by SARINA.
- Inbound messages are routed to the correct canonical user and consultation only.
- A user can maintain multiple isolated consultation threads.
- Telegram and Bale bot initiation and WhatsApp opt-in/template/service-window rules are enforced.
- Disabling Bale does not interrupt Telegram, WhatsApp or in-app messaging.
- Direct contact and in-person visits remain possible; SARINA does not impose marketplace or channel exclusivity.
- No messaging event consumes AI credits.
