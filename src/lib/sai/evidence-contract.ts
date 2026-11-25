export const SAI_CASE_CONTRACT = "sarina.sai.case" as const;
export const SAI_CASE_CONTRACT_VERSION = "1.0.0" as const;

export type SaiSourceType =
  | "farmer_reported"
  | "measured"
  | "laboratory"
  | "official"
  | "remote_estimate"
  | "modelled"
  | "inferred"
  | "ai_generated_unverified";

export type SaiValueState =
  | "present"
  | "missing"
  | "unknown"
  | "not_measured"
  | "not_applicable"
  | "withheld";

export type SaiEvidenceQuality = "high" | "medium" | "low" | "unknown";
export type SaiReviewState = "unreviewed" | "in_review" | "approved" | "rejected";
export type SaiOutcomeClass =
  | "positive"
  | "negative"
  | "mixed"
  | "no_change"
  | "inconclusive"
  | "insufficient_evidence";
export type SaiAttribution =
  | "strongly_supported"
  | "partially_supported"
  | "unclear"
  | "not_attributable";

export interface SaiFarmScope {
  farmRef: string;
  fieldRef: string | null;
  cropCycleRef: string | null;
  cropCode: string;
  varietyCode: string | null;
  productionSystem: string | null;
  countryCode: string | null;
  regionCode: string | null;
}

export interface SaiMeasurementValue {
  state: SaiValueState;
  original: number | string | null;
  originalUnit: string | null;
  normalized: number | string | null;
  normalizedUnit: string | null;
  qualifier: "measured" | "reported" | "estimated" | "modelled" | "inferred";
}

export interface SaiEvidenceItem {
  evidenceId: string;
  kind: string;
  source: {
    table: string;
    recordRef: string;
    sourceType: SaiSourceType;
  };
  observedAt: string | null;
  period: { start: string | null; end: string | null };
  value: SaiMeasurementValue | null;
  quality: {
    label: SaiEvidenceQuality;
    limitations: string[];
  };
  review: {
    state: SaiReviewState;
    reviewerRef: string | null;
    reviewedAt: string | null;
  };
}

export interface SaiIntervention {
  interventionId: string;
  description: string;
  status: "planned" | "performed" | "partially_performed" | "not_performed" | "unknown";
  performedAt: string | null;
  evidenceRefs: string[];
}

export interface SaiRecommendation {
  recommendationId: string;
  description: string;
  issuedAt: string;
  issuerType: "sarina" | "specialist" | "external_provider";
  sourceRef: string;
  risk: "low" | "medium" | "high" | "critical";
}

export interface SaiFollowUp {
  followUpId: string;
  observedAt: string;
  evidenceRefs: string[];
  notes: string | null;
}

export interface SaiOutcomeAssessment {
  classification: SaiOutcomeClass;
  attribution: SaiAttribution;
  attributionConfidence: number | null;
  evidenceQuality: SaiEvidenceQuality;
  causalClaimPermitted: false;
}

export interface SaiGovernanceState {
  farmerConsent: "not_checked" | "granted" | "denied" | "revoked";
  expertConsent: "not_required" | "not_checked" | "granted" | "denied" | "revoked";
  anonymization: "not_started" | "in_progress" | "completed" | "failed";
  reviewState: "not_submitted" | "pending" | "approved" | "rejected" | "restricted";
  eligibleForSharedKnowledge: boolean;
}

export interface SaiCaseEnvelope {
  contract: typeof SAI_CASE_CONTRACT;
  contractVersion: typeof SAI_CASE_CONTRACT_VERSION;
  caseId: string;
  scope: SaiFarmScope;
  period: {
    startedAt: string;
    endedAt: string | null;
    timezone: string;
  };
  problem: {
    reportedDescription: string;
    symptoms: string[];
    diagnoses: string[];
  };
  evidence: SaiEvidenceItem[];
  interventions: SaiIntervention[];
  recommendations: SaiRecommendation[];
  followUps: SaiFollowUp[];
  outcome: SaiOutcomeAssessment;
  provenance: {
    assembledAt: string;
    assemblerVersion: string;
    sourceRefs: string[];
  };
  governance: SaiGovernanceState;
  quality: {
    completeness: number;
    missingCriticalFields: string[];
    warnings: string[];
  };
}

export interface SaiValidationIssue {
  code: string;
  field?: string;
}

