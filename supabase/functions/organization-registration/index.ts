import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const allowedTypes = new Set([
  "government", "company", "cooperative", "laboratory", "bank", "insurer",
  "research", "university", "ngo", "support_association",
  "professional_association", "foundation", "charity", "supplier", "buyer", "other",
]);
function reply(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders });
}
function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result ? result.slice(0, max) : null;
}
function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v): v is string => typeof v === "string")
    .map(v => v.trim()).filter(Boolean).map(v => v.slice(0, 80)))].slice(0, 12);
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { ok: false, code: "METHOD_NOT_ALLOWED" });
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply(401, { ok: false, code: "AUTHORIZATION_REQUIRED" });
  let body: unknown;
  try { body = await req.json(); } catch { return reply(400, { ok: false, code: "INVALID_JSON" }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return reply(422, { ok: false, code: "INVALID_BODY" });
  const input = body as Record<string, unknown>;
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    console.error("Organization registration server configuration is incomplete");
    return reply(500, { ok: false, code: "SERVER_CONFIGURATION_ERROR" });
  }
  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return reply(401, { ok: false, code: "INVALID_SESSION" });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profileError } = await admin.from("users")
    .select("id").eq("auth_user_id", authData.user.id).maybeSingle();
  if (profileError || !profile) return reply(403, { ok: false, code: "PROFILE_NOT_FOUND" });
  const { data: roleRows, error: roleError } = await admin.from("user_roles")
    .select("roles(code)").eq("user_id", profile.id).eq("scope_type", "global").is("scope_id", null);
  if (roleError) return reply(500, { ok: false, code: "ROLE_LOOKUP_FAILED" });
  if (!(roleRows ?? []).some((row: any) => row.roles?.code === "organization")) {
    return reply(403, { ok: false, code: "ORGANIZATION_ROLE_REQUIRED" });
  }
  const action = input.action === "status" ? "status" : input.action === "submit" ? "submit" : null;
  if (!action) return reply(422, { ok: false, code: "INVALID_ACTION" });
  if (action === "status") {
    const { data, error } = await admin.from("organization_applications")
      .select("id,legal_name,display_name,organization_type,status,submitted_at,created_at")
      .eq("applicant_user_id", profile.id).order("created_at", { ascending: false }).limit(10);
    if (error) return reply(500, { ok: false, code: "STATUS_LOOKUP_FAILED" });
    return reply(200, { ok: true, applications: data ?? [] });
  }
  const legalName = cleanText(input.legal_name, 200);
  const displayName = cleanText(input.display_name, 160);
  const organizationType = cleanText(input.organization_type, 40);
  if (!legalName || !displayName || !organizationType || !allowedTypes.has(organizationType)) {
    return reply(422, { ok: false, code: "REQUIRED_FIELDS_INVALID" });
  }
  const contactEmail = cleanText(input.contact_email, 254)?.toLowerCase() ?? null;
  const contactPhone = cleanText(input.contact_phone, 32);
  if (!contactEmail && !contactPhone) return reply(422, { ok: false, code: "CONTACT_REQUIRED" });
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return reply(422, { ok: false, code: "INVALID_CONTACT_EMAIL" });
  }
  const website = cleanText(input.website_url, 500);
  if (website) {
    try { const url = new URL(website); if (!["http:", "https:"].includes(url.protocol)) throw new Error(); }
    catch { return reply(422, { ok: false, code: "INVALID_WEBSITE_URL" }); }
  }
  const countryId = cleanText(input.country_id, 36);
  if (countryId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(countryId)) {
    return reply(422, { ok: false, code: "INVALID_COUNTRY_ID" });
  }
  const { data: active, error: activeError } = await admin.from("organization_applications")
    .select("id,status").eq("applicant_user_id", profile.id)
    .in("status", ["pending", "under_review"]).limit(1).maybeSingle();
  if (activeError) return reply(500, { ok: false, code: "APPLICATION_CHECK_FAILED" });
  if (active) return reply(409, { ok: false, code: "ACTIVE_APPLICATION_EXISTS", application_id: active.id, status: active.status });
  const { data: application, error: insertError } = await admin.from("organization_applications").insert({
    applicant_user_id: profile.id,
    legal_name: legalName,
    display_name: displayName,
    organization_type: organizationType,
    registration_number: cleanText(input.registration_number, 120),
    country_id: countryId,
    country_name: cleanText(input.country_name, 120),
    city: cleanText(input.city, 120),
    address: cleanText(input.address, 1500),
    website_url: website,
    contact_email: contactEmail,
    contact_phone: contactPhone,
    description: cleanText(input.description, 2000),
    support_areas: cleanList(input.support_areas),
    service_regions: cleanList(input.service_regions),
    status: "pending",
  }).select("id,legal_name,display_name,organization_type,status,submitted_at").single();
  if (insertError) {
    console.error("Organization application insert failed", insertError);
    return reply(500, { ok: false, code: "APPLICATION_SUBMISSION_FAILED" });
  }
  return reply(201, { ok: true, application });
});
