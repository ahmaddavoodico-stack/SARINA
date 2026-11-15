export type ValidationIssue = { code: string; field?: string };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function validateSciRequest(value: unknown): ValidationIssue[] {
  if (!isRecord(value)) return [{ code: "INVALID_REQUEST" }];
  const issues: ValidationIssue[] = [];
  if (!isUuid(value.farm_id)) issues.push({ code: "INVALID_FARM_ID", field: "farm_id" });
  if (typeof value.question !== "string" || !value.question.trim()) {
    issues.push({ code: "QUESTION_REQUIRED", field: "question" });
  } else if (value.question.trim().length > 4000) {
    issues.push({ code: "QUESTION_TOO_LONG", field: "question" });
  }
  if (value.language !== undefined && value.language !== "fa" && value.language !== "en") {
    issues.push({ code: "UNSUPPORTED_LANGUAGE", field: "language" });
  }
  if (value.references !== undefined &&
      (!Array.isArray(value.references) || value.references.length > 10 ||
       !value.references.every((item) => typeof item === "string" && item.length <= 200))) {
    issues.push({ code: "INVALID_REFERENCES", field: "references" });
  }
  return issues;
}

export function isFreshTimestamp(value: unknown, now = Date.now(), maxAgeMs = 86_400_000): boolean {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && now - timestamp <= maxAgeMs && timestamp - now <= 300_000;
}

export function validateFarmContexts(
  farmId: string,
  weather: unknown,
  land: unknown,
  now = Date.now(),
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(weather) || weather.farm_id !== farmId ||
      weather.data_kind !== "forecast_model_current_and_daily_forecast" ||
      typeof weather.source !== "string" || !weather.source.trim() ||
      !isFreshTimestamp(weather.retrieved_at, now) ||
      !isRecord(weather.location) ||
      typeof weather.location.latitude !== "number" ||
      typeof weather.location.longitude !== "number" ||
      !isRecord(weather.current) ||
      !Array.isArray(weather.forecast) || weather.forecast.length === 0) {
    issues.push({ code: "FARM_CONTEXT_MISMATCH_OR_STALE", field: "farm_weather_context" });
  }
  if (!isRecord(land) || land.schema !== "SARINA_FARM_LAND_CONTEXT_V1" ||
      !isRecord(land.farm) || land.farm.id !== farmId ||
      !isFreshTimestamp(land.retrieved_at, now) ||
      !Array.isArray(land.farmer_reports) ||
      !Array.isArray(land.soil_tests) ||
      !Array.isArray(land.water_tests) ||
      !isRecord(land.regional_context) ||
      !isRecord(land.safety) ||
      land.safety.distinguish_farmer_report_from_lab_and_model_data !== true ||
      land.safety.missing_values_must_remain_missing !== true) {
    issues.push({ code: "FARM_CONTEXT_MISMATCH_OR_STALE", field: "farm_land_context" });
  }
  return issues;
}

export function validateSiacpTaskRequest(value: unknown, now = Date.now()): ValidationIssue[] {
  if (!isRecord(value) || !isRecord(value.header) || !isRecord(value.body)) {
    return [{ code: "INVALID_SIACP_ENVELOPE" }];
  }
  const h = value.header;
  const b = value.body;
  const issues: ValidationIssue[] = [];
  for (const field of ["message_id", "correlation_id", "sender", "timestamp", "nonce"]) {
    if (typeof h[field] !== "string" || !String(h[field]).trim()) {
      issues.push({ code: "SIACP_HEADER_FIELD_REQUIRED", field });
    }
  }
  if (h.protocol !== "SIACP/1.1") issues.push({ code: "UNSUPPORTED_PROTOCOL", field: "protocol" });
  if (h.type !== "TASK_REQUEST") issues.push({ code: "UNSUPPORTED_MESSAGE_TYPE", field: "type" });
  if (!Array.isArray(h.recipients) || h.recipients.length === 0 ||
      !h.recipients.every((item) => typeof item === "string" && item.trim())) {
    issues.push({ code: "INVALID_RECIPIENTS", field: "recipients" });
  }
  if (typeof h.nonce !== "string" || h.nonce.length < 16 || h.nonce.length > 64) {
    issues.push({ code: "INVALID_NONCE", field: "nonce" });
  }
  if (!Number.isInteger(h.ttl_seconds) || Number(h.ttl_seconds) < 1 || Number(h.ttl_seconds) > 900) {
    issues.push({ code: "INVALID_TTL", field: "ttl_seconds" });
  }
  if (!isFreshTimestamp(h.timestamp, now, Number(h.ttl_seconds) * 1000)) {
    issues.push({ code: "SIACP_TIMESTAMP_EXPIRED_OR_INVALID", field: "timestamp" });
  }
  for (const field of ["task", "question", "inputs", "required_output", "constraints"]) {
    if (!(field in b)) issues.push({ code: "SIACP_BODY_FIELD_REQUIRED", field });
  }
  if (!isRecord(b.inputs) || !isUuid(b.inputs.farm_id)) {
    issues.push({ code: "SIACP_FARM_SCOPE_REQUIRED", field: "body.inputs.farm_id" });
  }
  // This validator checks the structural subset only. Signature verification and
  // RFC 8785 canonicalization must pass their own approved test vectors before dispatch.
  return issues;
}

export function validateTaskResult(
  value: unknown,
  expectedCorrelationId: string,
  expectedRecipient: string,
): ValidationIssue[] {
  if (!isRecord(value) || !isRecord(value.header) || !isRecord(value.body)) {
    return [{ code: "INVALID_SIACP_RESULT" }];
  }
  const h = value.header;
  const b = value.body;
  const issues: ValidationIssue[] = [];
  if (h.protocol !== "SIACP/1.1" || h.type !== "TASK_RESULT") {
    issues.push({ code: "INVALID_RESULT_TYPE" });
  }
  if (h.correlation_id !== expectedCorrelationId) {
    issues.push({ code: "RESULT_CORRELATION_MISMATCH", field: "correlation_id" });
  }
  if (!Array.isArray(h.recipients) || !h.recipients.includes(expectedRecipient)) {
    issues.push({ code: "RESULT_RECIPIENT_MISMATCH", field: "recipients" });
  }
  if (typeof b.status !== "string" || !b.status.trim() ||
      !Array.isArray(b.findings) || !Array.isArray(b.limitations)) {
    issues.push({ code: "RESULT_SCHEMA_INVALID", field: "body" });
  }
  return issues;
}
