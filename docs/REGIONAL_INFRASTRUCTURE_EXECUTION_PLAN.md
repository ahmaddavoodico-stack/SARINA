# SARINA — Regional Infrastructure Execution Plan

Status: Approved architecture; implementation in staged preparation.  
Operating model: Regional autonomy + asynchronous, consent-governed synchronization.  
Current rule: Do not interrupt the existing production path. No DNS cutover, hosting purchase, user-data migration, or production deployment without a separately approved stage gate.

## 1. Approved architecture decisions

### 1.1 Two autonomous service regions
- Iran domestic region: reputable data centre physically inside Iran, with independently operable application hosting, database, authentication/session validation, object storage, DNS and required APIs. It must be reachable over the National Information Network during an international-internet outage; a server located in Iran alone does not prove this.
- International region: separate country, domain, hosting environment, database, authentication/session validation and object storage. Country/provider selection remains an evidence-based comparison.
- Each region continues core services for its own users during an inter-region network partition.
- Current Vercel/Supabase path remains untouched while replacement infrastructure is built and tested in isolation.

### 1.2 Data ownership and selective synchronization
- Do not replicate the entire database between countries.
- Every user, farm and consultation case has an explicit authoritative home region.
- The home region is the write authority for that record. Do not infer ownership from transient IP address or browser locale.
- Transfer only minimum fields/events required for a specific service purpose, and only when lawful, security-reviewed and covered by current, explicit, revocable consent from relevant data subject(s).
- Consent is scoped by subject, source region, target region, purpose and permitted data categories; record consent text/version, grant, expiry and revocation.
- Revocation blocks future outbound synchronization. Receiving region must honor revocation and applicable retention/deletion obligations.
- No blanket replication of private conversations, attachments, identity documents, credentials, precise location or other sensitive content. Such categories require separate explicit purpose, consent and legal/security review.
- Use append-only event/outbox approach with stable event IDs, schema versions, idempotency, bounded retries/backoff, dead-letter handling, audit records and deterministic conflict rules.
- Re-check active consent immediately before dispatch and before applying an inbound event. A queued event is not authorization to transfer.
- Use encryption in transit and at rest; keep keys and provider credentials in regional secret stores. Never put secrets in Git or client-readable tables.
- Prefer event metadata and minimum-necessary projections over copying whole source rows. Exclude raw message bodies and file contents by default.
- Each region owns its writes while disconnected. Do not use naive multi-master database replication. Conflicts must be explicit and resolved by field-level policy; never silently overwrite a home-region write.

### 1.3 Identity and case continuity
- Preserve stable SARINA UUIDs for users, farms and cases across regions.
- Authentication and session validation must work locally within each region without a live dependency on a foreign identity service.
- Cross-region access is not automatically granted by data ownership. It requires role-based authorization, case assignment/relationship and relevant consent.
- A user may have a home region while a particular consultation case has its own explicit owner region; case region must be set deliberately.

### 1.4 Offline-first farmer experience
- PWA shell caching is not sufficient. Plan encrypted IndexedDB persistence for approved local records and a durable offline mutation queue.
- Store only minimum required offline data on device; protect it with device-bound keys where supported, expire sensitive cached records, and provide logout/device revocation behavior.
- Queue writes with client-generated idempotency IDs, schema versions and conflict metadata. Sync when connectivity returns.
- Clearly distinguish saved locally, synchronized and conflict/error states in UI.
- Never cache credentials, provider tokens or unrestricted sensitive documents in browser storage.

### 1.5 Service independence and fallbacks
- Core farm records, local calculations, consultation history permitted in-region and essential account workflows must not depend on foreign AI APIs.
- AI is optional. If external AI is unavailable, show a clear limitation and keep ordinary farm management and communication operating.
- Identify and replace/cache/fallback all external dependencies required for domestic operation: Supabase services, Vercel hosting, authentication, storage, CDN, DNS, maps, weather/soil APIs, SMS/OTP and external messaging providers.
- Cache versioned, attributable regional weather/soil/reference snapshots where licensing permits; expose source date, spatial resolution and uncertainty.
- Bale can be a domestic communications adapter only if Bale itself and its network path remain reachable; the bot alone does not guarantee domestic availability.

## 2. Hosting and domain procurement checklist

### Iran provider (shortlist only; no provider selected)
Evaluate at least two reputable providers/data centres. Candidate names from preliminary research are leads, not endorsements. Require written evidence for:
- Physical data-centre location and legal entity/ownership.
- NIN reachability and DNS resolution from multiple Iranian ISPs, including a real international-connectivity interruption test.
- Two independent upstream network paths, DDoS mitigation, redundant power/UPS/generators and documented incident history.
- Written uptime SLA, exclusions, service credits, 24/7 incident response and escalation path.
- Backup retention, off-site backup location, restore time objective (RTO) and recovery point objective (RPO).
- Managed database/object storage options, private networking, firewall controls, encryption and audit logs.
- Data processing terms, access controls, staff access, data export and secure deletion terms.
- Independent local disaster recovery: a second domestic site or independently restorable encrypted backups. A foreign server is not a substitute for domestic DR during a network partition.

### International country/provider comparison
Compare Germany/Frankfurt, UAE (Dubai/Abu Dhabi), Turkey and other credible candidates against:
- Target-user latency and network routes from main customer markets.
- Data residency, privacy law, cross-border transfer obligations and provider/subprocessor terms.
- Sanctions/export-control screening, contracting and lawful payment availability; do not use workarounds to evade restrictions.
- Availability zones, power/network resilience, managed database and object storage, backups and support.
- Regional availability of authentication, email/SMS, CDN, maps and required APIs.
- Total cost at realistic traffic/storage/egress levels, not only introductory VM price.
- Ability to export data and restore independently.
No country is final until written provider terms, legal review, latency tests and restore tests are complete.

