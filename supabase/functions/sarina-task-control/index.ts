import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { createDurableTaskStore } from "../sarina-central-intelligence/_shared/durable-task-store.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function reply(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { ok: false, code: "METHOD_NOT_ALLOWED" });

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply(401, { ok: false, code: "AUTH_REQUIRED" });

  let body: unknown;
  try { body = await req.json(); }
  catch { return reply(400, { ok: false, code: "INVALID_JSON" }); }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return reply(422, { ok: false, code: "INVALID_REQUEST" });
  }
  const input = body as Record<string, unknown>;
  if (!isUuid(input.task_id)) return reply(422, { ok: false, code: "INVALID_TASK_ID" });
  if (input.action !== "get_tree" && input.action !== "cancel") {
    return reply(422, { ok: false, code: "UNSUPPORTED_ACTION" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return reply(500, { ok: false, code: "TASK_CONTROL_NOT_CONFIGURED" });
  }

  const caller = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await caller.auth.getUser();
  if (error || !data.user) return reply(401, { ok: false, code: "INVALID_SESSION" });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const tasks = createDurableTaskStore(admin);
  try {
    if (input.action === "cancel") {
      const result = await tasks.cancelTask(input.task_id, data.user.id);
      return reply(200, { ok: true, ...result });
    }
    const tree = await tasks.getTaskTree(input.task_id, data.user.id);
    return reply(200, { ok: true, task_tree: tree });
  } catch (error) {
    const code = error instanceof Error && "code" in error
      ? String((error as Error & { code?: string }).code ?? "TASK_CONTROL_FAILED")
      : "TASK_CONTROL_FAILED";
    if (code === "P0002") return reply(404, { ok: false, code: "TASK_NOT_FOUND" });
    if (code === "42501") return reply(403, { ok: false, code: "TASK_ACCESS_DENIED" });
    console.error("SCI task control operation failed", error);
    return reply(503, { ok: false, code: "TASK_CONTROL_FAILED", retryable: true });
  }
});