const SOURCE_TYPES: readonly SaiSourceType[] = [
  "farmer_reported", "measured", "laboratory", "official",
  "remote_estimate", "modelled", "inferred", "ai_generated_unverified",
];
const VALUE_STATES: readonly SaiValueState[] = [
  "present", "missing", "unknown", "not_measured", "not_applicable", "withheld",
];
const QUALITY: readonly SaiEvidenceQuality[] = ["high", "medium", "low", "unknown"];
const REVIEW: readonly SaiReviewState[] = ["unreviewed", "in_review", "approved", "rejected"];

export function isSaiRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validValue(value: unknown, field: string, issues: SaiValidationIssue[]): void {
  if (!isSaiRecord(value)) {
    issues.push({ code: "INVALID_MEASUREMENT_VALUE", field });
    return;
  }
  const state = value.state;
  if (!VALUE_STATES.includes(state as SaiValueState)) {
    issues.push({ code: "INVALID_VALUE_STATE", field: field + ".state" });
    return;
  }
  if (value.qualifier !== "measured" && value.qualifier !== "reported" &&
      value.qualifier !== "estimated" && value.qualifier !== "modelled" &&
      value.qualifier !== "inferred") {
    issues.push({ code: "INVALID_VALUE_QUALIFIER", field: field + ".qualifier" });
  }
  for (const key of ["original", "normalized"] as const) {
    const item = value[key];
    if (item !== null && typeof item !== "string" && typeof item !== "number") {
      issues.push({ code: "INVALID_VALUE", field: field + "." + key });
    }
    if (typeof item === "number" && !Number.isFinite(item)) {
      issues.push({ code: "NON_FINITE_VALUE", field: field + "." + key });
    }
  }
  if (!nullableString(value.originalUnit) || !nullableString(value.normalizedUnit)) {
    issues.push({ code: "INVALID_UNIT", field });
  }
  if (state === "present") {
    if (value.original === null || !nonEmpty(value.originalUnit)) {
      issues.push({ code: "PRESENT_VALUE_REQUIRES_ORIGINAL_AND_UNIT", field });
    }
  } else if (value.original !== null || value.normalized !== null) {
    issues.push({ code: "MISSING_VALUE_MUST_NOT_CONTAIN_NUMBER", field });
  }
  if (typeof value.original === "number" && !nonEmpty(value.originalUnit)) {
    issues.push({ code: "NUMERIC_VALUE_REQUIRES_UNIT", field: field + ".originalUnit" });
  }
  if (typeof value.normalized === "number" && !nonEmpty(value.normalizedUnit)) {
    issues.push({ code: "NORMALIZED_VALUE_REQUIRES_UNIT", field: field + ".normalizedUnit" });
  }
}

function validateEvidence(item: unknown, index: number, issues: SaiValidationIssue[]): void {
  const field = "evidence[" + index + "]";
  if (!isSaiRecord(item)) {
    issues.push({ code: "INVALID_EVIDENCE_ITEM", field });
    return;
  }
  if (!nonEmpty(item.evidenceId) || !nonEmpty(item.kind)) {
    issues.push({ code: "EVIDENCE_ID_AND_KIND_REQUIRED", field });
  }
  if (!isSaiRecord(item.source) || !nonEmpty(item.source.table) ||
      !nonEmpty(item.source.recordRef) ||
      !SOURCE_TYPES.includes(item.source.sourceType as SaiSourceType)) {
    issues.push({ code: "INVALID_EVIDENCE_SOURCE", field: field + ".source" });
  }
  if (item.observedAt !== null && !validDate(item.observedAt)) {
    issues.push({ code: "INVALID_OBSERVED_AT", field: field + ".observedAt" });
  }
  if (!isSaiRecord(item.period) ||
      (item.period.start !== null && !validDate(item.period.start)) ||
      (item.period.end !== null && !validDate(item.period.end))) {
    issues.push({ code: "INVALID_EVIDENCE_PERIOD", field: field + ".period" });
  } else if (item.period.start && item.period.end &&
      Date.parse(String(item.period.start)) > Date.parse(String(item.period.end))) {
    issues.push({ code: "EVIDENCE_PERIOD_REVERSED", field: field + ".period" });
  }
  if (item.value !== null) validValue(item.value, field + ".value", issues);
  if (!isSaiRecord(item.quality) ||
      !QUALITY.includes(item.quality.label as SaiEvidenceQuality) ||
      !stringArray(item.quality.limitations)) {
    issues.push({ code: "INVALID_EVIDENCE_QUALITY", field: field + ".quality" });
  }
  if (!isSaiRecord(item.review) ||
      !REVIEW.includes(item.review.state as SaiReviewState) ||
      !nullableString(item.review.reviewerRef) ||
      (item.review.reviewedAt !== null && !validDate(item.review.reviewedAt))) {
    issues.push({ code: "INVALID_EVIDENCE_REVIEW", field: field + ".review" });
  }
  if (isSaiRecord(item.review) && item.review.state === "approved" &&
      (!nonEmpty(item.review.reviewerRef) || !validDate(item.review.reviewedAt))) {
    issues.push({ code: "APPROVED_EVIDENCE_REQUIRES_REVIEWER_AND_DATE", field: field + ".review" });
  }
  if (isSaiRecord(item.source) && item.source.sourceType === "ai_generated_unverified" &&
      isSaiRecord(item.review) && item.review.state === "approved") {
    issues.push({ code: "UNVERIFIED_AI_OUTPUT_CANNOT_BE_APPROVED_AS_EVIDENCE", field });
  }
}

