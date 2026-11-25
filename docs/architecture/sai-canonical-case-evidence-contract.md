# SAI Canonical Case & Evidence Contract

**Contract version:** 1.0.0-draft  
**Status:** Proposed application-level contract for Phase 0/1; not a database schema  
**Owner:** SARINA / SCI  
**Security:** Read-only evidence assembly; least privilege; no external-provider direct access

## 1. Purpose

This contract defines the minimum evidence envelope required to reconstruct a farm case and later evaluate whether it is suitable for retrieval or knowledge review.

It is deliberately an application-level contract first. It does not authorize a migration, a new table, a vector index, or a change to existing RLS policies. Existing SARINA tables remain the source of truth.

## 2. Contract invariants

1. Every evidence item has a stable source reference and source type.
2. Original value, normalized value and unit are never silently conflated.
3. Missing, unknown, not measured, not applicable and withheld are distinct states.
4. Farmer-reported, measured, laboratory, official, remote-estimate, modelled and inferred values remain distinguishable.
5. AI-generated text is untrusted until converted into a sourced fact and reviewed under the relevant policy.
6. Farm, field and crop-cycle scope is explicit. A missing field/cycle is not silently treated as a global match.
7. Timestamps include timezone or a documented date-only meaning.
8. A case is not eligible for knowledge promotion merely because it is complete or has a positive outcome.
9. Consent, anonymization and reviewer authority are evaluated separately from agronomic quality.
10. The envelope contains references and authorized excerpts only; it must not leak another farm's private data.

## 3. Envelope shape

The following JSON is illustrative and normative for field meanings, not a committed API response or persisted row.

```json
{
  "contract": "sarina.sai.case",
  "contract_version": "1.0.0",
  "case_id": "stable-derived-case-id",
  "scope": {
    "farm_ref": "authorized-farm-reference",
    "field_ref": null,
    "crop_cycle_ref": "authorized-crop-cycle-reference",
    "crop_code": "crop-code",
    "variety_code": null,
    "production_system": null,
    "country_code": null,
    "region_code": null
  },
  "period": {
    "started_at": "2026-01-01T00:00:00Z",
    "ended_at": null,
    "timezone": "Asia/Tehran"
  },
  "context": {
    "soil": [],
    "water": [],
    "climate": [],
    "crop_stage": [],
    "management": []
  },
  "problem": {
    "reported_description": "source-backed description",
    "symptoms": [],
    "diagnoses": []
  },
  "interventions": [],
  "recommendations": [],
  "followups": [],
  "outcome": {
    "classification": "insufficient_evidence",
    "attribution": "unclear",
    "evidence_quality": "unknown",
    "causal_claim_permitted": false
  },
  "provenance": {
    "assembled_at": "2026-11-25T00:00:00Z",
    "assembler_version": "sai-evidence-assembler/0.1",
    "source_refs": []
  },
  "governance": {
    "farmer_consent": "not_checked",
    "expert_consent": "not_checked",
    "anonymization": "not_started",
    "review_state": "not_submitted",
    "eligible_for_shared_knowledge": false
  },
  "quality": {
    "completeness": 0.0,
    "missing_critical_fields": [],
    "warnings": []
  }
}
```

## 4. Evidence item

All context, diagnosis, intervention, recommendation and follow-up values should use a common evidence shape where possible:

```json
{
  "evidence_id": "stable-evidence-id",
  "kind": "soil_test",
  "source": {
    "table": "soil_tests",
    "record_ref": "opaque-record-reference",
    "source_type": "laboratory",
    "reported_by_ref": null
  },
  "observed_at": "2026-05-01T10:00:00Z",
  "period": {
    "start": null,
    "end": null
  },
  "value": {
    "original": 4.2,
    "original_unit": "dS/m",
    "normalized": 4.2,
    "normalized_unit": "dS/m",
    "qualifier": "measured"
  },
  "method": {
    "name": null,
    "depth": null,
    "laboratory": null
  },
  "quality": {
    "label": "medium",
    "confidence": null,
    "limitations": []
  },
  "review": {
    "state": "unreviewed",
    "reviewer_ref": null,
    "reviewed_at": null
  }
}
```

Allowed source categories should align with the source enums already used by SARINA where possible: `farmer_reported`, `measured`, `laboratory`, `official`, `remote_estimate`, `modelled`, `inferred`. Do not collapse them into a single generic confidence value.

