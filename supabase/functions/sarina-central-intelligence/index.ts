import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { validateFarmContexts, validateSciRequest } from "./_shared/sci-contract.ts";
import { routeTask, getRegisteredAgent } from "./_shared/task-orchestrator.ts";
import {
  planSpecialistCollaboration,
  type SpecialistDomain,
} from "./_shared/specialist-collaboration.ts";
import { createDurableTaskStore } from "../_shared/durable-task-store.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function reply(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders });
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

  const issues = validateSciRequest(body);
  if (issues.length) return reply(422, { ok: false, code: "INVALID_REQUEST", issues });

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

  const farmId = (body as Record<string, unknown>).farm_id as string;
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

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) return reply(500, { ok: false, code: "DURABLE_TASK_STORE_NOT_CONFIGURED" });

  const idempotencyKey = req.headers.get("Idempotency-Key")?.trim() || crypto.randomUUID();
  if (idempotencyKey.length < 8 || idempotencyKey.length > 120) {
    return reply(400, { ok: false, code: "INVALID_IDEMPOTENCY_KEY" });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const taskStore = createDurableTaskStore(adminClient);
  const requestId = crypto.randomUUID();
  const question = (body as Record<string, unknown>).question as string;
  const language = (body as Record<string, unknown>).language === "en" ? "en" : "fa";
  const references = Array.isArray((body as Record<string, unknown>).references)
    ? (body as Record<string, unknown>).references as string[]
    : [];
  const route = routeTask({ text: question, modalities: ["text"] });
  const agent = getRegisteredAgent(route.agentId);
  if (!agent) return reply(500, { ok: false, code: "SCI_AGENT_REGISTRY_INCONSISTENT" });

  const now = Date.now();
  const deadlineAt = new Date(now + 15 * 60_000).toISOString();
  const initialStatus = route.status === "assigned" && !route.humanReviewRequired
    ? "queued" as const
    : "waiting_for_human" as const;

  let parentTask;
  try {
    parentTask = await taskStore.createTask({
      task_id: requestId,
      task_kind: "parent",
      owner_auth_user_id: authData.user.id,
      farm_id: farmId,
      correlation_id: crypto.randomUUID(),
      channel: "chat",
      intent: route.reasonCode.toLowerCase(),
      domain: route.domain,
      agent_id: route.agentId,
      agent_lifecycle_state: agent.lifecycleState,
      initial_status: initialStatus,
      priority: "normal",
      risk: route.humanReviewRequired ? "high" : "low",
      modalities: ["text"],
      context_refs: ["farm:" + farmId, "weather-context:" + farmId, "land-context:" + farmId],
      payload_refs: ["request:" + requestId],
      permissions: ["read:verified_farm_context"],
      request_payload: { question, language, references },
      idempotency_key: idempotencyKey,
      human_review_required: route.humanReviewRequired || route.status !== "assigned",
      deadline_at: deadlineAt,
      max_attempts: 3,
    });
  } catch (error) {
    console.error("SCI durable task creation failed", error);
    return reply(503, { ok: false, code: "DURABLE_TASK_CREATE_FAILED", retryable: true });
  }

  const agentDomainById: Record<string, SpecialistDomain> = {
    soil_water_specialist: "soil_water",
    irrigation_specialist: "irrigation",
    plant_nutrition_specialist: "plant_nutrition",
    plant_health_specialist: "plant_health",
    climate_specialist: "climate",
    agricultural_knowledge_specialist: "agricultural_knowledge",
    market_intelligence_specialist: "market_intelligence",
    trade_export_specialist: "trade_export",
    finance_economics_specialist: "finance_economics",
    logistics_supply_chain_specialist: "logistics_supply_chain",
  };
  const requestedDomains = [...new Set(
    route.candidates.map((candidate) => agentDomainById[candidate]).filter(Boolean),
  )] as SpecialistDomain[];
  let collaboration = null;
  let childProposalCount = 0;

  if (requestedDomains.length > 0) {
    const contextRefsByDomain: Partial<Record<SpecialistDomain, readonly string[]>> = {
      soil_water: ["farm:" + farmId, "land-context:" + farmId],
      irrigation: ["farm:" + farmId, "weather-context:" + farmId, "land-context:" + farmId],
      plant_nutrition: ["farm:" + farmId, "land-context:" + farmId],
      plant_health: ["farm:" + farmId, "land-context:" + farmId],
      climate: ["farm:" + farmId, "weather-context:" + farmId],
      agricultural_knowledge: ["farm:" + farmId],
      market_intelligence: ["farm:" + farmId],
      trade_export: ["farm:" + farmId],
      finance_economics: ["farm:" + farmId],
      logistics_supply_chain: ["farm:" + farmId],
    };
    collaboration = planSpecialistCollaboration({
      parentTaskId: parentTask.task_id,
      requestedDomains,
      contextRefsByDomain,
      modalities: ["text"],
    });

    for (const item of collaboration.workItems) {
      const specialist = getRegisteredAgent(item.agentId);
      if (!specialist) continue;
      try {
        await taskStore.createTask({
          task_id: crypto.randomUUID(),
          parent_task_id: parentTask.task_id,
          task_kind: "specialist_proposal",
          owner_auth_user_id: authData.user.id,
          farm_id: farmId,
          correlation_id: requestId,
          channel: "internal",
          intent: "specialist_proposal:" + item.domain,
          domain: item.domain,
          agent_id: item.agentId,
          agent_lifecycle_state: specialist.lifecycleState,
          initial_status: "waiting_for_human",
          priority: "normal",
          risk: "medium",
          modalities: ["text"],
          context_refs: item.contextRefs,
          payload_refs: ["parent-request:" + parentTask.task_id],
          permissions: ["read:domain_scoped_farm_context"],
          request_payload: {
            purpose: item.purpose,
            expected_output: item.expectedOutput,
            blocked_reasons: item.blockedReasons,
            dispatch_authorized: false,
          },
          idempotency_key: idempotencyKey + ":specialist:" + item.domain,
          human_review_required: true,
          deadline_at: deadlineAt,
          max_attempts: 1,
        });
        childProposalCount += 1;
      } catch (error) {
        console.error("SCI specialist proposal persistence failed", { domain: item.domain, error });
        return reply(503, {
          ok: false,
          code: "SPECIALIST_PROPOSAL_PERSISTENCE_FAILED",
          task_id: parentTask.task_id,
          retryable: true,
        });
      }
    }
  }

  return reply(202, {
    ok: true,
    request_id: requestId,
    task_id: parentTask.task_id,
    status: parentTask.status,
    execution_mode: "durable_pending_authorization",
    persistence: "supabase_postgres_and_pgmq",
    orchestration: {
      route,
      collaboration_status: collaboration?.status ?? "not_required",
      specialist_proposals_persisted: childProposalCount,
      execution_status: "not_started",
    },
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
    dispatch_authorized: false,
  });
});
