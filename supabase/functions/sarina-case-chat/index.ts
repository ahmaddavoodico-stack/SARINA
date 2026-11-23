import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply(405, { ok: false, code: "METHOD_NOT_ALLOWED" });
  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return reply(401, { ok: false, code: "AUTH_REQUIRED" });
  let body: any;
  try { body = await req.json(); } catch { return reply(400, { ok: false, code: "INVALID_JSON" }); }
  const consultationId = typeof body?.consultation_id === "string" ? body.consultation_id : "";
  if (!/^[0-9a-f-]{36}$/i.test(consultationId)) return reply(422, { ok: false, code: "INVALID_CONSULTATION_ID" });

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  if (!url || !anon || !serviceKey) return reply(503, { ok: false, code: "SERVER_CONFIGURATION_ERROR" });

  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  if (authError || !auth.user) return reply(401, { ok: false, code: "INVALID_SESSION" });

  // RLS-protected reads prove the caller is the farmer or an assigned verified specialist.
  const { data: consultation, error: consultationError } = await userClient
    .from("expert_consultations").select("id,request_id").eq("id", consultationId).maybeSingle();
  if (consultationError || !consultation) return reply(404, { ok: false, code: "CONSULTATION_ACCESS_DENIED" });
  const { data: request, error: requestError } = await userClient
    .from("expert_requests").select("id,subject,problem_description").eq("id", consultation.request_id).maybeSingle();
  if (requestError || !request) return reply(404, { ok: false, code: "CASE_ACCESS_DENIED" });
  const { data: history, error: historyError } = await userClient
    .from("expert_consultation_messages").select("sender_user_id,message_text,created_at")
    .eq("consultation_id", consultationId).order("created_at", { ascending: false }).limit(16);
  if (historyError) return reply(503, { ok: false, code: "HISTORY_UNAVAILABLE" });

  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false } });
  // Default-deny until the separately approved test budget and usage controls are enabled.
  if (Deno.env.get("SARINA_CASE_CHAT_ENABLED") !== "true" || !openAiKey) {
    const note = "دستیار هوشمند سارینا در این محیط هنوز فعال نشده است. پیام‌های کشاورز و متخصص در همین گفت‌وگو ادامه پیدا می‌کند؛ سارینا تا فعال‌شدن کنترل هزینه و کلید سرویس، پاسخ هوشمند تولید نمی‌کند.";
    const { data: saved, error: saveError } = await adminClient.from("expert_consultation_ai_messages")
      .insert({ consultation_id: consultationId, message_text: note, status: "unavailable" })
      .select("id,message_text,status,created_at").single();
    if (saveError) return reply(503, { ok: false, code: "AI_NOT_CONFIGURED" });
    return reply(200, { ok: true, message: saved, model_invoked: false });
  }

  const transcript = (history ?? []).reverse().map((m: any) => ({
    role: m.sender_user_id === auth.user.id ? "user" : "assistant",
    content: String(m.message_text ?? "").slice(0, 6000),
  })).filter((m: any) => m.content);
  if (!transcript.length) return reply(422, { ok: false, code: "NO_CONVERSATION_MESSAGES" });

  const system = [
    "You are SARINA, an agricultural communication assistant participating in a shared conversation between a farmer and an assigned specialist.",
    "Respond in the farmer's language, in clear accessible wording. Help clarify specialist messages and organize questions.",
    "Never claim to be the specialist. Never present a diagnosis, pesticide/fertilizer dose, or operational instruction as approved advice.",
    "Clearly label uncertainty. For a field decision, diagnosis, dose, or treatment, ask the assigned specialist to confirm it.",
    "Do not invent farm, crop, soil, weather, lab, or case facts. Use only the case summary and visible conversation.",
    "Keep the answer concise and useful. Do not expose private specialist notes."
  ].join(" ");
  const completion = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("SARINA_CHAT_MODEL") || "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 700,
      messages: [
        { role: "system", content: system + "\nCase subject: " + request.subject + "\nFarmer's initial description: " + request.problem_description },
        ...transcript,
      ],
    }),
    signal: AbortSignal.timeout(25000),
  }).catch(() => null);
  if (!completion?.ok) return reply(502, { ok: false, code: "AI_PROVIDER_UNAVAILABLE" });
  const payload = await completion.json();
  const answer = payload?.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || !answer.trim()) return reply(502, { ok: false, code: "AI_EMPTY_RESPONSE" });

  const { data: saved, error: saveError } = await adminClient.from("expert_consultation_ai_messages")
    .insert({ consultation_id: consultationId, message_text: answer.trim(), status: "complete" })
    .select("id,message_text,status,created_at").single();
  if (saveError) return reply(503, { ok: false, code: "AI_RESPONSE_SAVE_FAILED" });
  return reply(200, { ok: true, message: saved, model_invoked: true, model: payload.model ?? null });
});
