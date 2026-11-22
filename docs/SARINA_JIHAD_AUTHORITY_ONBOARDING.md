# SARINA Jihad Authority Onboarding

**Status:** Intake implementation; not an authority verification or tenant provisioning workflow yet.  
**Pilot:** Khuzestan → Abadan service hub → Abadan, Choebdeh, Arvandkenar.  
**First field location:** Choebdeh.

## Purpose

The existing commercial organization application workflow intentionally excludes government, regulator, support-agency and public-institution organization types. This module provides a separate intake path for public agricultural authorities without weakening that commercial workflow or self-verifying a government tenant.

## Request lifecycle

1. A signed-in SARINA user submits the authority's legal/display name, organization type, contact details, proposed administrator, service mandate reference, operational scope and official evidence documents.
2. Documents are stored in the private `authority-onboarding-documents` bucket. Object paths are owner-scoped by the authenticated account; administrators can read evidence for review.
3. The request is inserted into `authority_onboarding_requests` with status `pending_verification`. Applicant identity is derived from `current_sarina_user_id()`; it cannot be supplied for another user.
4. The applicant can read their own request. Only SARINA administrators can change review status or review notes.
5. A proposed administrator email is a claim to verify, not a membership invitation or authorization. Approval must bind the named individual to an existing/verified Auth account before creating `organization_members`.
6. No organization row, membership, capability, geographic scope, farmer access or dashboard data is created by submitting the form.

## Abadan pilot coverage

The form records the owner-approved operational service coverage:
- Khuzestan Province (استان خوزستان)
- Abadan service hub (مرکز خدمات آبادان)
- Abadan (آبادان)
- Choebdeh (چوئبده) — first pilot farm location
- Arvandkenar (اروندکنار)

These are requested service-coverage labels, not asserted administrative hierarchy or official geography codes. Official administrative levels/codes and the responsible Jihad service-center mandate must be validated independently before provisioning `organization_access_scopes`.

## Data protection

- RLS is enabled on the request table.
- Anonymous access is revoked.
- Authenticated applicants may insert their own pending request and read their own records.
- Only SARINA administrators may update review status and notes.
- Evidence bucket is private; uploads are limited to PDF/JPEG/PNG and 10 MiB per file.
- Storage object paths must be rooted in the authenticated user's Auth UUID.
- No service-role key or privileged credential is used in the browser.
- No public URL is created for legal evidence.

## Explicit non-goals in this slice

- No automatic approval.
- No creation of government organization, administrator or expert membership.
- No national-ID collection.
- No automatic official geography import.
- No creation of Abadan/Choebdeh/Arvandkenar region codes.
- No connection to Jihad or Ministry systems.
- No production claims or synthetic live records.

## Acceptance criteria

- A normal authenticated user can submit a pending authority request with at least one evidence file.
- A user cannot read another applicant's request or another user's private evidence.
- A user cannot approve their own request or alter review status.
- An administrator can read evidence and review the request.
- A proposed admin email does not grant access until separately matched to an authenticated account and approved.
- The request preserves all three pilot service locations and marks Choebdeh as the first field location.
