import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
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

// Admin-only experimental chat endpoint; the main SCI pipeline remains unchanged.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { ok: false, code: "METHOD_NOT_ALLOWED" });
  // Prevent an unmetered legacy path from bypassing the central monthly hard budget.
  return reply(410, { ok: false, code: "CENTRAL_CHAT_REQUIRED" });

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply(401, { ok: false, code: "AUTH_REQUIRED" });
  const accessToken = authorization.slice("Bearer ".length).trim();
  if (!accessToken) return reply(401, { ok: false, code: "AUTH_REQUIRED" });

  let body: unknown;
  try { body = await req.json(); }
  catch { return reply(400, { ok: false, code: "INVALID_JSON" }); }
  if (typeof body !== "object" || body === null || Array.isArray(body) ||
    !validateAdminChatMessages((body as Record<string, unknown>).messages)) {
    return reply(422, { ok: false, code: "INVALID_ADMIN_CHAT_MESSAGES" });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !publishableKey) return reply(500, { ok: false, code: "SERVER_CONFIGURATION_ERROR" });

  const client = createClient(url, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await client.auth.getUser(accessToken);
  if (authError || !auth.user) return reply(401, { ok: false, code: "INVALID_SESSION" });

  // Do not trust client-side role state or user-editable metadata.
  const { data: isAdmin, error: roleError } = await client.rpc("is_sarina_admin");
  if (roleError) return reply(503, { ok: false, code: "ADMIN_AUTHORIZATION_CHECK_FAILED" });
  if (isAdmin !== true) return reply(403, { ok: false, code: "ADMIN_ACCESS_REQUIRED" });

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) return reply(503, { ok: false, code: "ADMIN_CONTEXT_UNAVAILABLE" });
  const adminClient = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const [{ data: roleRows, error: rolesError }, { data: assignments, error: assignmentsError }] = await Promise.all([
    adminClient.from("roles").select("id,code,name,description").order("code"),
    adminClient.from("user_roles").select("role_id").eq("scope_type", "global").is("scope_id", null),
  ]);
  if (rolesError || assignmentsError) {
    return reply(503, { ok: false, code: "ADMIN_ROLE_CONTEXT_UNAVAILABLE" });
  }
  const roleCounts = new Map<string, number>();
  for (const assignment of assignments ?? []) {
    roleCounts.set(assignment.role_id, (roleCounts.get(assignment.role_id) ?? 0) + 1);
  }
  const verifiedAdminContext = JSON.stringify({
    current_user_role: "admin",
    role_catalog: (roleRows ?? []).map((role: any) => ({
      code: role.code,
      name: role.name,
      description: role.description,
      assigned_global_users: roleCounts.get(role.id) ?? 0,
    })),
  });

  try {
    const result = await invokeGroqAdminChat({
      apiKey: Deno.env.get("GROQ_API_KEY") ?? "",
      systemContext: verifiedAdminContext,
      messages: (body as Record<string, unknown>).messages as { role: "user" | "assistant"; content: string }[],
      accessToken,
      voiceApiBase: (() => {
        const origin = req.headers.get("origin");
        if (!origin) throw new Error("SARINA_VOICE_ORIGIN_REQUIRED");
        const parsed = new URL(origin);
        const configuredHosts = (Deno.env.get("SARINA_APP_HOSTS") ?? "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
        const hostname = parsed.hostname.toLowerCase();
        const isSarinaVercelHost = hostname === "sarina.vercel.app" || hostname.endsWith("-sarina6.vercel.app");
        if (parsed.protocol !== "https:" || (!isSarinaVercelHost && !configuredHosts.includes(hostname))) {
          throw new Error("SARINA_VOICE_ORIGIN_NOT_ALLOWED");
        }
        return new URL("/api/voice", parsed.origin).toString();
      })(),
    });
    return reply(200, {
      ok: true,
      request_id: crypto.randomUUID(),
      provider: "groq",
      model: result.model,
      answer: result.answer,
      ...(result.audioBase64 ? { audio_base64: result.audioBase64, audio_mime_type: result.audioMimeType ?? "audio/wav" } : {}),
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "GROQ_CHAT_FAILED";
    const status = code === "GROQ_CHAT_KEY_MISSING" ? 503
      : code === "GROQ_CHAT_TIMEOUT" ? 504
      : 502;
    // Never log prompt text, provider response bodies, or secrets.
    console.error("SARINA admin chat provider error", code);
    return reply(status, { ok: false, code });
  }
});