export function validateSaiCaseEnvelope(value: unknown): SaiValidationIssue[] {
  if (!isSaiRecord(value)) return [{ code: "INVALID_CASE_ENVELOPE" }];
  const issues: SaiValidationIssue[] = [];
  if (value.contract !== SAI_CASE_CONTRACT || value.contractVersion !== SAI_CASE_CONTRACT_VERSION) {
    issues.push({ code: "UNSUPPORTED_CASE_CONTRACT", field: "contract" });
  }
  if (!nonEmpty(value.caseId)) issues.push({ code: "CASE_ID_REQUIRED", field: "caseId" });

  const scope = value.scope;
  if (!isSaiRecord(scope) || !nonEmpty(scope.farmRef) || !nonEmpty(scope.cropCode) ||
      !nullableString(scope.fieldRef) || !nullableString(scope.cropCycleRef) ||
      !nullableString(scope.varietyCode) || !nullableString(scope.productionSystem) ||
      !nullableString(scope.countryCode) || !nullableString(scope.regionCode)) {
    issues.push({ code: "INVALID_FARM_SCOPE", field: "scope" });
  }

  const period = value.period;
  if (!isSaiRecord(period) || !validDate(period.startedAt) ||
      (period.endedAt !== null && !validDate(period.endedAt)) || !nonEmpty(period.timezone)) {
    issues.push({ code: "INVALID_CASE_PERIOD", field: "period" });
  } else if (period.endedAt && Date.parse(period.startedAt) > Date.parse(period.endedAt)) {
    issues.push({ code: "CASE_PERIOD_REVERSED", field: "period" });
  }

  if (!isSaiRecord(value.problem) || !nonEmpty(value.problem.reportedDescription) ||
      !stringArray(value.problem.symptoms) || !stringArray(value.problem.diagnoses)) {
    issues.push({ code: "INVALID_PROBLEM_DESCRIPTION", field: "problem" });
  }

  if (!Array.isArray(value.evidence)) {
    issues.push({ code: "EVIDENCE_ARRAY_REQUIRED", field: "evidence" });
  } else {
    value.evidence.forEach((item, index) => validateEvidence(item, index, issues));
  }

  if (!Array.isArray(value.interventions)) {
    issues.push({ code: "INTERVENTIONS_ARRAY_REQUIRED", field: "interventions" });
  } else {
    value.interventions.forEach((item, index) => {
      const field = "interventions[" + index + "]";
      if (!isSaiRecord(item) || !nonEmpty(item.interventionId) ||
          !nonEmpty(item.description) ||
          !["planned", "performed", "partially_performed", "not_performed", "unknown"].includes(String(item.status)) ||
          (item.performedAt !== null && !validDate(item.performedAt)) ||
          !stringArray(item.evidenceRefs)) {
        issues.push({ code: "INVALID_INTERVENTION", field });
      }
      if (isSaiRecord(item) && item.status === "performed" && !validDate(item.performedAt)) {
        issues.push({ code: "PERFORMED_INTERVENTION_REQUIRES_DATE", field: field + ".performedAt" });
      }
    });
  }

  if (!Array.isArray(value.recommendations)) {
    issues.push({ code: "RECOMMENDATIONS_ARRAY_REQUIRED", field: "recommendations" });
  } else {
    value.recommendations.forEach((item, index) => {
      if (!isSaiRecord(item) || !nonEmpty(item.recommendationId) ||
          !nonEmpty(item.description) || !validDate(item.issuedAt) ||
          !["sarina", "specialist", "external_provider"].includes(String(item.issuerType)) ||
          !nonEmpty(item.sourceRef) ||
          !["low", "medium", "high", "critical"].includes(String(item.risk))) {
        issues.push({ code: "INVALID_RECOMMENDATION", field: "recommendations[" + index + "]" });
      }
    });
  }

  if (!Array.isArray(value.followUps)) {
    issues.push({ code: "FOLLOW_UPS_ARRAY_REQUIRED", field: "followUps" });
  } else {
    value.followUps.forEach((item, index) => {
      if (!isSaiRecord(item) || !nonEmpty(item.followUpId) ||
          !validDate(item.observedAt) || !stringArray(item.evidenceRefs) ||
          !nullableString(item.notes)) {
        issues.push({ code: "INVALID_FOLLOW_UP", field: "followUps[" + index + "]" });
      }
    });
  }

  const outcome = value.outcome;
  if (!isSaiRecord(outcome) ||
      !["positive", "negative", "mixed", "no_change", "inconclusive", "insufficient_evidence"].includes(String(outcome.classification)) ||
      !["strongly_supported", "partially_supported", "unclear", "not_attributable"].includes(String(outcome.attribution)) ||
      (outcome.attributionConfidence !== null &&
        (typeof outcome.attributionConfidence !== "number" ||
         !Number.isFinite(outcome.attributionConfidence) ||
         outcome.attributionConfidence < 0 || outcome.attributionConfidence > 1)) ||
      !QUALITY.includes(outcome.evidenceQuality as SaiEvidenceQuality) ||
      outcome.causalClaimPermitted !== false) {
    issues.push({ code: "INVALID_OR_UNSAFE_OUTCOME_ASSESSMENT", field: "outcome" });
  }

  const provenance = value.provenance;
  if (!isSaiRecord(provenance) || !validDate(provenance.assembledAt) ||
      !nonEmpty(provenance.assemblerVersion) || !stringArray(provenance.sourceRefs)) {
    issues.push({ code: "INVALID_PROVENANCE", field: "provenance" });
  }

  const governance = value.governance;
  if (!isSaiRecord(governance) ||
      !["not_checked", "granted", "denied", "revoked"].includes(String(governance.farmerConsent)) ||
      !["not_required", "not_checked", "granted", "denied", "revoked"].includes(String(governance.expertConsent)) ||
      !["not_started", "in_progress", "completed", "failed"].includes(String(governance.anonymization)) ||
      !["not_submitted", "pending", "approved", "rejected", "restricted"].includes(String(governance.reviewState)) ||
      typeof governance.eligibleForSharedKnowledge !== "boolean") {
    issues.push({ code: "INVALID_GOVERNANCE_STATE", field: "governance" });
  } else if (governance.eligibleForSharedKnowledge === true &&
      (governance.farmerConsent !== "granted" ||
       (governance.expertConsent !== "not_required" && governance.expertConsent !== "granted") ||
       governance.anonymization !== "completed" ||
       governance.reviewState !== "approved")) {
    issues.push({ code: "SHARED_KNOWLEDGE_GOVERNANCE_GATE_FAILED", field: "governance" });
  }
  if (governance.eligibleForSharedKnowledge === true && Array.isArray(value.evidence) &&
      value.evidence.some((item) => isSaiRecord(item) && isSaiRecord(item.source) &&
        item.source.sourceType === "ai_generated_unverified")) {
    issues.push({ code: "UNVERIFIED_AI_EVIDENCE_BLOCKS_SHARED_KNOWLEDGE", field: "evidence" });
  }

  const quality = value.quality;
  if (!isSaiRecord(quality) || typeof quality.completeness !== "number" ||
      !Number.isFinite(quality.completeness) || quality.completeness < 0 ||
      quality.completeness > 1 || !stringArray(quality.missingCriticalFields) ||
      !stringArray(quality.warnings)) {
    issues.push({ code: "INVALID_CASE_QUALITY", field: "quality" });
  }
  return issues;
}

export function canUseAsSharedKnowledge(value: unknown): boolean {
  if (validateSaiCaseEnvelope(value).length > 0 || !isSaiRecord(value) ||
      !isSaiRecord(value.governance)) return false;
  return value.governance.eligibleForSharedKnowledge === true;
}

export function isEvidenceComparable(left: SaiMeasurementValue, right: SaiMeasurementValue): boolean {
  if (left.state !== "present" || right.state !== "present") return false;
  if (!left.normalizedUnit || !right.normalizedUnit) return false;
  return left.normalizedUnit.trim().toLowerCase() === right.normalizedUnit.trim().toLowerCase();
}
