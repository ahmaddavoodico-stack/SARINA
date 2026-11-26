import { assertEquals } from "jsr:@std/assert";
import { AGENT_REGISTRY, getRegisteredAgent, listRegisteredAgents, routeTask } from "./task-orchestrator.ts";

Deno.test("registry has unique stable agent identifiers", () => {
  const ids = AGENT_REGISTRY.map((agent) => agent.id);
  assertEquals(new Set(ids).size, ids.length);
  assertEquals(getRegisteredAgent("agronomy_advisor")?.domain, "agronomy");
  assertEquals(AGENT_REGISTRY.every((agent) =>
    agent.capabilities.length > 0 &&
    ((agent.lifecycleState === "enabled") === agent.enabled)
  ), true);
  assertEquals(listRegisteredAgents("market_intelligence").length, 0);
  assertEquals(listRegisteredAgents("market_intelligence").length, 0);
});

Deno.test("specialist inventory is registered centrally but remains disabled by default", () => {
  const specialistIds = [
    "soil_water_specialist", "irrigation_specialist", "plant_nutrition_specialist",
    "plant_health_specialist", "climate_specialist", "agricultural_knowledge_specialist",
    "market_intelligence_specialist", "trade_export_specialist",
    "finance_economics_specialist", "logistics_supply_chain_specialist",
  ] as const;
  assertEquals(listRegisteredAgents().length, 17);
  assertEquals(listRegisteredAgents("market_intelligence").length, 1);
  for (const id of specialistIds) {
    const agent = getRegisteredAgent(id);
    assertEquals(agent?.lifecycleState, "registered");
    assertEquals(agent?.enabled, false);
    assertEquals(agent?.humanReviewByDefault, true);
  }
});

Deno.test("existing general routing remains enabled after specialist registration", () => {
  assertEquals(getRegisteredAgent("agronomy_advisor")?.enabled, true);
  assertEquals(getRegisteredAgent("crop_diagnostics")?.enabled, true);
  assertEquals(routeTask({ text: "برای اصلاح شوری خاک چه کار کنم؟" }).agentId, "agronomy_advisor");
});

Deno.test("greeting is handled by coordinator without model dispatch", () => {
  const route = routeTask({ text: "سلام، خوبی؟" });
  assertEquals(route.status, "assigned");
  assertEquals(route.agentId, "conversation_coordinator");
  assertEquals(route.modelPolicy, "none");
  assertEquals(route.executionStatus, "not_started");
});

Deno.test("soil and irrigation questions route to agronomy", () => {
  const route = routeTask({ text: "برای اصلاح شوری خاک چه کار کنم؟" });
  assertEquals(route.agentId, "agronomy_advisor");
  assertEquals(route.domain, "agronomy");
  assertEquals(route.humanReviewRequired, true);
});

Deno.test("plant symptoms route to crop diagnostics", () => {
  const route = routeTask({ text: "برگ‌های موز زرد شده و پوسیدگی دارد" });
  assertEquals(route.agentId, "crop_diagnostics");
});

Deno.test("plant image routes to diagnostics", () => {
  const route = routeTask({ text: "این برگ چه مشکلی دارد؟", modalities: ["text", "image"] });
  assertEquals(route.agentId, "crop_diagnostics");
  assertEquals(route.reasonCode, "PLANT_IMAGE_REVIEW");
});

Deno.test("dangerous dosage and explicit expert requests escalate to a specialist", () => {
  const route = routeTask({ text: "برای این آفت دوز سم را مشخص کن" });
  assertEquals(route.agentId, "specialist_handoff");
  assertEquals(route.humanReviewRequired, true);
});

Deno.test("marketplace and account requests route to their own agents", () => {
  assertEquals(routeTask({ text: "سفارش من را پیگیری کن" }).agentId, "marketplace_assistant");
  assertEquals(routeTask({ text: "رمز عبورم را فراموش کرده‌ام" }).agentId, "account_support");
});

Deno.test("ambiguous cross-domain requests ask for clarification instead of guessing", () => {
  const route = routeTask({ text: "قیمت کود را برای بیماری گیاه و سفارش فروشگاه بررسی کن" });
  assertEquals(route.status, "clarification_required");
  assertEquals(route.agentId, "conversation_coordinator");
  assertEquals(route.candidates.length > 1, true);
});

Deno.test("unknown and empty inputs never trigger a model", () => {
  const unknown = routeTask({ text: "یک موضوع نامشخص دارم" });
  const empty = routeTask({ modalities: ["audio"] });
  assertEquals(unknown.status, "clarification_required");
  assertEquals(empty.reasonCode, "TRANSCRIPT_OR_QUESTION_REQUIRED");
  assertEquals(unknown.modelPolicy, "none");
});