## 5. Intervention and recommendation separation

The contract must distinguish:

- **Recommendation:** what SARINA or a specialist advised.
- **Plan:** what was intended.
- **Intervention/action:** what the farmer or operator actually did.
- **Follow-up:** what was measured or observed afterward.
- **Outcome review:** the reviewed interpretation of change and attribution.

A planned fertilizer application is not proof that fertilizer was applied. A completed action status is useful but should be supported by farmer confirmation, application records, photos, invoices or other evidence where the task requires it. A positive metric movement does not by itself prove the intervention caused the change.

## 6. Quality and eligibility gates

The evidence assembler should return a case even when incomplete, but must label its limitations. It must not manufacture defaults for missing evidence.

### Minimum technical validation
- Valid source reference and authorization for every included record.
- Valid timestamp/date and coherent observation period.
- Numeric values have units; incompatible units are not aggregated.
- Farm/field/crop-cycle references are mutually consistent.
- Duplicate source records are removed without discarding provenance.
- Source category and quality label are preserved.
- Critical missing fields are explicitly listed.
- Inferred/modelled values are never relabelled as measured.

### Knowledge-candidate eligibility
A case can be proposed for human review only after:
- The source records are authorized for this purpose.
- Farmer consent and required expert consent are recorded.
- Required anonymization is completed and checked.
- Evidence quality and context coverage meet task-specific thresholds.
- Contradictions and known confounders are disclosed.
- The proposed knowledge unit includes applicability limits and exclusions.

Approval is a separate human governance decision. A quality score must not automatically publish knowledge.

## 7. Retrieval result contract

A retrieval result should include:
- Case/knowledge reference and version.
- Match dimensions and their individual contribution.
- Important differences from the current farm.
- Missing context and exclusions.
- Evidence quality and review state.
- Validity/expiry and deprecation state.
- Why the result was included and why alternatives were excluded.

Similarity is a ranking signal, not proof of agronomic equivalence. Retrieval must first apply hard safety and scope filters, then rank eligible cases.

## 8. Initial typed domain model

The first implementation should represent these types in code and tests, without creating new database tables:

- `SaiCaseEnvelope`
- `SaiFarmScope`
- `SaiEvidenceItem`
- `SaiMeasurementValue`
- `SaiIntervention`
- `SaiRecommendation`
- `SaiFollowUp`
- `SaiOutcomeAssessment`
- `SaiGovernanceState`
- `SaiRetrievalMatch`

All fields that can be absent must be nullable/optional with explicit missing-state semantics. Avoid permissive `any` payloads at the trust boundary.

## 9. Compatibility and versioning

- Contract versions use semantic versioning.
- Additive optional fields may be minor revisions.
- Changes to field meaning, enum semantics or authorization scope require a major version.
- Every assembled case records its contract version and assembler version.
- Historical evidence is not silently rewritten when normalization rules change; derived envelopes can be rebuilt with a new version while retaining source provenance.

## 10. Required tests before read integration

1. Unauthorized farm reference is rejected and produces no partial data leak.
2. A valid farmer can assemble only their authorized farm scope.
3. A specialist can assemble only the case scope assigned/authorized to them.
4. A null field or crop-cycle reference is not broadened into an unrestricted match.
5. Mixed units are not averaged or compared.
6. Missing observations remain missing, not zero.
7. Model-generated text is tagged untrusted and cannot pass knowledge approval.
8. Planned action and performed intervention remain distinct.
9. Consent revocation prevents future shared-knowledge use under the approved policy.
10. An anonymized case retains traceable internal provenance while excluding direct identifiers from the shared representation.
11. A failed or inconclusive outcome remains retrievable as a failure/uncertainty case.
12. Retrieval exposes differences, exclusions and evidence quality, not only a similarity score.

## 11. Implementation boundary

The next code task is to implement these types and pure validation functions in a testable shared module, then build a read-only assembler using existing authenticated data-access patterns. Do not add a migration or expose a new endpoint until the RLS/grant audit and contract tests pass.

**Decision:** existing farm and productivity tables remain canonical. SAI owns the versioned evidence contract, quality gates, retrieval metadata and approved knowledge lifecycle—not a duplicate copy of the farm database.
