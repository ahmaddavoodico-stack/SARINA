import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function reply(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { ok: false, code: "METHOD_NOT_ALLOWED" });

  let msg: unknown;
  try {
    msg = await req.json();
  } catch {
    return reply(400, { ok: false, code: "INVALID_JSON" });
  }

  if (!isRecord(msg) || !isRecord(msg.header) || !isRecord(msg.body)) {
    return reply(400, { ok: false, code: "INVALID_ENVELOPE", detail: "Expected header and body objects." });
  }

  const h = msg.header;
  const requiredStrings = ["message_id", "correlation_id", "type", "sender", "timestamp", "nonce"];
  for (const key of requiredStrings) {
    if (typeof h[key] !== "string" || !(h[key] as string).trim()) {
      return reply(422, { ok: false, code: "HEADER_FIELD_REQUIRED", field: key });
    }
  }

  if (h.protocol !== "SIACP/1.1") {
    return reply(422, { ok: false, code: "UNSUPPORTED_PROTOCOL", expected: "SIACP/1.1" });
  }
  if (h.type !== "TASK_REQUEST") {
    return reply(422, { ok: false, code: "UNSUPPORTED_MESSAGE_TYPE", expected: "TASK_REQUEST" });
  }
  if (!Array.isArray(h.recipients) || h.recipients.length === 0 ||
      !h.recipients.every((v) => typeof v === "string" && v.trim().length > 0)) {
    return reply(422, { ok: false, code: "INVALID_RECIPIENTS" });
  }
  if ((h.nonce as string).length < 16 || (h.nonce as string).length > 64) {
    return reply(422, { ok: false, code: "INVALID_NONCE_LENGTH" });
  }
  if (!Number.isInteger(h.ttl_seconds) || (h.ttl_seconds as number) < 1 || (h.ttl_seconds as number) > 900) {
    return reply(422, { ok: false, code: "INVALID_TTL" });
  }

  const timestamp = Date.parse(h.timestamp as string);
  if (!Number.isFinite(timestamp)) return reply(422, { ok: false, code: "INVALID_TIMESTAMP" });
  const ageMs = Date.now() - timestamp;
  if (ageMs > (h.ttl_seconds as number) * 1000) {
    return reply(410, { ok: false, code: "MESSAGE_EXPIRED", message_id: h.message_id });
  }
  if (ageMs < -60_000) {
    return reply(422, { ok: false, code: "TIMESTAMP_IN_FUTURE" });
  }

  const requiredBody = ["task", "question", "inputs", "required_output", "constraints"];
  for (const key of requiredBody) {
    if (!(key in msg.body)) return reply(422, { ok: false, code: "BODY_FIELD_REQUIRED", field: key });
  }

  // Farm-scoped agricultural tasks must carry the normalized weather context
  // retrieved for that same farm. This prevents the transport layer from
  // accepting a farm analysis request that silently omits weather inputs.
  if (isRecord(msg.body.inputs) && typeof msg.body.inputs.farm_id === "string") {
    const inputs = msg.body.inputs;
    const weather = inputs.farm_weather_context;
    if (!isRecord(weather)) {
      return reply(422, { ok: false, code: "FARM_WEATHER_CONTEXT_REQUIRED", field: "inputs.farm_weather_context" });
    }
    const weatherTime = typeof weather.retrieved_at === "string" ? Date.parse(weather.retrieved_at) : NaN;
    const location = weather.location;
    if (
      weather.farm_id !== inputs.farm_id ||
      typeof weather.source !== "string" || !weather.source.trim() ||
      weather.data_kind !== "forecast_model_current_and_daily_forecast" ||
      !Number.isFinite(weatherTime) ||
      Date.now() - weatherTime > 24 * 60 * 60 * 1000 ||
      weatherTime - Date.now() > 5 * 60 * 1000 ||
      !isRecord(location) ||
      typeof location.latitude !== "number" || !Number.isFinite(location.latitude) ||
      typeof location.longitude !== "number" || !Number.isFinite(location.longitude) ||
      !isRecord(weather.current) ||
      !Array.isArray(weather.forecast) || weather.forecast.length < 1
    ) {
      return reply(422, { ok: false, code: "INVALID_OR_STALE_FARM_WEATHER_CONTEXT" });
    }
  }

  // A farm-scoped agricultural task must also carry the normalized land context
  // retrieved for this exact farm. Farmer reports, lab results, weather models and
  // regional datasets remain separate provenance classes.
  if (isRecord(msg.body.inputs) && typeof msg.body.inputs.farm_id === "string") {
    const inputs = msg.body.inputs;
    const land = inputs.farm_land_context;
    if (!isRecord(land)) {
      return reply(422, { ok: false, code: "FARM_LAND_CONTEXT_REQUIRED", field: "inputs.farm_land_context" });
    }
    const retrievedAt = typeof land.retrieved_at === "string" ? Date.parse(land.retrieved_at) : NaN;
    const farm = land.farm;
    if (
      land.schema !== "SARINA_FARM_LAND_CONTEXT_V1" ||
      !isRecord(farm) || farm.id !== inputs.farm_id ||
      !Number.isFinite(retrievedAt) ||
      Date.now() - retrievedAt > 24 * 60 * 60 * 1000 ||
      retrievedAt - Date.now() > 5 * 60 * 1000 ||
      !Array.isArray(land.farmer_reports) ||
      !Array.isArray(land.soil_tests) ||
      !Array.isArray(land.water_tests) ||
      !isRecord(land.regional_context) ||
      !isRecord(land.safety) ||
      land.safety.distinguish_farmer_report_from_lab_and_model_data !== true ||
      land.safety.missing_values_must_remain_missing !== true
    ) {
      return reply(422, { ok: false, code: "INVALID_OR_STALE_FARM_LAND_CONTEXT" });
    }
  }

  // This first deployment is a fail-closed transport/schema bridge only.
  // It deliberately does not call a model, sign a TASK_RESULT, write to domain tables,
  // invoke safety gates, or authorize physical actions.
  return reply(202, {
    ok: true,
    bridge: "sarina-siacp-bridge",
    bridge_version: "0.1.0-sandbox",
    protocol: "SIACP/1.1",
    message_id: h.message_id,
    correlation_id: h.correlation_id,
    receipt: "validated",
    processing_state: "blocked_pending_provider_and_signing_configuration",
    model_invoked: false,
    database_write: false,
    physical_execution_authorized: false,
    is_execution_command: false,
    next_requirements: ["registered_adapter_signing_key", "provider_api_secret", "SCI_dispatch_and_result_persistence"],
  });
});