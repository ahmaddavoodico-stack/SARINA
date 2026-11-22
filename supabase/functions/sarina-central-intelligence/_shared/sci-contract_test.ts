import {
  isFreshTimestamp,
  isRecord,
  isUuid,
  validateFarmContexts,
  validateSciRequest,
  validateSiacpTaskRequest,
  validateTaskResult,
} from "./sci-contract.ts";

const FARM_ID = "123e4567-e89b-42d3-a456-426614174000";
const NOW = Date.parse("2026-11-20T12:00:00.000Z");
const fresh = new Date(NOW).toISOString();

Deno.test("record and UUID guards reject malformed values", () => {
  if (!isRecord({ ok: true }) || isRecord(null) || isRecord([])) throw new Error("record guard failed");
  if (!isUuid(FARM_ID) || isUuid("not-a-uuid")) throw new Error("UUID guard failed");
});

Deno.test("freshness accepts current timestamps and rejects stale, future and invalid values", () => {
  if (!isFreshTimestamp(fresh, NOW)) throw new Error("fresh timestamp rejected");
  if (isFreshTimestamp("2026-11-18T12:00:00.000Z", NOW)) throw new Error("stale timestamp accepted");
  if (isFreshTimestamp("2026-11-20T12:10:00.000Z", NOW)) throw new Error("future timestamp accepted");
  if (isFreshTimestamp("not-a-date", NOW)) throw new Error("invalid timestamp accepted");
});

Deno.test("SCI request accepts a valid farm-scoped question", () => {
  const issues = validateSciRequest({ farm_id: FARM_ID, question: "بررسی وضعیت مزرعه", language: "fa", references: ["soil-test-1"] });
  if (issues.length) throw new Error(JSON.stringify(issues));
});

Deno.test("SCI request rejects missing question, invalid farm and unsupported language", () => {
  const issues = validateSciRequest({ farm_id: "bad", question: " ", language: "xx" });
  const codes = issues.map((issue) => issue.code);
  for (const code of ["INVALID_FARM_ID", "QUESTION_REQUIRED", "UNSUPPORTED_LANGUAGE"]) {
    if (!codes.includes(code)) throw new Error("missing expected issue: " + code);
  }
});

Deno.test("farm context validator accepts fresh contexts scoped to the same farm", () => {
  const weather = {
    farm_id: FARM_ID, data_kind: "forecast_model_current_and_daily_forecast", source: "open-meteo",
    retrieved_at: fresh, location: { latitude: 32.0, longitude: 48.0 }, current: {}, forecast: [{ date: "2026-11-20" }],
  };
  const land = {
    schema: "SARINA_FARM_LAND_CONTEXT_V1", farm: { id: FARM_ID }, retrieved_at: fresh,
    farmer_reports: [], soil_tests: [], water_tests: [], regional_context: {},
    safety: { distinguish_farmer_report_from_lab_and_model_data: true, missing_values_must_remain_missing: true },
  };
  const issues = validateFarmContexts(FARM_ID, weather, land, NOW);
  if (issues.length) throw new Error(JSON.stringify(issues));
});

Deno.test("farm context validator rejects cross-farm and stale context", () => {
  const weather = {
    farm_id: "223e4567-e89b-42d3-a456-426614174000",
    data_kind: "forecast_model_current_and_daily_forecast", source: "open-meteo",
    retrieved_at: "2026-11-18T12:00:00.000Z", location: { latitude: 32, longitude: 48 },
    current: {}, forecast: [{ date: "2026-11-20" }],
  };
  const issues = validateFarmContexts(FARM_ID, weather, {}, NOW);
  if (issues.length !== 2) throw new Error("expected both weather and land context failures");
});

Deno.test("SIACP task validator accepts a complete fresh envelope", () => {
  const task = {
    header: {
      protocol: "SIACP/1.1", type: "TASK_REQUEST", message_id: "msg-1", correlation_id: "corr-1",
      sender: "sarina-sci", recipients: ["adapter-chatgpt"], timestamp: fresh,
      nonce: "0123456789abcdef", ttl_seconds: 120,
    },
    body: { task: "farm_analysis", question: "Analyze", inputs: { farm_id: FARM_ID }, required_output: ["findings"], constraints: {} },
  };
  const issues = validateSiacpTaskRequest(task, NOW);
  if (issues.length) throw new Error(JSON.stringify(issues));
});

Deno.test("SIACP task validator rejects expired and unscoped requests", () => {
  const task = {
    header: {
      protocol: "SIACP/1.1", type: "TASK_REQUEST", message_id: "msg-1", correlation_id: "corr-1",
      sender: "sarina-sci", recipients: ["adapter-chatgpt"], timestamp: "2026-11-18T12:00:00.000Z",
      nonce: "0123456789abcdef", ttl_seconds: 120,
    },
    body: { task: "farm_analysis", question: "Analyze", inputs: {}, required_output: ["findings"], constraints: {} },
  };
  const codes = validateSiacpTaskRequest(task, NOW).map((issue) => issue.code);
  if (!codes.includes("SIACP_TIMESTAMP_EXPIRED_OR_INVALID") || !codes.includes("SIACP_FARM_SCOPE_REQUIRED")) {
    throw new Error("expired or unscoped request was not rejected");
  }
});

Deno.test("SIACP result validator binds response to expected correlation and recipient", () => {
  const result = {
    header: { protocol: "SIACP/1.1", type: "TASK_RESULT", correlation_id: "corr-1", recipients: ["sarina-sci"] },
    body: { status: "completed", findings: [], limitations: [] },
  };
  if (validateTaskResult(result, "corr-1", "sarina-sci").length) throw new Error("valid result rejected");
  const issues = validateTaskResult(result, "other-correlation", "other-recipient").map((issue) => issue.code);
  if (!issues.includes("RESULT_CORRELATION_MISMATCH") || !issues.includes("RESULT_RECIPIENT_MISMATCH")) {
    throw new Error("mismatched result accepted");
  }
});

Deno.test("farm context validator rejects out-of-range coordinates", () => {
  const weather = {
    farm_id: FARM_ID, data_kind: "forecast_model_current_and_daily_forecast", source: "open-meteo",
    retrieved_at: fresh, location: { latitude: 120, longitude: 48 }, current: {}, forecast: [{ date: "2026-11-20" }],
  };
  const land = {
    schema: "SARINA_FARM_LAND_CONTEXT_V1", farm: { id: FARM_ID }, retrieved_at: fresh,
    farmer_reports: [], soil_tests: [], water_tests: [], regional_context: {},
    safety: { distinguish_farmer_report_from_lab_and_model_data: true, missing_values_must_remain_missing: true },
  };
  const issues = validateFarmContexts(FARM_ID, weather, land, NOW);
  if (!issues.some((issue) => issue.field === "farm_weather_context")) {
    throw new Error("out-of-range latitude accepted");
  }
});