### Domain and DNS
- Plan separate domestic and international domains or clearly separated regional hostnames.
- Domestic DNS must resolve through resolvers reachable inside the NIN; do not make a foreign DNS/CDN the only path for Iran.
- Validate registration, ownership, renewal, DNSSEC, certificate issuance/renewal and registrar control.
- Test both domains from several Iranian ISPs and external markets before any traffic change.
- Keep old domains and routing available during a staged rollback window.

## 3. Database preparation and rollout

### Additive schema preparation
- Maintain stable UUIDs and add explicit region ownership to users, farms and consultation cases.
- Keep ownership fields nullable during preparation. Do not bulk-assign existing accounts from IP address or unverified country data.
- Add a controlled region registry, scoped transfer-consent records, a server-only synchronization outbox and a server-only inbox with idempotent event identity.
- Keep all sync control tables inaccessible to browser roles. Only trusted regional services may use them.
- Before enabling workers, implement field allowlists, consent revalidation, schema validation, payload minimization, authenticated inter-region transport, replay protection and audit.
- First schema stage is structural only: it does not replicate data, activate workers or change the current app read/write path.

### Before farmer pilot
- Decide onboarding rule for home-region assignment using verified residency/service-region policy, not IP alone.
- Add safe server-side assignment and immutability/transfer workflow; test user, farm and case ownership consistency.
- Define case-level consent for every participant where applicable.
- Define event contracts, data categories, conflict rules, retention and deletion propagation.
- Build admin visibility for region assignment, consent status, queue health and failed/conflicted sync events without exposing sensitive payloads.
- Run migration tests on a restored staging copy, then security and RLS advisors.
- Ensure current users with unknown ownership are explicitly resolved before regional routing is enabled.

## 4. Backup, restore and migration gates
Before any production data migration:
1. Capture full backup of schema, data, roles/grants, extensions, Auth configuration, Storage objects, Edge Functions, secrets inventory and scheduled jobs.
2. Recover missing migration history and reconcile production schema with repository migrations.
3. Restore into isolated environment and verify counts, constraints, indexes, RLS, functions, storage objects and login flows.
4. Run consistency checks and application acceptance tests against restored environment.
5. Document RPO/RTO and perform a timed restore drill.
6. Only then prepare a migration/cutover runbook with rollback plan.
No production cutover until all gates pass and the user approves the specific cutover.

## 5. Phased implementation

| Phase | Work | Exit criteria |
|---|---|---|
| 0 — Preserve current service | Inventory dependencies, backup/restore, security triage | Verified baseline and recoverable backup |
| 1 — Schema foundation | Region registry, nullable ownership fields, consent ledger, sync inbox/outbox | Migration verified; no client exposure; no routing change |
| 2 — Local domestic stack | Deploy isolated app/auth/db/storage/DNS in Iran | NIN reachability and core workflow tests pass |
| 3 — International stack | Deploy isolated international environment | External-market tests, residency/legal checks and restore pass |
| 4 — Regional sync | Event allowlists, consent checks, idempotent workers, conflict handling | Partition/recovery/replay/security tests pass |
| 5 — Offline PWA | Encrypted local persistence and durable mutation queue | Device loss/logout/conflict/offline tests pass |
| 6 — Controlled pilot | Small invited cohort and feature flags | Monitoring stable; rollback tested |
| 7 — Gradual expansion | Increase cohorts and service scope | Reliability and support capacity demonstrated |

## 6. Operational acceptance tests
- Simulate international connectivity loss from several Iranian ISP paths; domestic users can sign in and use core services.
- Simulate inter-region partition; each region continues its own writes without data loss.
- Restore connectivity; only consented allowlisted events synchronize.
- Revoke consent while events are queued; queued events are blocked before dispatch.
- Replay same event repeatedly; no duplicate effects occur.
- Deliver events out of order; version/conflict rules prevent stale overwrite.
- Attempt unauthorized cross-region reads/writes; access is denied and audited.
- Stop foreign AI, maps, weather, messaging or CDN dependencies individually; core domestic services remain available with clear fallbacks.
- Restore from backup into a clean environment and verify RPO/RTO.
- Confirm ordinary messaging remains independent from AI credit and provider outages.

## 7. Current known constraints and open decisions
- Existing frontend uses Supabase client services and current hosting; domestic path therefore needs independent auth, database, storage and application hosting.
- Existing PWA caches application shell/static assets but does not yet provide a durable offline business-data queue.
- Current Supabase project is in Seoul; it is not the domestic Iran data plane.
- Some current Edge Functions depend on external weather/soil services; local snapshots/fallbacks are required.
- Existing backup/restore and missing-migration-history gaps must be resolved before full migration.
- Current provider/country candidates are provisional. Do not purchase infrastructure or switch DNS based on preliminary ranking alone.
- SARINA Connect provider routes remain separate and disabled until provider adapters, consent UI, secret management, workers and sandbox tests are complete.

## 8. Change-control rules
- Keep current production path intact while regional infrastructure is developed in isolation.
- Every schema change must be additive where practical, reviewed, tested on a restored copy and paired with rollback/forward-fix plan.
- Never activate cross-region synchronization merely because schema exists.
- Never transfer sensitive data without recorded legal basis, explicit scoped consent and documented retention/deletion rule.
- No hosting/domain purchase, DNS switch, production data migration, merge or deployment without explicit approval for that action.
