import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-sarina-timestamp, x-sarina-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const ALLOWED_EVENT_TYPES = new Set([
  "store.market.research.requested",
  "store.market.research.completed",
  "store.daily.summary.requested",
]);
const MAX_BODY_BYTES = 64 * 1024;
const MAX_CLOCK_SKEW_SECONDS = 300;

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function hexToBytes(hex: string): Uint8Array | null {
  if (!/^[0-9a-f]{64}$/i.test(hex)) return null;
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function verifySignature(secret: string, timestamp: string, rawBody: string, signature: string) {
  const supplied = hexToBytes(signature.replace(/^sha256=/i, ""));
  if (!supplied) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return await crypto.subtle.verify(
    "HMAC",
    key,
    supplied,
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { ok: false, code: "METHOD_NOT_ALLOWED" });

  const secret = Deno.env.get("ACTIVEPIECES_SARINA_HMAC_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || secret.length < 32 || !supabaseUrl || !serviceRoleKey) {
    return reply(503, { ok: false, code: "BRIDGE_NOT_CONFIGURED" });
  }

  const timestamp = req.headers.get("x-sarina-timestamp") ?? "";
  const signature = req.headers.get("x-sarina-signature") ?? "";
  if (!/^\d{10}$/.test(timestamp) || !signature) {
    return reply(401, { ok: false, code: "SIGNATURE_REQUIRED" });
  }
  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds) ||
      Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) > MAX_CLOCK_SKEW_SECONDS) {
    return reply(401, { ok: false, code: "SIGNATURE_EXPIRED" });
  }

  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return reply(413, { ok: false, code: "PAYLOAD_TOO_LARGE" });
  }
  let valid = false;
  try {
    valid = await verifySignature(secret, timestamp, rawBody, signature);
  } catch {
    valid = false;
  }
  if (!valid) return reply(401, { ok: false, code: "INVALID_SIGNATURE" });

  let body: unknown;
  try { body = JSON.parse(rawBody); }
  catch { return reply(400, { ok: false, code: "INVALID_JSON" }); }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return reply(422, { ok: false, code: "INVALID_ENVELOPE" });
  }
  const event = body as Record<string, unknown>;
  if (typeof event.event_id !== "string" || event.event_id.length < 1 || event.event_id.length > 128) {
    return reply(422, { ok: false, code: "INVALID_EVENT_ID" });
  }
  if (typeof event.event_type !== "string" || !ALLOWED_EVENT_TYPES.has(event.event_type)) {
    return reply(422, { ok: false, code: "UNSUPPORTED_EVENT_TYPE" });
  }
  if (typeof event.payload !== "object" || event.payload === null || Array.isArray(event.payload)) {
    return reply(422, { ok: false, code: "INVALID_EVENT_PAYLOAD" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase
    .from("activepieces_automation_inbox")
    .insert({
      event_id: event.event_id,
      event_type: event.event_type,
      payload: event.payload,
    })
    .select("id, event_id, status, received_at")
    .single();

  if (error?.code === "23505") {
    return reply(200, { ok: true, duplicate: true, event_id: event.event_id, receipt: "already_accepted" });
  }
  if (error || !data) {
    console.error("Activepieces inbox insert failed", error?.code ?? "UNKNOWN");
    return reply(503, { ok: false, code: "INBOX_WRITE_FAILED", retryable: true });
  }

  return reply(202, {
    ok: true,
    duplicate: false,
    receipt: "accepted",
    event: data,
    processing: "queued_for_sarina_worker",
  });
});
