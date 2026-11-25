import {
  canUseAsSharedKnowledge,
  isEvidenceComparable,
  SAI_CASE_CONTRACT,
  SAI_CASE_CONTRACT_VERSION,
  validateSaiCaseEnvelope,
} from "../../../../src/lib/sai/evidence-contract.ts";
import type { SaiCaseEnvelope } from "../../../../src/lib/sai/evidence-contract.ts";

const baseCase: SaiCaseEnvelope = {
  contract: SAI_CASE_CONTRACT,
  contractVersion: SAI_CASE_CONTRACT_VERSION,
  caseId: "case-001",
  scope: {
    farmRef: "farm-ref-1", fieldRef: null, cropCycleRef: "cycle-1",
    cropCode: "date-palm", varietyCode: null, productionSystem: null,
    countryCode: "IR", regionCode: "south-khuzestan",
  },
  period: { startedAt: "2026-01-01T00:00:00Z", endedAt: null, timezone: "Asia/Tehran" },
  problem: { reportedDescription: "Leaf yellowing reported by farmer", symptoms: ["yellowing"], diagnoses: [] },
  evidence: [{
    evidenceId: "evidence-1", kind: "soil_test",
    source: { table: "soil_tests", recordRef: "opaque-1", sourceType: "laboratory" },
    observedAt: "2026-01-02T00:00:00Z", period: { start: null, end: null },
    value: {
      state: "present", original: 4.2, originalUnit: "dS/m",
      normalized: 4.2, normalizedUnit: "dS/m", qualifier: "measured",
    },
    quality: { label: "high", limitations: [] },
    review: { state: "approved", reviewerRef: "reviewer-1", reviewedAt: "2026-01-03T00:00:00Z" },
  }],
  interventions: [{
    interventionId: "action-1", description: "Irrigation adjustment",
    status: "planned", performedAt: null, evidenceRefs: [],
  }],
  recommendations: [{
    recommendationId: "rec-1", description: "Review irrigation water",
    issuedAt: "2026-01-02T00:00:00Z", issuerType: "specialist",
    sourceRef: "expert-note-1", risk: "medium",
  }],
  followUps: [{
    followUpId: "follow-1", observedAt: "2026-01-10T00:00:00Z",
    evidenceRefs: ["observation-1"], notes: null,
  }],
  outcome: {
    classification: "inconclusive", attribution: "unclear",
    attributionConfidence: null, evidenceQuality: "medium", causalClaimPermitted: false,
  },
  provenance: {
    assembledAt: "2026-01-10T00:00:00Z",
    assemblerVersion: "sai-evidence-assembler/0.1",
    sourceRefs: ["soil_tests:opaque-1"],
  },
  governance: {
    farmerConsent: "not_checked", expertConsent: "not_required",
    anonymization: "not_started", reviewState: "not_submitted",
    eligibleForSharedKnowledge: false,
  },
  quality: { completeness: 0.7, missingCriticalFields: [], warnings: [] },
};

function cloneCase(): SaiCaseEnvelope {
  return structuredClone(baseCase);
}

Deno.test("valid canonical case envelope passes validation", () => {
  const issues = validateSaiCaseEnvelope(baseCase);
  if (issues.length) throw new Error(JSON.stringify(issues));
});

Deno.test("missing values remain explicit and cannot be silently converted to zero", () => {
  const candidate = cloneCase();
  candidate.evidence[0].value = {
    state: "not_measured", original: null, originalUnit: null,
    normalized: null, normalizedUnit: null, qualifier: "reported",
  };
  const issues = validateSaiCaseEnvelope(candidate);
  if (issues.length) throw new Error(JSON.stringify(issues));
  const invalid = cloneCase();
  invalid.evidence[0].value = {
    state: "not_measured", original: 0, originalUnit: "dS/m",
    normalized: 0, normalizedUnit: "dS/m", qualifier: "measured",
  };
  if (!validateSaiCaseEnvelope(invalid).some((issue) => issue.code === "MISSING_VALUE_MUST_NOT_CONTAIN_NUMBER")) {
    throw new Error("missing value was allowed to contain zero");
  }
});

