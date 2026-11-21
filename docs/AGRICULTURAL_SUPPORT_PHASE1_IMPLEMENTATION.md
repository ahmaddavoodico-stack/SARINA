# Agricultural Support Ledger — Phase 1 Implementation Notes

**Status:** Implementation prepared for review; migration has not been applied to the live database.
**Related architecture:** PR #97 — Agricultural Support, Production Planning & Regional Forecasting.
**Implementation branch:** `feat/agricultural-support-ledger-phase1`

## Scope delivered in this phase

This phase establishes the secure data foundation for the first two workflow steps: authority-verified program registration and traceable farm-level support allocation.

### Database objects

- `agricultural_support_programs`: issuing organization, program code, jurisdiction and lifecycle state.
- `agricultural_support_program_versions`: versioned official terms, eligibility, conditions, evidence requirements, allowed dispositions, validity, source and legal basis.
- `farm_support_allocations`: approved support item and quantity linked to an issuing organization, farm and optional field/crop cycle.
- `farm_support_allocation_events`: append-only dispatch, delivery, return, acknowledgement, dispute and correction-note timeline.

No real programs, legal terms, eligibility rules, geographic codes or allocations are seeded.

## Security model

- All four tables have RLS enabled.
- No `anon` table privileges.
- Program registry writes are restricted to SARINA administrators.
- The migration extends the existing organization capability catalog with the two support-allocation capabilities; neither is automatically enabled for any organization.\n- A program version can be published only when the issuer is verified, legal basis and source reference are present, source verification is recorded, and the authenticated publisher is identified. The source verifier and publisher may be different authorized SARINA administrators.
- Published program versions are immutable; later changes require a new version.
- Allocation creation requires a verified issuing organization, an active program with a published version issued by that organization, an enabled `support.allocations.write` capability, and an applicable geographic/farm scope.
- Organization members must have explicit `support.allocations.read` or `support.allocations.write` capability and matching scope to read allocations.
- Farmers can read their own farm allocations and can append only `farmer_acknowledged` or `farmer_disputed` events.
- Authorized organization members can append delivery lifecycle events.
- Allocation and event rows are append-only for client roles. Corrections are represented as new events.
- Trigger-only validators are SECURITY DEFINER with an empty search path and fully qualified references; client roles cannot execute them directly.
- Small boolean authorization helpers live in the non-Data-API `sarina_internal` schema to avoid cross-table RLS recursion and do not return farm data.

## Capability provisioning

The migration intentionally does not grant new support capabilities to every organization. Before a pilot, an authorized SARINA administrator must enable only the appropriate capabilities on the verified organization and assign matching `organization_access_scopes` records:

- `support.allocations.read`
- `support.allocations.write`

The scope must be limited to the actual farm, farmer, country or explicitly authorized global jurisdiction. Do not grant a global scope merely to simplify onboarding.

## Current limitations / next phases

- This is a schema foundation, not an operational UI. No program registry page, allocation-entry page, farmer acknowledgement screen or authority dashboard is included yet.
- Official program terms and legal basis must be supplied and verified by the issuing authority before a real program is published.
- Evidence references are structured placeholders in the event ledger. Phase 2 must integrate them with private, object-authorized farmer/organization document storage; do not store public file URLs or arbitrary storage paths in `evidence_refs`.
- The first phase does not yet calculate production expectations, infer misuse, review discrepancies, or generate regional forecasts.
- Program creation and publication are currently central-admin controlled. A delegated authority publishing workflow requires a separate capability and approval design.
- Support-specific purpose consent and the review-case workflow must be designed before the system uses these records for broader farm monitoring or compliance follow-up.

## Verification performed

The migration and regression SQL were executed together against the linked PostgreSQL 17 project inside a single explicit transaction, followed by `ROLLBACK`. The regression assertions completed without exception. A subsequent read-only check confirmed that the new tables and internal helper function do not exist in the live database after rollback.

This validates SQL execution and metadata/grant assertions against the current live schema without changing it. It does not replace a clean local reset test, role-switched behavioral RLS tests, code review, backup verification or a controlled production migration.

## Release gates

1. Review the migration and RLS policy design.
2. Run the migration and regression script in an isolated development database from a clean baseline.
3. Add role-switched behavioral tests for farmer owner, unrelated farmer, in-scope organization, out-of-scope organization, unverified organization and SARINA admin.
4. Confirm the exact organization capability and scope provisioning process.
5. Confirm backup/restore and migration rollback/forward recovery plan.
6. Apply to the intended development environment only after review; do not seed real programs until official source documents and legal terms are verified.
