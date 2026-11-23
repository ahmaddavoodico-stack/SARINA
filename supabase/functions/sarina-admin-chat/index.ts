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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { ok: false, code: "METHOD_NOT_ALLOWED" });

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply(401, { ok: false, code: "AUTH_REQUIRED" });

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
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) return reply(401, { ok: false, code: "INVALID_SESSION" });

  // Do not trust client-side role state or user-editable metadata.
  const { data: isAdmin, error: roleError } = await client.rpc("is_sarina_admin");
  if (roleError) return reply(503, { ok: false, code: "ADMIN_AUTHORIZATION_CHECK_FAILED" });
  if (isAdmin !== true) return reply(403, { ok: false, code: "ADMIN_ACCESS_REQUIRED" });

  try {
    const result = await invokeGroqAdminChat({
      apiKey: Deno.env.get("GROQ_API_KEY") ?? "",
      messages: (body as Record<string, unknown>).messages as { role: "user" | "assistant"; content: string }[],
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
      : 502;
    // Never log prompt text, provider response bodies, or secrets.
    console.error("SARINA admin chat provider error", code);
    return reply(status, { ok: false, code });
  }
});
