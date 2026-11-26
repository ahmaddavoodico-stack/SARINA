import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function reply(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders });
}

function operationalStatus(row: Record<string, unknown>, now = Date.now()) {
  const lifecycle = String(row.lifecycle_state ?? "registered");
  const heartbeat = typeof row.last_heartbeat_at === "string" ? Date.parse(row.last_heartbeat_at) : NaN;
  const capabilityAt = typeof row.last_capability_check_at === "string" ? Date.parse(row.last_capability_check_at) : NaN;
  const lastError = typeof row.last_error_at === "string" ? Date.parse(row.last_error_at) : NaN;
  const heartbeatAgeMs = Number.isFinite(heartbeat) ? Math.max(0, now - heartbeat) : null;
  if (lifecycle !== "enabled") {
    const state = lifecycle === "registered" ? "unknown" : lifecycle;
    return { runtime_state: state, health: lifecycle === "registered" ? "unknown" : "unavailable", reason_code: "LIFECYCLE_NOT_ENABLED", heartbeat_age_ms: heartbeatAgeMs };
  }
  if (heartbeatAgeMs === null) {
    return { runtime_state: "unknown", health: "unknown", reason_code: "NO_VALID_HEARTBEAT", heartbeat_age_ms: null };
  }
  if (heartbeatAgeMs > 180_000) {
    return { runtime_state: "offline", health: "unavailable", reason_code: "HEARTBEAT_STALE", heartbeat_age_ms: heartbeatAgeMs };
  }
  if (Number.isFinite(lastError) && now - lastError <= 300_000) {
    return { runtime_state: "degraded", health: "degraded", reason_code: "RECENT_RUNTIME_ERROR", heartbeat_age_ms: heartbeatAgeMs };
  }
  const capabilityFresh = Number.isFinite(capabilityAt) && now - capabilityAt <= 300_000 && row.capability_check_ok === true;
  if (!capabilityFresh) {
    return { runtime_state: "responding", health: "unknown", reason_code: "CAPABILITY_READINESS_NOT_CONFIRMED", heartbeat_age_ms: heartbeatAgeMs };
  }
  const active = Number(row.active_task_count ?? 0);
  const capacity = typeof row.capacity === "number" ? row.capacity : null;
  if (active > 0 || (capacity !== null && active >= capacity)) {
    return { runtime_state: "busy", health: "healthy", reason_code: "ACTIVE_TASKS", heartbeat_age_ms: heartbeatAgeMs };
  }
  return { runtime_state: "ready", health: "healthy", reason_code: "HEARTBEAT_AND_CAPABILITIES_FRESH", heartbeat_age_ms: heartbeatAgeMs };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { ok: false, code: "METHOD_NOT_ALLOWED" });

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply(401, { ok: false, code: "AUTH_REQUIRED" });
  let body: unknown;
  try { body = await req.json(); } catch { return reply(400, { ok: false, code: "INVALID_JSON" }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return reply(422, { ok: false, code: "INVALID_REQUEST" });
  const input = body as Record<string, unknown>;
  const action = input.action;
  if (action !== "snapshot" && action !== "link_draft") return reply(422, { ok: false, code: "UNSUPPORTED_ACTION" });

  const url = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !publishableKey || !serviceRoleKey) return reply(503, { ok: false, code: "SERVICE_NOT_CONFIGURED" });

  const caller = createClient(url, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await caller.auth.getUser(authorization.slice(7).trim());
  if (authError || !auth.user) return reply(401, { ok: false, code: "INVALID_SESSION" });
  const { data: isAdmin, error: adminError } = await caller.rpc("is_sarina_admin");
  if (adminError) return reply(503, { ok: false, code: "ADMIN_AUTHORIZATION_CHECK_FAILED" });
  if (isAdmin !== true) return reply(403, { ok: false, code: "ADMIN_ACCESS_REQUIRED" });

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  if (action === "link_draft") {
    const draftId = typeof input.draft_id === "string" ? input.draft_id : "";
    const missionId = typeof input.mission_id === "string" ? input.mission_id : "";
    if (!/^[0-9a-f-]{36}$/i.test(draftId) || !/^[0-9a-f-]{36}$/i.test(missionId)) {
      return reply(422, { ok: false, code: "INVALID_LINK_REFERENCE" });
    }
    const { data: draft, error: draftReadError } = await admin.from("sarina_manus_market_research_drafts")
      .select("id,submitted_by,external_mission_id").eq("id", draftId).maybeSingle();
    if (draftReadError) return reply(503, { ok: false, code: "DRAFT_LOOKUP_FAILED" });
    if (!draft || draft.submitted_by !== "manus") return reply(404, { ok: false, code: "MANUS_DRAFT_NOT_FOUND" });
    const { data: mission, error: missionReadError } = await admin.from("sci_external_missions")
      .select("id,status").eq("id", missionId).maybeSingle();
    if (missionReadError) return reply(503, { ok: false, code: "MISSION_LOOKUP_FAILED" });
    if (!mission) return reply(404, { ok: false, code: "MISSION_NOT_FOUND" });
    const { error: updateDraftError } = await admin.from("sarina_manus_market_research_drafts")
      .update({ external_mission_id: missionId }).eq("id", draftId);
    if (updateDraftError) return reply(503, { ok: false, code: "DRAFT_LINK_FAILED" });
    const { error: updateMissionError } = await admin.from("sci_external_missions")
      .update({ draft_id: draftId, status: "owner_review", report_received_at: new Date().toISOString(), linked_by_auth_user_id: auth.user.id, updated_at: new Date().toISOString() })
      .eq("id", missionId);
    if (updateMissionError) return reply(503, { ok: false, code: "MISSION_LINK_FAILED" });
    return reply(200, { ok: true, linked: true });
  }

  const [{ data: runtimes, error: runtimeError }, { data: missions, error: missionError }, { data: drafts, error: draftsError }] = await Promise.all([
    admin.from("sci_agent_runtime").select("*").order("adapter_id"),
    admin.from("sci_external_missions").select("id,external_task_id,external_task_url,title,adapter_id,specialist_role,domain,status,draft_id,created_at,report_received_at").order("created_at", { ascending: false }).limit(20),
    admin.from("sarina_manus_market_research_drafts").select("id,title,market_scope,summary,findings,sources,recommendations,status,submitted_by,external_mission_id,created_at").eq("submitted_by", "manus").order("created_at", { ascending: false }).limit(20),
  ]);
  if (runtimeError || missionError || draftsError) return reply(503, { ok: false, code: "OPERATIONS_DATA_UNAVAILABLE" });

  const agents = (runtimes ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    ...operationalStatus(row),
  }));
  const counts = {
    total: agents.length,
    ready: agents.filter((a: any) => a.runtime_state === "ready").length,
    busy: agents.filter((a: any) => a.runtime_state === "busy").length,
    responding: agents.filter((a: any) => a.runtime_state === "responding").length,
    degraded: agents.filter((a: any) => a.runtime_state === "degraded").length,
    offline: agents.filter((a: any) => a.runtime_state === "offline").length,
    unknown: agents.filter((a: any) => a.runtime_state === "unknown").length,
  };
  return reply(200, {
    ok: true,
    generated_at: new Date().toISOString(),
    fleet: counts,
    agents,
    missions: missions ?? [],
    drafts: drafts ?? [],
    review_policy: {
      first_pilot_requires_owner_review: true,
      automatic_score_available: false,
      note: "The dashboard exposes the original structured report. Regulatory accuracy and factual quality require evidence-based review; no score is fabricated.",
    },
  });
});
