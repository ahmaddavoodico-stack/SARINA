# SARINA Regional Sync Engine

Status: database foundation and signed transport deployed to the current Seoul Supabase project; both logical regions remain `planned`. No traffic routing or cross-region data transfer is active.

## Runtime model

- `regional_sync_outbox` is the durable sender queue.
- `regional_claim_sync_outbox` claims rows concurrently with `FOR UPDATE SKIP LOCKED`, rechecks consent, and only dispatches when both regions are `active`.
- A planned/paused region holds queued events. It does not cause valid queued events to be cancelled.
- `sarina-regional-sync` dispatches events to the peer using HMAC-SHA256 signed requests with a five-minute timestamp window and one-time nonce.
- `regional_accept_sync_event` atomically validates scoped consent, blocks request replay, deduplicates event IDs, enforces monotonic aggregate versions, records conflicts, and updates a non-authoritative regional projection.
- `regional_record_sync_delivery` records acknowledgements, bounded retries and dead-letter state after 12 failed attempts.
- All sync control tables and RPCs are inaccessible to `anon` and `authenticated`; service-role access is required.

## Current event allowlist

| Aggregate | Event type | Consent category | Permitted projection fields |
|---|---|---|---|
| user | `user.profile_projection.upsert` | `profile_preferences` | `preferred_language`, `account_status` |
| farm | `farm.summary_projection.upsert` | `farm_summary` | `farm_name`, `total_area`, `area_unit`, `status` |
| consultation | `consultation.status_projection.upsert` | `consultation_status` | `consultation_mode`, `status`, `scheduled_start`, `scheduled_end` |

Reference-data transfer is deliberately rejected by the Edge Function until source/licence-specific field contracts are defined. Raw messages, attachments, identity documents, email, phone, precise location, credentials and whole source rows are not permitted in these projections.

Remote projections are not authoritative records and must never be used as a write source. The home region remains the only write authority for its records.

## Required regional secrets

Configure these independently in each region's Supabase Edge Function secrets. Never commit values to Git.

- `SARINA_REGION_CODE`: exactly `IR` or `INTL`.
- `REGIONAL_SYNC_TRIGGER_SECRET`: high-entropy secret (at least 32 characters) used by a trusted scheduler to invoke dispatch via `x-sarina-sync-trigger`.
- `REGIONAL_SYNC_PEER_HMAC_SECRET`: high-entropy shared peer key (at least 32 characters); the sender and receiver must use the same current key. Rotate deliberately on both sides.
- `REGIONAL_SYNC_PEER_URL`: the peer's full `/functions/v1/sarina-regional-sync` URL.
- `SUPABASE_SERVICE_ROLE_KEY`: server-side only; never expose to a browser.

The Edge Function is deployed with gateway JWT verification disabled because it implements its own two distinct authentication paths: a trigger secret for dispatch and timestamped HMAC for peer receive. It must not be called from the public client.

## Activation gates

1. Deploy an independent database, Auth/session validation, storage, application and DNS stack in the domestic region.
2. Deploy the independent international stack.
3. Configure and verify secrets and peer endpoint in both regions.
4. Verify both directions using synthetic non-personal records and test consent revocation, replay, duplicates, out-of-order delivery, partition recovery and dead-letter handling.
5. Configure a trusted scheduler to call `action: dispatch` with the trigger header.
6. Only after legal, security, backup/restore and NIN reachability checks, explicitly activate the region records.

No region has been activated by this change. The current Seoul project is not the Iran domestic data plane. No existing user/farm/case ownership was backfilled and no data has been transferred.

## Operational notes

- The current worker is request-driven; a trusted scheduler is still required for periodic dispatch.
- The receiver writes only to `regional_sync_projections`, not canonical `users`, `farms` or `expert_consultations`.
- Conflict rows are intentionally retained for an explicit policy/admin resolution workflow; no last-write-wins overwrite is performed.
- Nonce records are retained for ten minutes. Add a scheduled cleanup for expired nonces and a retention policy for audit/conflict records before sustained production traffic.
- The database migration history has two new entries: `regional_sync_engine_and_projections` and `regional_sync_worker_guardrails`. Keep the matching SQL migration files in source control and reconcile migration timestamps against the existing regional foundation migration before merging PR #42.

## Ownership audit

The database now contains a server-only `regional_entity_registry` populated from the actual public-schema tables, views and foreign-key relationships. Latest audit:

- 153 public entities inventoried.
- 100 classified by canonical owner or relationship.
- 53 remain `review_required`, with synchronization disabled.
- Only the three canonical aggregates (users, farms, consultations) are marked for the current allowlisted projection contracts.
- Farm-linked children inherit the farm's home region for routing, but this does not authorize row replication.
- Consultation/request records, AI conversations, messages, audio, documents, location permissions, communication logs, integration connections and service contracts remain local-only/restricted by default.
- Derived views are rebuilt locally and are never synchronized as rows.

The 53 unclassified entities are intentionally blocked from synchronization until their ownership, legal classification, retention and exact field allowlist are reviewed.
