import { assertEquals } from "jsr:@std/assert";
import {
  classifyReviewDisposition,
  deriveAgentOperationalStatus,
  type ReviewGateInput,
} from "./agent-operations.ts";

const NOW = Date.parse("2026-11-26T10:00:00.000Z");
const baseHealth = {
  lifecycleState: "enabled" as const,
  lastHeartbeatAt: "2026-11-26T09:59:30.000Z",
  heartbeatTtlMs: 120_000,
  lastCapabilityCheckAt: "2026-11-26T09:59:20.000Z",
  capabilityCheckTtlMs: 300_000,
  capabilityCheckOk: true,
  activeTaskCount: 0,
  capacity: 2,
  lastErrorAt: null,
  errorWindowMs: 300_000,
  nowMs: NOW,
};

Deno.test("registered agents are never shown as ready", () => {
  const result = deriveAgentOperationalStatus({
    ...baseHealth,
    lifecycleState: "registered",
  });
  assertEquals(result.runtimeState, "registered");
  assertEquals(result.health, "unknown");
});

Deno.test("enabled agent with fresh heartbeat and capabilities is ready", () => {
  const result = deriveAgentOperationalStatus(baseHealth);
  assertEquals(result.runtimeState, "ready");
  assertEquals(result.health, "healthy");
});

Deno.test("recent heartbeat without a fresh capability check means responding, not ready", () => {
  const result = deriveAgentOperationalStatus({
    ...baseHealth,
    lastCapabilityCheckAt: null,
  });
  assertEquals(result.runtimeState, "responding");
  assertEquals(result.health, "unknown");
});

Deno.test("stale heartbeat means offline", () => {
  const result = deriveAgentOperationalStatus({
    ...baseHealth,
    lastHeartbeatAt: "2026-11-26T09:50:00.000Z",
  });
  assertEquals(result.runtimeState, "offline");
  assertEquals(result.health, "unavailable");
});

Deno.test("active work means busy while health remains healthy", () => {
  const result = deriveAgentOperationalStatus({
    ...baseHealth,
    activeTaskCount: 1,
  });
  assertEquals(result.runtimeState, "busy");
  assertEquals(result.health, "healthy");
});

Deno.test("recent runtime errors degrade an otherwise responsive agent", () => {
  const result = deriveAgentOperationalStatus({
    ...baseHealth,
    lastErrorAt: "2026-11-26T09:59:50.000Z",
  });
  assertEquals(result.runtimeState, "degraded");
  assertEquals(result.reasonCode, "RECENT_RUNTIME_ERROR");
});

const baseReview: ReviewGateInput = {
  risk: "low",
  qualityGatePassed: true,
  sourceTraceabilityPassed: true,
  evidenceQualityPassed: true,
  unresolvedConflict: false,
  essentialInputsMissing: false,
  legalRegulatoryAmbiguity: false,
  privacyBoundaryIssue: false,
  externalSideEffectRequested: false,
  saiKnowledgePromotionRequested: false,
  firstPilotOwnerReview: false,
};

Deno.test("low-risk research passing all gates can be processed automatically", () => {
  assertEquals(classifyReviewDisposition(baseReview).disposition, "automatic");
});

Deno.test("the first Manus pilot is explicitly owner-reviewed", () => {
  const result = classifyReviewDisposition({ ...baseReview, firstPilotOwnerReview: true });
  assertEquals(result.disposition, "human_review");
  assertEquals(result.reasonCodes, ["FIRST_PILOT_OWNER_EVALUATION"]);
});

Deno.test("conflicts and legal ambiguity are escalated without blocking routine safe processing", () => {
  const result = classifyReviewDisposition({
    ...baseReview,
    unresolvedConflict: true,
    legalRegulatoryAmbiguity: true,
  });
  assertEquals(result.disposition, "human_review");
  assertEquals(result.reasonCodes, ["UNRESOLVED_EVIDENCE_CONFLICT", "LEGAL_OR_REGULATORY_AMBIGUITY"]);
});

Deno.test("privacy violations and external side effects are blocked", () => {
  const privacy = classifyReviewDisposition({ ...baseReview, privacyBoundaryIssue: true });
  const sideEffect = classifyReviewDisposition({ ...baseReview, externalSideEffectRequested: true });
  assertEquals(privacy.disposition, "blocked");
  assertEquals(sideEffect.disposition, "blocked");
});
