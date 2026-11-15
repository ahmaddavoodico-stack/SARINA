import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { validateSciRequest } from "../_shared/sci-contract.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

  // Slice A intentionally stops before context retrieval, signing, routing, or provider calls.
  // No user-supplied provider/model id or farm context is trusted at this boundary.
  return reply(202, {
    ok: true,
    request_id: crypto.randomUUID(),
    status: "accepted_for_validation",
    next_step: "context_assembly_and_SIACP_signing_not_enabled_in_slice_a",
    farm_access: "verified_under_caller_jwt_and_rls",
    model_invoked: false,
    provider_selected: false,
    physical_action_authorized: false,
  });
});
