import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

type JsonRecord = Record<string, unknown>;
const encoder = new TextEncoder();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(status: number, body: JsonRecord) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
function isRecord(v: unknown): v is JsonRecord { return typeof v === "object" && v !== null && !Array.isArray(v); }
function hex(bytes: ArrayBuffer) { return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join(""); }
function equalConstantTime(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function randomNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
async function sign(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}
async function verifySignedRequest(req: Request, rawBody: string, secret: string) {
  const timestamp = req.headers.get("x-sarina-sync-timestamp") ?? "";
  const nonce = req.headers.get("x-sarina-sync-nonce") ?? "";
  const signature = req.headers.get("x-sarina-sync-signature") ?? "";
  const seconds = Number(timestamp);
  if (!/^\d{10}$/.test(timestamp) || !Number.isFinite(seconds) ||
      Math.abs(Date.now() / 1000 - seconds) > 300 ||
      nonce.length < 16 || nonce.length > 128 || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  return equalConstantTime(await sign(secret, timestamp + "\n" + nonce + "\n" + rawBody), signature.toLowerCase());
}
function onlyKeys(payload: JsonRecord, allowed: string[]) {
  const keys = Object.keys(payload); return keys.length > 0 && keys.every((key) => allowed.includes(key));
}
function validString(v: unknown, max: number) { return typeof v === "string" && v.length > 0 && v.length <= max; }
function validProjection(event: JsonRecord) {
  const p = event.event_payload, categories = event.data_categories;
  if (!isRecord(p) || !Array.isArray(categories) || categories.length !== 1 || typeof categories[0] !== "string") return false;
  if (event.aggregate_type === "user" && event.event_type === "user.profile_projection.upsert") {
    if (categories[0] !== "profile_preferences" || !onlyKeys(p, ["preferred_language", "account_status"])) return false;
    return (p.preferred_language === undefined || validString(p.preferred_language, 16)) &&
      (p.account_status === undefined || validString(p.account_status, 32));
  }
  if (event.aggregate_type === "farm" && event.event_type === "farm.summary_projection.upsert") {
    if (categories[0] !== "farm_summary" || !onlyKeys(p, ["farm_name", "total_area", "area_unit", "status"])) return false;
    return (p.farm_name === undefined || validString(p.farm_name, 160)) &&
      (p.total_area === undefined || (typeof p.total_area === "number" && Number.isFinite(p.total_area) && p.total_area >= 0 && p.total_area <= 1_000_000_000)) &&
      (p.area_unit === undefined || validString(p.area_unit, 32)) && (p.status === undefined || validString(p.status, 32));
  }
  if (event.aggregate_type === "consultation" && event.event_type === "consultation.status_projection.upsert") {
    if (categories[0] !== "consultation_status" || !onlyKeys(p, ["consultation_mode", "status", "scheduled_start", "scheduled_end"])) return false;
    const dateOk = (v: unknown) => v === undefined || (typeof v === "string" && Number.isFinite(Date.parse(v)));
    return (p.consultation_mode === undefined || validString(p.consultation_mode, 32)) &&
      (p.status === undefined || validString(p.status, 32)) && dateOk(p.scheduled_start) && dateOk(p.scheduled_end);
  }
  // Reference-data contracts remain disabled until source/licence-specific field allowlists exist.
  return false;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (!supabaseUrl || !serviceKey) return json(503, { error: "regional_sync_service_not_configured" });
  const rawBody = await req.text();
  if (rawBody.length > 100_000) return json(413, { error: "request_too_large" });
  let body: unknown;
  try { body = JSON.parse(rawBody); } catch { return json(400, { error: "invalid_json" }); }
  if (!isRecord(body)) return json(400, { error: "invalid_request" });

  const localCode = Deno.env.get("SARINA_REGION_CODE") ?? "";
  if (!/^[A-Z][A-Z0-9_]{1,15}$/.test(localCode)) return json(503, { error: "region_not_configured" });
  const { data: localRegion, error: localError } = await supabase.from("deployment_regions")
    .select("id,region_status").eq("region_code", localCode).maybeSingle();
  if (localError || !localRegion) return json(503, { error: "local_region_not_registered" });

  if (body.action === "dispatch") {
    const triggerSecret = Deno.env.get("REGIONAL_SYNC_TRIGGER_SECRET") ?? "";
    const supplied = req.headers.get("x-sarina-sync-trigger") ?? "";
    if (triggerSecret.length < 32 || !equalConstantTime(triggerSecret, supplied)) return json(401, { error: "invalid_worker_auth" });
    if (localRegion.region_status !== "active") return json(409, { error: "local_region_not_active" });
    const peerUrl = Deno.env.get("REGIONAL_SYNC_PEER_URL") ?? "";
    const peerSecret = Deno.env.get("REGIONAL_SYNC_PEER_HMAC_SECRET") ?? "";
    if (!peerUrl || peerSecret.length < 32) return json(503, { error: "peer_not_configured" });
    const limit = typeof body.limit === "number" && Number.isInteger(body.limit) ? Math.max(1, Math.min(body.limit, 50)) : 20;
    const { data: events, error: claimError } = await supabase.rpc("regional_claim_sync_outbox", { p_limit: limit, p_lease_seconds: 90 });
    if (claimError) return json(500, { error: "outbox_claim_failed" });

    let acknowledged = 0, retried = 0;
    for (const row of (events ?? []) as JsonRecord[]) {
      let success = false, errorCode = "remote_delivery_failed";
      try {
        if (row.source_region_id !== localRegion.id || typeof row.target_region_id !== "string" ||
            typeof row.id !== "string" || !UUID_RE.test(row.id)) throw new Error("invalid_claimed_event");
        const envelope = {
          action: "receive",
          source_region_id: row.source_region_id, target_region_id: row.target_region_id,
          source_event_id: row.id, consent_id: row.consent_id, aggregate_type: row.aggregate_type,
          aggregate_id: row.aggregate_id, event_type: row.event_type, event_version: row.event_version,
          schema_version: row.schema_version, data_categories: row.data_categories,
          event_payload: row.event_payload, source_updated_at: row.updated_at,
        };
        const serialized = JSON.stringify(envelope), timestamp = Math.floor(Date.now() / 1000).toString(), nonce = randomNonce();
        const signature = await sign(peerSecret, timestamp + "\n" + nonce + "\n" + serialized);
        const response = await fetch(peerUrl, {
          method: "POST",
          headers: { "content-type": "application/json", "x-sarina-sync-timestamp": timestamp,
            "x-sarina-sync-nonce": nonce, "x-sarina-sync-signature": signature },
          body: serialized, signal: AbortSignal.timeout(15_000),
        });
        if (response.ok) success = true; else errorCode = "remote_http_" + response.status;
      } catch (error) {
        errorCode = error instanceof Error ? error.message.slice(0, 100) : "network_error";
      }
      const { error: recordError } = await supabase.rpc("regional_record_sync_delivery", {
        p_event_id: row.id, p_success: success, p_error_code: success ? null : errorCode, p_retry_after_seconds: 0,
      });
      if (recordError) { console.error("regional_sync_delivery_record_failed", row.id, recordError.message); continue; }
      if (success) acknowledged++; else retried++;
    }
    return json(200, { region: localCode, claimed: (events ?? []).length, acknowledged, retried });
  }

  if (body.action === "receive") {
    const peerSecret = Deno.env.get("REGIONAL_SYNC_PEER_HMAC_SECRET") ?? "";
    if (peerSecret.length < 32 || !(await verifySignedRequest(req, rawBody, peerSecret))) return json(401, { error: "invalid_peer_signature" });
    if (localRegion.region_status !== "active") return json(409, { error: "target_region_not_active" });
    const event = body as JsonRecord;
    for (const key of ["source_region_id", "target_region_id", "source_event_id", "consent_id", "aggregate_id"] as const) {
      if (typeof event[key] !== "string" || !UUID_RE.test(event[key] as string)) return json(422, { error: "invalid_" + key });
    }
    if (event.target_region_id !== localRegion.id || typeof event.aggregate_type !== "string" ||
        typeof event.event_type !== "string" || typeof event.event_version !== "number" || !Number.isInteger(event.event_version) ||
        typeof event.schema_version !== "number" || !Number.isInteger(event.schema_version) || !validProjection(event)) {
      return json(422, { error: "unsupported_or_invalid_event_contract" });
    }
    const { data: sourceRegion, error: sourceError } = await supabase.from("deployment_regions")
      .select("id,region_status").eq("id", event.source_region_id).maybeSingle();
    if (sourceError || !sourceRegion || sourceRegion.region_status !== "active") return json(403, { error: "source_region_not_active" });
    const payloadHash = hex(await crypto.subtle.digest("SHA-256", encoder.encode(JSON.stringify(event.event_payload))));
    const nonce = req.headers.get("x-sarina-sync-nonce") ?? "";
    const { data: result, error: acceptError } = await supabase.rpc("regional_accept_sync_event", {
      p_source_region_id: event.source_region_id, p_target_region_id: event.target_region_id,
      p_source_event_id: event.source_event_id, p_request_nonce: nonce, p_consent_id: event.consent_id,
      p_aggregate_type: event.aggregate_type, p_aggregate_id: event.aggregate_id, p_event_type: event.event_type,
      p_event_version: event.event_version, p_schema_version: event.schema_version, p_payload_sha256: payloadHash,
      p_data_categories: event.data_categories, p_event_payload: event.event_payload,
      p_source_updated_at: typeof event.source_updated_at === "string" && Number.isFinite(Date.parse(event.source_updated_at))
        ? event.source_updated_at : new Date().toISOString(),
    });
    if (acceptError) { console.error("regional_sync_accept_rejected", acceptError.message); return json(403, { error: "event_rejected" }); }
    const status = isRecord(result) && typeof result.status === "string" ? result.status : "unknown";
    if (status === "replay_rejected") return json(409, { status });
    return json(200, { status, inbox_id: isRecord(result) ? result.inbox_id ?? null : null });
  }
  return json(400, { error: "unknown_action" });
});
