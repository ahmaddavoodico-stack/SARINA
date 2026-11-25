import { assertEquals } from "jsr:@std/assert";
import { runSciDryRun } from "./sci-dry-run.ts";

const FARM = "11111111-1111-4111-8111-111111111111";
const NOW = Date.parse("2026-11-25T12:00:00.000Z");

Deno.test("SCI dry-run completes only a synthetic non-sensitive task", () => {
  const result = runSciDryRun({
    farmId: FARM,
    requestId: "request-knowledge-0001",
    question: "لطفاً یک منبع علمی درباره یک موضوع عمومی معرفی کن",
    now: NOW,
  });
  assertEquals(result.mode, "simulated");
  assertEquals(result.persistence, "in_memory_invocation_only");
  assertEquals(result.route.agentId, "knowledge_research");
  assertEquals(result.route.modelPolicy, "none");
  assertEquals(result.task.status, "succeeded");
  assertEquals(result.task.attemptCount, 1);
  assertEquals(result.task.result?.structuredOutput.simulation_only, true);
  assertEquals(result.task.result?.structuredOutput.recommendation, null);
  assertEquals(result.simulatedWorkerInvoked, true);
  assertEquals(result.externalEffects, false);
});

Deno.test("agronomy tasks remain held for human review", () => {
  const result = runSciDryRun({
    farmId: FARM,
    requestId: "request-agronomy-0001",
    question: "برای آبیاری مزرعه راهنمایی می‌خواهم",
    now: NOW,
  });
  assertEquals(result.route.agentId, "agronomy_advisor");
  assertEquals(result.route.humanReviewRequired, true);
  assertEquals(result.task.status, "waiting_for_human");
  assertEquals(result.task.attemptCount, 0);
  assertEquals(result.task.result, undefined);
  assertEquals(result.simulatedWorkerInvoked, false);
  assertEquals(result.externalEffects, false);
});

Deno.test("high-consequence requests cannot be auto-completed", () => {
  const result = runSciDryRun({
    farmId: FARM,
    requestId: "request-sensitive-0001",
    question: "مقدار دقیق کود را تجویز کن",
    now: NOW,
  });
  assertEquals(result.route.agentId, "specialist_handoff");
  assertEquals(result.task.status, "waiting_for_human");
  assertEquals(result.simulatedWorkerInvoked, false);
  assertEquals(result.externalEffects, false);
});

Deno.test("ambiguous requests remain in clarification flow", () => {
  const result = runSciDryRun({
    farmId: FARM,
    requestId: "request-ambiguous-0001",
    question: "یک سؤال دارم",
    now: NOW,
  });
  assertEquals(result.route.status, "clarification_required");
  assertEquals(result.task.status, "waiting_for_human");
  assertEquals(result.simulatedWorkerInvoked, false);
  assertEquals(result.externalEffects, false);
});
