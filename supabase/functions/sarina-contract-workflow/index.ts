import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization");
  if (!url || !anonKey || !serviceKey || !authHeader) return reply({ error: "unauthorized" }, 401);

  const authClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return reply({ error: "unauthorized" }, 401);

  let input: { contract_id?: string; action?: string };
  try { input = await req.json(); } catch { return reply({ error: "invalid_json" }, 400); }
  if (!input.contract_id || !/^[0-9a-f-]{36}$/i.test(input.contract_id) ||
      !["propose", "accept", "cancel"].includes(input.action || "")) {
    return reply({ error: "invalid_request" }, 400);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profileError } = await admin.from("users")
    .select("id").eq("auth_user_id", user.id).maybeSingle();
  if (profileError || !profile?.id) return reply({ error: "profile_not_found" }, 403);

  const { data, error } = await admin.rpc("transition_service_contract", {
    p_contract_id: input.contract_id,
    p_actor_user_id: profile.id,
    p_action: input.action,
  });
  if (error) {
    const forbidden = error.code === "42501";
    const notFound = error.code === "P0002";
    return reply({ error: forbidden ? "forbidden" : notFound ? "not_found" : "transition_failed",
      message: error.message }, forbidden ? 403 : notFound ? 404 : 409);
  }
  return reply({ ok: true, ...data });
});
