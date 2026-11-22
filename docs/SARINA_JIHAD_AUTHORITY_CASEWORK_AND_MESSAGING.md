# SARINA Jihad Authority Casework and Institutional Messaging

## Scope

This increment turns the existing authority lookup card into an operational organization workbench and adds code-addressed, in-app messaging between a verified public authority organization and an opted-in farmer or verified specialist.

## Authority workbench

The existing `JihadAuthorityWorkspace` remains mounted in the organization portal for active members of verified public-authority organizations. It now has three views:

- **Farmer requests**: reads the real `institutional_service_requests` rows visible to the organization and their event history. It supports controlled status transitions and official responses through `update_institutional_service_request`.
- **New message**: accepts either a farmer code (`SRN-...`) or specialist code (`EXP-...`), resolves the target server-side, shows only a limited name/type confirmation, and sends a message after the organization member explicitly submits it.
- **Correspondence**: lists the organization's message threads and history, and lets the organization send a further message.

The former static `JihadRegionalWorkspace` preview remains clearly marked as a demo; this workbench does not use its fabricated demo rows.

## Recipient identity and consent

### Farmers

- Existing `farmer_public_identifiers` and `SRN-...` codes are reused.
- Farmer consent UI now includes a separate `institutional_messaging` scope.
- Messaging requires an active, non-expired consent for the specific organization with both `identity_summary` and `institutional_messaging` scopes.
- The farmer may revoke consent through the existing farmer authority consent workflow.

### Specialists

- A verified, active expert can obtain an `EXP-...` public code through `ensure_my_expert_public_identifier()`.
- Expert code issuance is unavailable before profile verification.
- The specialist inbox exposes the code and an explicit, revocable 90-day opt-in for messages from verified public institutions.
- Expert consent is separate from public profile visibility; a verified profile alone does not authorize institutional messaging.

## Messaging and security model

- `institutional_message_threads` and `institutional_messages` are new RLS-protected tables.
- Direct INSERT/UPDATE privileges are not granted for messages or threads. Writes use guarded RPCs.
- `lookup_institutional_message_recipient` and `send_institutional_message` resolve codes server-side and enforce:
  - authenticated SARINA user;
  - verified government/regulator/support-agency/public-institution organization;
  - active organization membership;
  - enabled `communications.send` capability and matching geographic scope;
  - active recipient account and valid public code;
  - explicit, active, non-expired recipient consent.
- Organization thread/message reads require `communications.read` plus the same organization scope. Recipients can read their own threads and reply through `reply_institutional_message`.
- `mark_institutional_thread_read` only permits the recipient to mark incoming messages as read.
- Lookup decisions, outgoing messages, replies, and case status updates are written to `institutional_access_audit_events`.
- No phone number, email, farm detail, or full profile is exposed by code lookup.
- The first release is **in-app SARINA messaging only**. It does not claim live delivery through Bale, Telegram, SMS, or another external provider.

## Casework status transitions

`update_institutional_service_request` permits only the defined organization workflow states and validates each transition from the current state. It checks `service.requests.manage` and organization geographic scope server-side, updates the request, writes an event visible to the farmer, and adds an audit event. Closed requests (completed, rejected, withdrawn) cannot be modified.

## Required organization provisioning

The live project currently has no verified authority organization or active organization member, and no organization capability rows. The following capability codes must be explicitly enabled for a real verified authority during the separate organization provisioning step:

- `service.requests.manage`
- `communications.send`
- `communications.read`

The organization must also receive only its verified geographic scope. Do not seed a fake Jihad organization, member, scope, country, region, farmer, expert, or message to make the dashboard appear populated.

## Current live data readiness

At implementation time:
- verified authority organizations: 0
- active organization members: 0
- organization capability rows: 0
- farmer public identifiers: no operational recipient records available for end-to-end proof
- expert profiles: 1 total, 0 verified directory-eligible
- countries and farms: 0
- institutional service requests and message threads: no real pilot records

The UI and database paths are implemented, but no authenticated organization-to-recipient send/reply test can be honestly claimed until a real authority tenant, member, capabilities, official scope, and opted-in recipient exist.

## Acceptance criteria

1. A farmer code can resolve only for a farmer with organization-specific active messaging consent.
2. An expert code can resolve only for a verified specialist with active public-institution messaging consent.
3. The same input accepts SRN and EXP code formats without mixing recipient types.
4. No code lookup reveals contact details or full farmer/expert records.
5. An organization outside the target's geographic scope cannot resolve or message the target.
6. A recipient can see, read, and reply to an in-app thread; revoked/expired consent blocks subsequent organization messages.
7. Status updates use the permitted transition graph and appear in farmer-visible event history.
8. All sensitive actions have audit records; no fake operational data is introduced.
