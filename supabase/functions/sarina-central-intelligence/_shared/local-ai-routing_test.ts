import { assertEquals } from "jsr:@std/assert";
import { dispatchWithPolicy, type AIProvider, type AIProviderResult } from "./local-ai-routing.ts";

function provider(providerName: "self_hosted" | "openai", shouldFail = false): AIProvider<{ question: string }> {
  return {
    async invoke(request) {
      if (shouldFail) throw new Error(providerName + "_FAILED");
      return {
        provider: providerName,
        model: providerName === "self_hosted" ? "qwen3.5:4b" : "approved-openai-model",
        content: "پاسخ آزمایشی",
        latencyMs: 12,
      } satisfies AIProviderResult;
    },
  };
}

Deno.test("routine request uses local model and never calls OpenAI on local success", async () => {
  let budgetReservations = 0;
  const outcome = await dispatchWithPolicy(
    { correlationId: "route-001", riskTier: "routine", payload: { question: "سلام" } },
    { localEnabled: true, openAIFallbackEnabled: true, externalDataApproved: true },
    {
      local: provider("self_hosted"),
      openai: provider("openai"),
      budget: { async reserve() { budgetReservations++; return true; } },
    },
  );
  assertEquals(outcome.status, "completed");
  if (outcome.status === "completed") {
    assertEquals(outcome.result.provider, "self_hosted");
    assertEquals(outcome.reviewRequired, true);
  }
  assertEquals(budgetReservations, 0);
});

Deno.test("local failure escalates only after approval and atomic budget reservation", async () => {
  let reservations = 0;
  const outcome = await dispatchWithPolicy(
    { correlationId: "route-002", riskTier: "routine", payload: { question: "سؤال" } },
    { localEnabled: true, openAIFallbackEnabled: true, externalDataApproved: true },
    {
      local: provider("self_hosted", true),
      openai: provider("openai"),
      budget: { async reserve() { reservations++; return true; } },
    },
  );
  assertEquals(outcome.status, "completed");
  if (outcome.status === "completed") assertEquals(outcome.result.provider, "openai");
  assertEquals(reservations, 1);
});

Deno.test("no external call occurs without data-transfer approval", async () => {
  let openAICalls = 0;
  const outcome = await dispatchWithPolicy(
    { correlationId: "route-003", riskTier: "complex", payload: { question: "پیچیده" } },
    { localEnabled: true, openAIFallbackEnabled: true, externalDataApproved: false },
    {
      local: provider("self_hosted"),
      openai: { async invoke() { openAICalls++; throw new Error("must not call"); } },
      budget: { async reserve() { throw new Error("must not reserve"); } },
    },
  );
  assertEquals(outcome.status, "specialist_review_required");
  assertEquals(openAICalls, 0);
});

Deno.test("high-consequence requests are never sent to the local model", async () => {
  let localCalls = 0;
  const outcome = await dispatchWithPolicy(
    { correlationId: "route-004", riskTier: "high_consequence", payload: { question: "دوز سم" } },
    { localEnabled: true, openAIFallbackEnabled: true, externalDataApproved: true },
    {
      local: { async invoke() { localCalls++; throw new Error("must not call"); } },
      openai: provider("openai"),
      budget: { async reserve() { return false; } },
    },
  );
  assertEquals(outcome.status, "specialist_review_required");
  assertEquals(localCalls, 0);
});

Deno.test("routine local failure remains contained when budget reservation is denied", async () => {
  const outcome = await dispatchWithPolicy(
    { correlationId: "route-005", riskTier: "routine", payload: { question: "سلام" } },
    { localEnabled: true, openAIFallbackEnabled: true, externalDataApproved: true },
    {
      local: provider("self_hosted", true),
      openai: provider("openai"),
      budget: { async reserve() { return false; } },
    },
  );
  assertEquals(outcome.status, "provider_unavailable");
  if (outcome.status === "provider_unavailable") {
    assertEquals(outcome.reason, "LOCAL_PROVIDER_FAILED_AND_EXTERNAL_FALLBACK_NOT_APPROVED");
  }
});
