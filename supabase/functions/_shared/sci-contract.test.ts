import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isFreshTimestamp,
  validateFarmContexts,
  validateSciRequest,
  validateSiacpTaskRequest,
  validateTaskResult,
} from "./sci-contract.ts";

const farmId = "123e4567-e89b-42d3-a456-426614174000";
const now = Date.parse("2026-11-15T12:00:00.000Z");

Deno.test("SCI request requires a valid farm and non-empty bounded question", () => {
  assertEquals(validateSciRequest({ farm_id: farmId, question: " برگ زرد شده " }), []);
  assertEquals(validateSciRequest({ farm_id: "bad", question: " " })[0].code, "INVALID_FARM_ID");
  assertEquals(validateSciRequest({ farm_id: farmId, question: "x".repeat(4001) })[0].code, "QUESTION_TOO_LONG");
});

Deno.test("freshness rejects stale and future timestamps", () => {
  assertEquals(isFreshTimestamp("2026-11-15T11:00:00.000Z", now), true);
  assertEquals(isFreshTimestamp("2026-11-14T10:00:00.000Z", now), false);
  assertEquals(isFreshTimestamp("2026-11-15T13:00:00.000Z", now), false);
});

Deno.test("farm context must belong to the requested farm and retain provenance safeguards", () => {
  const weather = {
    farm_id: farmId, data_kind: "forecast_model_current_and_daily_forecast", source: "open-meteo",
    retrieved_at: new Date(now).toISOString(), location: { latitude: 31, longitude: 48 },
    current: {}, forecast: [{ date: "2026-11-15" }],
  };
  const land = {
    schema: "SARINA_FARM_LAND_CONTEXT_V1", farm: { id: farmId },
    retrieved_at: new Date(now).toISOString(), farmer_reports: [], soil_tests: [], water_tests: [],
    regional_context: {}, safety: {
      distinguish_farmer_report_from_lab_and_model_data: true,
      missing_values_must_remain_missing: true,
    },
  };
  assertEquals(validateFarmContexts(farmId, weather, land, now), []);
  assertEquals(validateFarmContexts("123e4567-e89b-42d3-a456-426614174001", weather, land, now).length, 2);
});

Deno.test("SIACP task request validates the structural subset and rejects expired envelopes", () => {
  const message = {
    header: {
      protocol: "SIACP/1.1", type: "TASK_REQUEST", message_id: "m1", correlation_id: "c1",
      sender: "sci.core", timestamp: new Date(now).toISOString(), nonce: "1234567890abcdef",
      ttl_seconds: 300, recipients: ["agent.demo"],
    },
    body: { task: "diagnosis", question: "Why are leaves yellow?", inputs: { farm_id: farmId },
      required_output: {}, constraints: {} },
  };
  assertEquals(validateSiacpTaskRequest(message, now), []);
  assertEquals(validateSiacpTaskRequest(message, now + 600_000).some((x) => x.code === "SIACP_TIMESTAMP_EXPIRED_OR_INVALID"), true);
});

Deno.test("task result requires matching correlation and recipient", () => {
  const result = {
    header: { protocol: "SIACP/1.1", type: "TASK_RESULT", correlation_id: "c1", recipients: ["sci.core"] },
    body: { status: "completed", findings: [], limitations: [] },
  };
  assertEquals(validateTaskResult(result, "c1", "sci.core"), []);
  assertEquals(validateTaskResult(result, "wrong", "sci.core")[0].code, "RESULT_CORRELATION_MISMATCH");
});
