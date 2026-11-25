import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { validateSaiCaseEnvelope } from "../../../src/lib/sai/evidence-contract.ts";
import { buildSaiCaseEnvelope } from "./_shared/assembler.ts";

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { ok: false, code: "METHOD_NOT_ALLOWED" });

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return reply(401, { ok: false, code: "AUTHORIZATION_REQUIRED" });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return reply(400, { ok: false, code: "INVALID_JSON" });
  }
  if (!isRecord(body) || typeof body.farm_id !== "string" || !UUID.test(body.farm_id.trim())) {
    return reply(422, { ok: false, code: "INVALID_FARM_ID" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !publishableKey) {
    return reply(500, { ok: false, code: "SERVER_CONFIGURATION_ERROR" });
  }

  // All reads use the caller JWT. No service-role key, privileged RPC,
  // write, external provider, or storage access is used in this assembler.
  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return reply(401, { ok: false, code: "INVALID_SESSION" });

  const farmId = body.farm_id.trim();
  const { data: farm, error: farmError } = await client
    .from("farms").select("id,created_at").eq("id", farmId).maybeSingle();
  if (farmError || !farm) return reply(404, { ok: false, code: "FARM_ACCESS_DENIED" });

  try {
    const [
      cropCycles, soilTests, waterTests, irrigationEvents, observations,
      productivityMeasurements, baselines, contextObservations, outcomeReviews,
      plans,
    ] = await Promise.all([
      client.from("crop_cycles")
        .select("id,farm_id,field_id,crop_id,variety_id,planting_date,expected_harvest_date,actual_harvest_date,status,created_at")
        .eq("farm_id", farmId).order("planting_date", { ascending: false }).limit(30),
      client.from("soil_tests")
        .select("id,sampled_at,data_source,ph,ec_ds_m,organic_matter_pct,calcium_carbonate_pct,nitrogen_mg_kg,phosphorus_mg_kg,potassium_mg_kg,sodium_mg_kg,chloride_mg_kg,cec_cmol_kg")
        .eq("farm_id", farmId).order("sampled_at", { ascending: false }).limit(50),
      client.from("water_tests")
        .select("id,sampled_at,data_source,ph,ec_ds_m,tds_mg_l,sodium_mg_l,calcium_mg_l,magnesium_mg_l,chloride_mg_l,bicarbonate_mg_l,sar,boron_mg_l")
        .eq("farm_id", farmId).order("sampled_at", { ascending: false }).limit(50),
      client.from("irrigation_events")
        .select("id,started_at,ended_at,irrigation_method,water_source,water_volume_m3,duration_minutes")
        .eq("farm_id", farmId).order("started_at", { ascending: false }).limit(100),
      client.from("farm_observations")
        .select("id,observation_type,observed_at,description,severity")
        .eq("farm_id", farmId).order("observed_at", { ascending: false }).limit(100),
      client.from("farm_productivity_measurements")
        .select("id,metric_code,observed_at,period_start,period_end,metric_value,unit_code,source_type,quality_label,confidence_score")
        .eq("farm_id", farmId).order("observed_at", { ascending: false }).limit(100),
      client.from("farm_productivity_baselines")
        .select("id,baseline_date,period_start,period_end,status,completeness_percent")
        .eq("farm_id", farmId).order("baseline_date", { ascending: false }).limit(30),
      client.from("farm_productivity_context_observations")
        .select("id,factor_code,numeric_value,text_value,unit_code,observed_at,period_start,period_end,source_type,quality_label,confidence_score")
        .eq("farm_id", farmId).order("observed_at", { ascending: false }).limit(100),
      client.from("farm_productivity_outcome_reviews")
        .select("id,evaluation_period_start,evaluation_period_end,classification,attribution_type,attribution_confidence,evidence_quality,reviewed_at,created_at")
        .eq("farm_id", farmId).order("reviewed_at", { ascending: false }).limit(30),
      client.from("farm_improvement_plans")
        .select("id").eq("farm_id", farmId).limit(50),
    ]);

    const results = [
      cropCycles, soilTests, waterTests, irrigationEvents, observations,
      productivityMeasurements, baselines, contextObservations, outcomeReviews, plans,
    ];
    if (results.some((result) => result.error)) {
      // Do not retry with service_role or bypass an RLS denial.
      return reply(424, { ok: false, code: "AUTHORIZED_EVIDENCE_READ_UNAVAILABLE" });
    }

    const planIds = (plans.data ?? []).map((row: Record<string, unknown>) => row.id as string);
    let improvementActions: Record<string, unknown>[] = [];
    if (planIds.length > 0) {
      const actionResult = await client.from("farm_improvement_actions")
        .select("id,plan_id,title,description,status,completed_at,source_recommendation_action_id")
        .in("plan_id", planIds).limit(150);
      if (actionResult.error) {
        return reply(424, { ok: false, code: "AUTHORIZED_ACTION_READ_UNAVAILABLE" });
      }
      improvementActions = actionResult.data ?? [];
    }

    const assembledAt = new Date().toISOString();
    const envelope = buildSaiCaseEnvelope({
      farm,
      cropCycles: cropCycles.data ?? [],
      soilTests: soilTests.data ?? [],
      waterTests: waterTests.data ?? [],
      irrigationEvents: irrigationEvents.data ?? [],
      observations: observations.data ?? [],
      productivityMeasurements: productivityMeasurements.data ?? [],
      baselines: baselines.data ?? [],
      contextObservations: contextObservations.data ?? [],
      outcomeReviews: outcomeReviews.data ?? [],
      improvementActions,
      requestId: crypto.randomUUID(),
      assembledAt,
    });

    const validationIssues = validateSaiCaseEnvelope(envelope);
    if (validationIssues.length > 0) {
      return reply(500, { ok: false, code: "ASSEMBLED_CASE_VALIDATION_FAILED", issues: validationIssues });
    }

    return reply(200, {
      ok: true,
      execution_mode: "read_only",
      persistence: "none",
      authorization: "caller_jwt_and_rls",
      shared_knowledge_eligible: false,
      envelope,
    });
  } catch {
    // Avoid logging farm content, tokens, or raw database errors.
    return reply(500, { ok: false, code: "EVIDENCE_ASSEMBLY_FAILED" });
  }
});
