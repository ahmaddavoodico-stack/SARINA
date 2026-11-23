import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { createChatGPTAdapterFromEnv, ProviderAdapterRegistry } from "../sarina-central-intelligence/_shared/provider-adapter.ts";
import { signSiacpEnvelope, verifySignedSiacpTask, type NonceStore } from "../sarina-central-intelligence/_shared/siacp-security.ts";
import { buildSpecialistCaseEvidence } from "../sarina-central-intelligence/_shared/specialist-preparation.ts";

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
function asRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}
async function optionalSingle(client: any, table: string, columns: string, id: string) {
  const { data, error } = await client.from(table).select(columns).eq("id", id).maybeSingle();
  return error ? null : (isRecord(data) ? data : null);
}
async function optionalScopedSingle(client: any, table: string, columns: string, id: string, farmId: string) {
  const { data, error } = await client.from(table).select(columns).eq("id", id).eq("farm_id", farmId).maybeSingle();
  return error ? null : (isRecord(data) ? data : null);
}
async function optionalRows(client: any, table: string, columns: string, farmId: string, limit = 10) {
  const { data, error } = await client.from(table).select(columns).eq("farm_id", farmId).limit(limit);
  return error ? [] : asRows(data);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { ok: false, code: "METHOD_NOT_ALLOWED" });
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply(401, { ok: false, code: "AUTH_REQUIRED" });

  let body: unknown;
  try { body = await req.json(); } catch { return reply(400, { ok: false, code: "INVALID_JSON" }); }
  if (!isRecord(body) || typeof body.request_id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.request_id)) {
    return reply(422, { ok: false, code: "REQUEST_ID_REQUIRED" });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !publishableKey) return reply(500, { ok: false, code: "SERVER_CONFIGURATION_ERROR" });
  const userClient = createClient(url, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  if (authError || !auth.user) return reply(401, { ok: false, code: "INVALID_SESSION" });

  const { data: sarinaUserId, error: sarinaUserError } = await userClient.rpc("current_sarina_user_id");
  if (sarinaUserError || typeof sarinaUserId !== "string") {
    return reply(403, { ok: false, code: "SARINA_PROFILE_NOT_RESOLVED" });
  }
  const { data: expert, error: expertError } = await userClient
    .from("expert_profiles").select("id,verification_status")
    .eq("user_id", sarinaUserId).maybeSingle();
  if (expertError || !expert || expert.verification_status !== "verified") {
    return reply(403, { ok: false, code: "VERIFIED_SPECIALIST_REQUIRED" });
  }

  const { data: request, error: requestError } = await userClient
    .from("expert_requests")
    .select("id,requester_user_id,farm_id,field_id,crop_cycle_id,assigned_expert_profile_id,subject,problem_description,request_type,priority,status,preferred_language,created_at")
    .eq("id", body.request_id)
    .eq("assigned_expert_profile_id", expert.id)
    .maybeSingle();
  if (requestError || !request) return reply(404, { ok: false, code: "ASSIGNED_CASE_NOT_FOUND" });
  if (["resolved", "closed", "cancelled"].includes(String(request.status))) {
    return reply(409, { ok: false, code: "CASE_NOT_ACTIVE" });
  }

  const { data: assistant } = await userClient
    .from("expert_case_assistant_cases")
    .select("assistant_status,completeness_status,missing_information,assistant_summary")
    .eq("request_id", request.id).maybeSingle();

  const farmId = typeof request.farm_id === "string" ? request.farm_id : "";
  const [farm, field, cropCycle, soilTests, waterTests, observations] = farmId
    ? await Promise.all([
        optionalSingle(userClient, "farms", "id,farm_name,total_area,area_unit,status", farmId),
        typeof request.field_id === "string" ? optionalScopedSingle(userClient, "farm_fields", "id,farm_id,field_name,area,area_unit,soil_description", request.field_id, farmId) : Promise.resolve(null),
        typeof request.crop_cycle_id === "string" ? optionalScopedSingle(userClient, "crop_cycles", "id,farm_id,crop_name,variety,planting_date,expected_harvest_date,status", request.crop_cycle_id, farmId) : Promise.resolve(null),
        optionalRows(userClient, "soil_tests", "id,field_id,sampled_at,laboratory_name,test_method,soil_texture,ph,ec_ds_m,organic_matter_pct,calcium_carbonate_pct,nitrogen_mg_kg,phosphorus_mg_kg,potassium_mg_kg,data_source,notes", farmId, 10),
        optionalRows(userClient, "water_tests", "id,sampled_at,water_source,laboratory_name,test_method,ph,ec_ds_m,tds_mg_l,sodium_mg_l,calcium_mg_l,magnesium_mg_l,chloride_mg_l,bicarbonate_mg_l,sar,boron_mg_l,data_source,notes", farmId, 10),
        optionalRows(userClient, "farm_observations", "id,observation_type,observed_at,description,severity,image_refs", farmId, 25),
      ])
    : [null, null, null, [], [], []];

  const packet = buildSpecialistCaseEvidence({
    request: request as Record<string, unknown>,
    farm, field, cropCycle, soilTests, waterTests, observations,
    assistant: isRecord(assistant) ? assistant : null,
  });

  // Safe default: evidence preparation works without external AI. Provider dispatch
  // requires an explicit feature flag, signing secret, server-side provider secret,
  // model allowlist, and atomic nonce storage.
  if (Deno.env.get("SARINA_SPECIALIST_PREPARATION_ENABLED") !== "true") {
    return reply(200, {
      ok: true,
      preparation_status: "evidence_packet_ready_provider_dispatch_disabled",
      model_invoked: false,
      review_required: true,
      evidence_packet: packet,
    });
  }

  const signingKey = Deno.env.get("SARINA_SIACP_SIGNING_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!signingKey || signingKey.length < 32 || !serviceRoleKey) {
    return reply(503, { ok: false, code: "SIGNED_PROVIDER_CONFIGURATION_INCOMPLETE", retryable: false });
  }

  const nonceStore: NonceStore = {
    async consume(sender, nonce, expiresAt) {
      const admin = createClient(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await admin.rpc("siacp_consume_nonce", {
        p_sender: sender, p_nonce: nonce, p_expires_at: new Date(expiresAt).toISOString(),
      });
      if (error) throw new Error("SIACP_NONCE_STORE_UNAVAILABLE");
      return data === true;
    },
  };

  const correlationId = crypto.randomUUID();
  const envelope: Record<string, unknown> = {
    header: {
      protocol: "SIACP/1.1", type: "TASK_REQUEST", message_id: crypto.randomUUID(),
      correlation_id: correlationId, sender: "sarina-sci", recipients: ["adapter-chatgpt"],
      timestamp: new Date().toISOString(),
      nonce: Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) => byte.toString(16).padStart(2, "0")).join(""),
      ttl_seconds: 120,
    },
    body: { task: "specialist_case_preparation", question: "Prepare an evidence-grounded specialist review draft.", inputs: { farm_id: farmId || null, evidence: packet }, required_output: ["structured_draft"], constraints: { human_review_required: true, no_final_diagnosis_or_dosage: true } },
  };
  (envelope.header as Record<string, unknown>).signature = await signSiacpEnvelope(envelope, signingKey);
  const verified = await verifySignedSiacpTask(envelope, {
    signingKey,
    allowedSenders: new Set(["sarina-sci"]),
    allowedRecipients: new Set(["adapter-chatgpt"]),
    nonceStore,
  });
  if (!verified.ok) return reply(503, { ok: false, code: verified.code, retryable: true });

  try {
    const registry = new ProviderAdapterRegistry();
    registry.register(createChatGPTAdapterFromEnv());
    const adapter = registry.resolve("chatgpt");
    const result = await adapter.invoke({
      task: "specialist_case_preparation",
      correlationId: verified.correlationId,
      language: request.preferred_language === "fa" ? "fa" : "en",
      payload: packet as unknown as Record<string, unknown>,
    });
    if (result.correlationId !== correlationId) {
      return reply(502, { ok: false, code: "PROVIDER_CORRELATION_MISMATCH" });
    }
    return reply(200, {
      ok: true,
      preparation_status: "draft_ready_for_specialist_review",
      model_invoked: true,
      provider: result.provider,
      model: result.model,
      provider_response_id: result.responseId,
      correlation_id: correlationId,
      review_required: true,
      draft: result.output,
      evidence_coverage: packet.coverage,
    });
  } catch (error) {
    console.error("Specialist preparation provider call failed", error);
    return reply(502, { ok: false, code: "SPECIALIST_PREPARATION_PROVIDER_FAILED", retryable: true });
  }
});