Deno.test("incompatible units are never considered comparable", () => {
  const left = { state: "present" as const, original: 1, originalUnit: "mg/L", normalized: 1, normalizedUnit: "mg/L", qualifier: "measured" as const };
  const right = { state: "present" as const, original: 1, originalUnit: "g/L", normalized: 1, normalizedUnit: "g/L", qualifier: "measured" as const };
  if (isEvidenceComparable(left, right)) throw new Error("incompatible units were treated as comparable");
  if (!isEvidenceComparable(left, { ...right, normalizedUnit: "mg/L" })) throw new Error("matching units were rejected");
});

Deno.test("planned work is distinct from a performed intervention", () => {
  const candidate = cloneCase();
  candidate.interventions[0].status = "performed";
  candidate.interventions[0].performedAt = null;
  if (!validateSaiCaseEnvelope(candidate).some((issue) => issue.code === "PERFORMED_INTERVENTION_REQUIRES_DATE")) {
    throw new Error("performed intervention without a date was accepted");
  }
});

Deno.test("unverified AI output cannot be approved as evidence", () => {
  const candidate = cloneCase();
  candidate.evidence[0].source.sourceType = "ai_generated_unverified";
  if (!validateSaiCaseEnvelope(candidate).some((issue) => issue.code === "UNVERIFIED_AI_OUTPUT_CANNOT_BE_APPROVED_AS_EVIDENCE")) {
    throw new Error("unverified AI output passed evidence review");
  }
});

Deno.test("shared knowledge requires consent, anonymization and approval", () => {
  const candidate = cloneCase();
  candidate.governance.eligibleForSharedKnowledge = true;
  if (!validateSaiCaseEnvelope(candidate).some((issue) => issue.code === "SHARED_KNOWLEDGE_GOVERNANCE_GATE_FAILED")) {
    throw new Error("shared knowledge gate was bypassed");
  }
  candidate.governance.farmerConsent = "granted";
  candidate.governance.anonymization = "completed";
  candidate.governance.reviewState = "approved";
  if (!canUseAsSharedKnowledge(candidate)) throw new Error("valid governed case was rejected");
});

Deno.test("unverified AI evidence blocks shared-knowledge promotion even with other approvals", () => {
  const candidate = cloneCase();
  candidate.governance.farmerConsent = "granted";
  candidate.governance.anonymization = "completed";
  candidate.governance.reviewState = "approved";
  candidate.governance.eligibleForSharedKnowledge = true;
  candidate.evidence[0].source.sourceType = "ai_generated_unverified";
  candidate.evidence[0].review.state = "unreviewed";
  candidate.evidence[0].review.reviewerRef = null;
  candidate.evidence[0].review.reviewedAt = null;
  if (!validateSaiCaseEnvelope(candidate).some((issue) => issue.code === "UNVERIFIED_AI_EVIDENCE_BLOCKS_SHARED_KNOWLEDGE")) {
    throw new Error("unverified AI evidence entered shared knowledge");
  }
});

Deno.test("causal claims are not allowed by the initial evidence contract", () => {
  const candidate = cloneCase();
  (candidate.outcome as unknown as { causalClaimPermitted: boolean }).causalClaimPermitted = true;
  if (!validateSaiCaseEnvelope(candidate).some((issue) => issue.code === "INVALID_OR_UNSAFE_OUTCOME_ASSESSMENT")) {
    throw new Error("unsupported causal claim was accepted");
  }
});

Deno.test("reversed time periods are rejected", () => {
  const candidate = cloneCase();
  candidate.period.endedAt = "2025-12-31T00:00:00Z";
  if (!validateSaiCaseEnvelope(candidate).some((issue) => issue.code === "CASE_PERIOD_REVERSED")) {
    throw new Error("reversed case period was accepted");
  }
});
