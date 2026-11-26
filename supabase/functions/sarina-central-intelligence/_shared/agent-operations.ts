/**
 * Pure SCI policy helpers for truthful agent health and exception-based review.
 *
 * These functions do not perform I/O, dispatch agents, or grant permissions.
 * Runtime telemetry and the admin console must consume real persisted signals;
 * callers must never manufacture a heartbeat or capability result.
 */

export type AgentLifecycleState =
  | "registered"
  | "enabled"
  | "paused"
  | "disabled"
  | "deprecated";

export type AgentRuntimeState =
  | "registered"
  | "ready"
  | "busy"
  | "responding"
  | "degraded"
  | "offline"
  | "unknown"
  | "paused"
  | "disabled"
  | "deprecated";

export type AgentHealth = "healthy" | "degraded" | "unavailable" | "unknown";

export type AgentOperationalStatus = {
  runtimeState: AgentRuntimeState;
  health: AgentHealth;
  reasonCode: string;
  heartbeatAgeMs: number | null;
};

function ageMs(timestamp: string | null, nowMs: number): number | null {
  if (!timestamp) return null;
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed) || parsed > nowMs + 30_000) return null;
  return Math.max(0, nowMs - parsed);
}

export function deriveAgentOperationalStatus(input: {
  lifecycleState: AgentLifecycleState;
  lastHeartbeatAt: string | null;
  heartbeatTtlMs: number;
  lastCapabilityCheckAt: string | null;
  capabilityCheckTtlMs: number;
  capabilityCheckOk: boolean | null;
  activeTaskCount: number;
  capacity: number | null;
  lastErrorAt: string | null;
  errorWindowMs: number;
  nowMs: number;
}): AgentOperationalStatus {
  const unavailable = (
    runtimeState: AgentRuntimeState,
    health: AgentHealth,
    reasonCode: string,
  ): AgentOperationalStatus => ({
    runtimeState,
    health,
    reasonCode,
    heartbeatAgeMs: ageMs(input.lastHeartbeatAt, input.nowMs),
  });

  if (input.lifecycleState === "registered") {
    return unavailable("registered", "unknown", "AGENT_NOT_ENABLED");
  }
  if (input.lifecycleState === "paused") {
    return unavailable("paused", "unavailable", "AGENT_PAUSED");
  }
  if (input.lifecycleState === "disabled") {
    return unavailable("disabled", "unavailable", "AGENT_DISABLED");
  }
  if (input.lifecycleState === "deprecated") {
    return unavailable("deprecated", "unavailable", "AGENT_DEPRECATED");
  }

  const heartbeatAgeMs = ageMs(input.lastHeartbeatAt, input.nowMs);
  if (heartbeatAgeMs === null) {
    return unavailable("unknown", "unknown", "NO_VALID_HEARTBEAT");
  }
  if (heartbeatAgeMs > input.heartbeatTtlMs) {
    return { runtimeState: "offline", health: "unavailable", reasonCode: "HEARTBEAT_STALE", heartbeatAgeMs };
  }

  const errorAgeMs = ageMs(input.lastErrorAt, input.nowMs);
  if (errorAgeMs !== null && errorAgeMs <= input.errorWindowMs) {
    return { runtimeState: "degraded", health: "degraded", reasonCode: "RECENT_RUNTIME_ERROR", heartbeatAgeMs };
  }

  const capabilityAgeMs = ageMs(input.lastCapabilityCheckAt, input.nowMs);
  if (input.capabilityCheckOk === false &&
      capabilityAgeMs !== null &&
      capabilityAgeMs <= input.capabilityCheckTtlMs) {
    return { runtimeState: "degraded", health: "degraded", reasonCode: "CAPABILITY_CHECK_FAILED", heartbeatAgeMs };
  }

  const capabilityFresh = input.capabilityCheckOk === true &&
    capabilityAgeMs !== null &&
    capabilityAgeMs <= input.capabilityCheckTtlMs;
  if (!capabilityFresh) {
    return { runtimeState: "responding", health: "unknown", reasonCode: "CAPABILITY_READINESS_NOT_CONFIRMED", heartbeatAgeMs };
  }

  if (input.activeTaskCount > 0 ||
      (input.capacity !== null && input.activeTaskCount >= input.capacity)) {
    return { runtimeState: "busy", health: "healthy", reasonCode: "ACTIVE_TASKS", heartbeatAgeMs };
  }

  return { runtimeState: "ready", health: "healthy", reasonCode: "HEARTBEAT_AND_CAPABILITIES_FRESH", heartbeatAgeMs };
}

export type ReviewRisk = "low" | "medium" | "high" | "critical";
export type ReviewDisposition = "automatic" | "human_review" | "blocked";

export type ReviewGateInput = {
  risk: ReviewRisk;
  qualityGatePassed: boolean;
  sourceTraceabilityPassed: boolean;
  evidenceQualityPassed: boolean;
  unresolvedConflict: boolean;
  essentialInputsMissing: boolean;
  legalRegulatoryAmbiguity: boolean;
  privacyBoundaryIssue: boolean;
  externalSideEffectRequested: boolean;
  saiKnowledgePromotionRequested: boolean;
  firstPilotOwnerReview: boolean;
};

export type ReviewGateResult = {
  disposition: ReviewDisposition;
  reasonCodes: string[];
};

export function classifyReviewDisposition(input: ReviewGateInput): ReviewGateResult {
  const reasons: string[] = [];

  if (input.privacyBoundaryIssue) {
    return { disposition: "blocked", reasonCodes: ["PRIVACY_BOUNDARY_VIOLATION"] };
  }
  if (input.externalSideEffectRequested) {
    return { disposition: "blocked", reasonCodes: ["EXPLICIT_AUTHORIZATION_REQUIRED_FOR_SIDE_EFFECT"] };
  }

  if (input.firstPilotOwnerReview) reasons.push("FIRST_PILOT_OWNER_EVALUATION");
  if (input.risk === "high" || input.risk === "critical") reasons.push("HIGH_CONSEQUENCE_RISK");
  if (!input.qualityGatePassed) reasons.push("QUALITY_GATE_FAILED");
  if (!input.sourceTraceabilityPassed) reasons.push("SOURCE_TRACEABILITY_FAILED");
  if (!input.evidenceQualityPassed) reasons.push("EVIDENCE_QUALITY_INSUFFICIENT");
  if (input.unresolvedConflict) reasons.push("UNRESOLVED_EVIDENCE_CONFLICT");
  if (input.essentialInputsMissing) reasons.push("ESSENTIAL_INPUTS_MISSING");
  if (input.legalRegulatoryAmbiguity) reasons.push("LEGAL_OR_REGULATORY_AMBIGUITY");
  if (input.saiKnowledgePromotionRequested) reasons.push("SAI_PROMOTION_REQUIRES_SEPARATE_REVIEW");

  return reasons.length
    ? { disposition: "human_review", reasonCodes: [...new Set(reasons)] }
    : { disposition: "automatic", reasonCodes: ["AUTOMATED_QUALITY_GATES_PASSED"] };
}
