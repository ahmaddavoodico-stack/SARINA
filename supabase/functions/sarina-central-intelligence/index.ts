import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { validateFarmContexts, validateSciRequest } from "./_shared/sci-contract.ts";
import { invokeGroqAdminChat, validateAdminChatMessages } from "./_shared/admin-chat.ts";

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

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return reply(401, { ok: false, code: "AUTH_REQUIRED" });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return reply(400, { ok: false, code: "INVALID_JSON" }); }
  if (!isRecord(body)) return reply(422, { ok: false, code: "INVALID_REQUEST" });

  const isAdminChat = body.mode === "admin_chat";
  if (isAdminChat) {
    if (!validateAdminChatMessages(body.messages)) {
      return reply(422, { ok: false, code: "INVALID_ADMIN_CHAT_MESSAGES" });
    }
  } else {
    const issues = validateSciRequest(body);
    if (issues.length) return reply(422, { ok: false, code: "INVALID_REQUEST", issues });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !publishableKey) {
    return reply(500, { ok: false, code: "SERVER_CONFIGURATION_ERROR" });
  }

  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return reply(401, { ok: false, code: "INVALID_SESSION" });

  if (isAdminChat) {
    // The role is re-checked on the server for every request. Client-side UI state is not trusted.
    const { data: isAdmin, error: roleError } = await client.rpc("is_sarina_admin");
    if (roleError) return reply(503, { ok: false, code: "ADMIN_AUTHORIZATION_CHECK_FAILED" });
    if (isAdmin !== true) return reply(403, { ok: false, code: "ADMIN_ACCESS_REQUIRED" });

    try {
      const result = await invokeGroqAdminChat({
        apiKey: Deno.env.get("GROQ_API_KEY") ?? "",
        messages: body.messages,
      });
      return reply(200, {
        ok: true,
        request_id: crypto.randomUUID(),
        provider: "groq",
        model: result.model,
        answer: result.answer,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "GROQ_CHAT_FAILED";
      const status = code === "GROQ_CHAT_KEY_MISSING" ? 503
        : code === "GROQ_CHAT_TIMEOUT" ? 504
        : code.startsWith("GROQ_CHAT_HTTP_") ? 502
        : 502;
      // Do not log prompts, provider response bodies, or secrets.
      console.error("SARINA admin chat provider error", code);
      return reply(status, { ok: false, code });
    }
  }

  const farmId = body.farm_id as string;
  const { data: farm, error: farmError } = await client
    .from("farms").select("id").eq("id", farmId).maybeSingle();
  if (farmError || !farm) return reply(404, { ok: false, code: "FARM_ACCESS_DENIED" });

  // Assemble minimum farm context through existing caller-JWT Edge Functions.
  // These endpoints independently enforce the same user's RLS access; no
  // service-role credential is forwarded or exposed to this orchestration layer.
  const contextHeaders = {
    Authorization: authorization,
    apikey: publishableKey,
    "Content-Type": "application/json",
  };
  let weatherPayload: Record<string, unknown>;
  let landPayload: Record<string, unknown>;
  try {
    const [weatherResponse, landResponse] = await Promise.all([
      fetch(`${supabaseUrl}/functions/v1/farm-weather-context`, {
        method: "POST",
        headers: contextHeaders,
        body: JSON.stringify({ farm_id: farmId }),
        signal: AbortSignal.timeout(18_000),
      }),
      fetch(`${supabaseUrl}/functions/v1/farm-land-context`, {
        method: "POST",
        headers: contextHeaders,
        body: JSON.stringify({ farm_id: farmId }),
        signal: AbortSignal.timeout(18_000),
      }),
    ]);
    if (!weatherResponse.ok || !landResponse.ok) {
      return reply(424, {
        ok: false,
        code: "FARM_CONTEXT_UNAVAILABLE",
        weather_status: weatherResponse.status,
        land_status: landResponse.status,
        retryable: weatherResponse.status >= 500 || landResponse.status >= 500,
      });
    }
    const [weatherJson, landJson] = await Promise.all([weatherResponse.json(), landResponse.json()]);
    if (!weatherJson?.ok || !landJson?.ok || !weatherJson.context || !landJson.context) {
      return reply(424, { ok: false, code: "FARM_CONTEXT_RESPONSE_INVALID", retryable: true });
    }
    weatherPayload = weatherJson.context as Record<string, unknown>;
    landPayload = landJson.context as Record<string, unknown>;
  } catch (error) {
    console.error("SCI farm context assembly failed", error);
    return reply(503, { ok: false, code: "FARM_CONTEXT_FETCH_FAILED", retryable: true });
  }

  const contextIssues = validateFarmContexts(farmId, weatherPayload, landPayload);
  if (contextIssues.length) {
    return reply(422, { ok: false, code: "FARM_CONTEXT_VALIDATION_FAILED", issues: contextIssues });
  }

  // Context is now assembled and validated. Dispatch intentionally remains
  // disabled until SIACP canonicalization/signature verification, replay
  // protection, registered adapter configuration, and result persistence pass.
  return reply(202, {
    ok: true,
    request_id: crypto.randomUUID(),
    status: "context_assembled_pending_signed_adapter_dispatch",
    farm_access: "verified_under_caller_jwt_and_rls",
    context_manifest: {
      farm_id: farmId,
      weather: {
        source: weatherPayload.source,
        retrieved_at: weatherPayload.retrieved_at,
        forecast_days: Array.isArray(weatherPayload.forecast) ? weatherPayload.forecast.length : 0,
      },
      land: {
        schema: landPayload.schema,
        retrieved_at: landPayload.retrieved_at,
        soil_test_count: Array.isArray(landPayload.soil_tests) ? landPayload.soil_tests.length : 0,
        water_test_count: Array.isArray(landPayload.water_tests) ? landPayload.water_tests.length : 0,
        farmer_report_count: Array.isArray(landPayload.farmer_reports) ? landPayload.farmer_reports.length : 0,
        regional_context_status: (landPayload.regional_context as Record<string, unknown>)?.status ?? "unknown",
      },
    },
    model_invoked: false,
    provider_selected: false,
    physical_action_authorized: false,
  });
});
