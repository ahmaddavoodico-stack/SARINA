# Agricultural Support Evidence & Utilization — Phase 2

**Status:** Database and access-control foundation prepared for review; migrations have not been applied to the live database.
**Depends on:** PR #98 / `feat/agricultural-support-ledger-phase1`.
**Implementation branch:** `feat/agricultural-support-evidence-phase2`.

## 1. Design decision

Reuse the existing private `farmer-documents` Storage bucket and `farm_documents` metadata table. Do not create a parallel evidence bucket or a second document registry.

A farmer explicitly links an existing document to a particular support allocation. Only after that link exists may an authorized issuing organization read that document, and only while its support-allocation capability and farm/geographic scope allow access.

Unlinked documents remain private to their farmer. An organization does not receive blanket access to a farmer's document folder.

## 2. Database and policy changes

### New relation

`farm_support_allocation_documents` links:
- one support allocation;
- one existing `farm_documents` row;
- the farmer who attached it;
- attachment timestamp and optional note.

The link is unique per allocation/document pair and append-only for client roles. The attachment helper verifies that the allocation and document belong to the same farm and that the authenticated user is both the farm owner and document uploader.

### Document and Storage access

- Add a farmer-owned insert policy for evidence links.
- Add participant read access for the farmer and an organization that can already read the linked allocation.
- Add a narrow `farm_documents` SELECT policy so an organization can see metadata only for linked evidence.
- Add a narrow private Storage SELECT policy for only the linked object in `farmer-documents`.
- Keep the bucket private; do not expose public URLs.
- Prevent deletion of linked evidence through the farmer Storage delete policy and the document foreign key. A correction workflow must create a new record rather than silently erasing evidence.

### Utilization reports

Extend `farm_support_allocation_events` with `utilization_reported` and a controlled `disposition_code`:
- `used_as_intended`
- `stored_for_later`
- `returned`
- `damaged_or_expired`
- `transferred_authorized`
- `other`

A farmer can append a utilization event with quantity, allocation unit, disposition and note. These are farmer-reported statements, not verified proof or a legal finding. The system does not infer misconduct from missing evidence or a reported transfer.

## 3. Related Storage RLS defect discovered and fixed in this branch

A role-switched query of `storage.objects` exposed a pre-existing recursive RLS path in the expert voice policies:

`storage.objects` → `expert_request_assignments` → `expert_requests` → `expert_request_assignments`.

This could cause Storage object queries to fail even when the requested bucket was unrelated to expert voice. The migration `20261122001500_fix_expert_voice_storage_rls_recursion.sql` replaces the direct joins in the expert voice read/upload/delete policies with a boolean-only helper in the non-Data-API `sarina_internal` schema. The helper uses a fixed search path and returns no consultation data.

This is a targeted security/availability correction required to make private document access dependable. It does not change who is entitled to access expert voice files; it preserves the existing requester/verified-assignee rule.

## 4. Verification performed

The Phase 1 migration, the expert-voice Storage RLS correction, and the Phase 2 evidence migration were executed together against the linked PostgreSQL 17 project inside one explicit transaction followed by `ROLLBACK`.

The static privilege tests and role-switched behavior tests completed without exception. Synthetic test data verified:
- the in-scope organization can read the linked document and its private Storage object;
- the same organization cannot read an unlinked document from that farmer's folder;
- a farmer can attach only their own document to their own allocation;
- a farmer cannot link another farmer's document;
- two farmers see only their own documents and allocations;
- an unrelated user sees no evidence;
- a farmer can append a utilization event;
- linked evidence metadata cannot be deleted because the relationship is retained.

The Storage object read test also exercised the corrected expert voice policies and completed without the prior recursion error.

A post-rollback read-only check must still confirm no tables, policies or helper functions remain in the live database. No production migration or file upload was performed by this branch.

## 5. Not yet included

- Farmer-facing UI for allocation details, document attachment, acknowledgement, dispute and utilization reporting.
- Organization workspace for reviewing attached evidence and responding to disputes.
- Organization-issued delivery document uploads; this phase covers farmer-uploaded evidence only.
- File-level malware scanning, document OCR, evidence quality scoring and retention workflow.
- Support-specific purpose consent for broader productivity monitoring or compliance review.
- Human discrepancy case management and production expectations.

The existing farmer upload flow currently accepts PDF, JPEG and PNG up to 10 MB. This phase preserves those limits.

## 6. Release gates

1. Review the Storage RLS changes and helper function.
2. Run migrations and tests from a clean disposable database.
3. Run a Storage API signed-URL/download test for an in-scope organization and verify denial for out-of-scope and unlinked documents.
4. Confirm that existing expert voice uploads/downloads still work for requesters and verified assigned experts.
5. Add farmer-facing and organization-facing UI only after Phase 1/2 migrations are approved and applied to the development environment.
6. Verify backup/restore and controlled migration rollout before production.
