import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const allowedTypes = new Set([
  "company", "cooperative", "laboratory", "bank", "insurer", "research",
  "university", "ngo", "support_association", "professional_association",
  "foundation", "charity", "supplier", "buyer", "other",
]);
type Obj = Record<string, unknown>;
function reply(status: number, payload: Obj) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders });
}
function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result ? result.slice(0, max) : null;
}
function cleanList(value: unknown, maxItems = 20): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v): v is string => typeof v === "string")
    .map(v => v.trim()).filter(Boolean).map(v => v.slice(0, 120)))].slice(0, maxItems);
}
function safeUrl(value: unknown): string | null {
  const raw = cleanText(value, 500);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch { return null; }
}
function cleanSocialLinks(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 15).flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Obj;
    const url = safeUrl(row.url);
    if (!url) return [];
    return [{ platform: cleanText(row.platform, 40) ?? "other", label: cleanText(row.label, 80), url }];
  });
}
function cleanOfficeLocations(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Obj;
    const address = cleanText(row.address, 1200);
    if (!address) return [];
    const latitude = typeof row.latitude === "number" && row.latitude >= -90 && row.latitude <= 90 ? row.latitude : null;
    const longitude = typeof row.longitude === "number" && row.longitude >= -180 && row.longitude <= 180 ? row.longitude : null;
    return [{
      label: cleanText(row.label, 100) ?? "دفتر",
      address,
      city: cleanText(row.city, 120),
      country: cleanText(row.country, 120),
      phone: cleanText(row.phone, 32),
      latitude,
      longitude,
    }];
  });
}
function cleanDocuments(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Obj;
    const title = cleanText(row.title, 120);
    const storagePath = cleanText(row.storage_path, 500);
    if (!title) return [];
    return [{ title, document_type: cleanText(row.document_type, 60), storage_path: storagePath }];
  });
}
function normalizeProfile(input: Obj): Obj {
  const phoneList = cleanList(input.contact_phones, 8).filter(v => v.length <= 32);
  const primaryPhone = cleanText(input.contact_phone, 32);
  const contactPhones = [...new Set([...(primaryPhone ? [primaryPhone] : []), ...phoneList])].slice(0, 8);
  return {
    legal_name: cleanText(input.legal_name, 200),
    display_name: cleanText(input.display_name, 160),
    organization_type: cleanText(input.organization_type, 40),
    registration_number: cleanText(input.registration_number, 120),
    country_id: cleanText(input.country_id, 36),
    country_name: cleanText(input.country_name, 120),
    city: cleanText(input.city, 120),
    address: cleanText(input.address, 1500),
    latitude: typeof input.latitude === "number" && input.latitude >= -90 && input.latitude <= 90 ? input.latitude : null,
    longitude: typeof input.longitude === "number" && input.longitude >= -180 && input.longitude <= 180 ? input.longitude : null,
    website_url: safeUrl(input.website_url),
    contact_email: cleanText(input.contact_email, 254)?.toLowerCase() ?? null,
    contact_phone: primaryPhone,
    contact_phones: contactPhones,
    description: cleanText(input.description, 2000),
    support_areas: cleanList(input.support_areas, 20),
    service_regions: cleanList(input.service_regions, 20),
    social_links: cleanSocialLinks(input.social_links),
    office_locations: cleanOfficeLocations(input.office_locations),
    legal_documents: cleanDocuments(input.legal_documents),
  };
}
function completion(profile: Obj): number {
  const checks = [
    Boolean(profile.legal_name && profile.display_name && profile.organization_type),
    Boolean(profile.country_name || profile.country_id),
    Boolean(profile.city && profile.address),
    Boolean(profile.contact_email || profile.contact_phones && (profile.contact_phones as string[]).length),
    Boolean(profile.website_url || (profile.social_links as unknown[]).length),
    Boolean(profile.registration_number),
    Boolean((profile.legal_documents as unknown[]).length),
    Boolean((profile.support_areas as unknown[]).length),
    Boolean((profile.service_regions as unknown[]).length),
  ];
  return Math.round(checks.filter(Boolean).length / checks.length * 100);
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { ok: false, code: "METHOD_NOT_ALLOWED" });
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply(401, { ok: false, code: "AUTHORIZATION_REQUIRED" });
  let body: unknown;
  try { body = await req.json(); } catch { return reply(400, { ok: false, code: "INVALID_JSON" }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return reply(422, { ok: false, code: "INVALID_BODY" });
  const input = body as Obj;
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
  const authUser = authData.user;
  const action = cleanText(input.action, 30);

  const { data: existingProfile, error: lookupError } = await admin.from("users")
    .select("id").eq("auth_user_id", authUser.id).maybeSingle();
  if (lookupError) return reply(500, { ok: false, code: "PROFILE_LOOKUP_FAILED" });
  let profileId = existingProfile?.id as string | undefined;

  if (action === "initialize") {
    if (!profileId) {
      const { data: created, error } = await admin.from("users").insert({
        auth_user_id: authUser.id,
        email: authUser.email ?? null,
        full_name: cleanText(authUser.user_metadata?.full_name, 160),
        account_status: "active",
      }).select("id").single();
      if (error || !created) return reply(500, { ok: false, code: "PROFILE_CREATE_FAILED" });
      profileId = created.id;
    }
    const { data: roleRows, error: roleError } = await admin.from("user_roles")
      .select("roles(code)").eq("user_id", profileId).eq("scope_type", "global").is("scope_id", null);
    if (roleError) return reply(500, { ok: false, code: "ROLE_LOOKUP_FAILED" });
    if (!(roleRows ?? []).some((row: any) => row.roles?.code === "organization")) {
      const { data: role, error: roleFindError } = await admin.from("roles").select("id").eq("code", "organization").single();
      if (roleFindError || !role) return reply(500, { ok: false, code: "ORGANIZATION_ROLE_MISSING" });
      const { error: grantError } = await admin.from("user_roles").insert({
        user_id: profileId, role_id: role.id, scope_type: "global", scope_id: null, granted_by: null,
      });
      if (grantError) return reply(500, { ok: false, code: "ORGANIZATION_ROLE_GRANT_FAILED" });
    }
    const { data: draft, error: draftError } = await admin.from("organization_profiles")
      .upsert({ applicant_user_id: profileId }, { onConflict: "applicant_user_id", ignoreDuplicates: true })
      .select("id,status,completion_percent,profile_data").maybeSingle();
    if (draftError) return reply(500, { ok: false, code: "DRAFT_INITIALIZATION_FAILED" });
    return reply(200, { ok: true, organization_account: true, draft });
  }

  if (!profileId) return reply(403, { ok: false, code: "PROFILE_NOT_FOUND" });
  const { data: roleRows, error: roleError } = await admin.from("user_roles")
    .select("roles(code)").eq("user_id", profileId).eq("scope_type", "global").is("scope_id", null);
  if (roleError) return reply(500, { ok: false, code: "ROLE_LOOKUP_FAILED" });
  if (!(roleRows ?? []).some((row: any) => row.roles?.code === "organization")) {
    return reply(403, { ok: false, code: "ORGANIZATION_ROLE_REQUIRED" });
  }

  if (action === "status") {
    const [{ data: draft, error: draftError }, { data: applications, error: appError }] = await Promise.all([
      admin.from("organization_profiles").select("id,profile_data,completion_percent,status,submitted_at,reviewed_at,review_notes,updated_at")
        .eq("applicant_user_id", profileId).maybeSingle(),
      admin.from("organization_applications").select("id,legal_name,display_name,organization_type,status,submitted_at,created_at")
        .eq("applicant_user_id", profileId).order("created_at", { ascending: false }).limit(10),
    ]);
    if (draftError || appError) return reply(500, { ok: false, code: "STATUS_LOOKUP_FAILED" });
    return reply(200, { ok: true, organization_account: true, draft, applications: applications ?? [] });
  }

  if (action === "save_draft") {
    const { data: current, error: currentError } = await admin.from("organization_profiles")
      .select("id,status").eq("applicant_user_id", profileId).maybeSingle();
    if (currentError) return reply(500, { ok: false, code: "DRAFT_LOOKUP_FAILED" });
    if (current && !["draft", "needs_correction"].includes(current.status)) {
      return reply(409, { ok: false, code: "DRAFT_LOCKED", status: current.status });
    }
    const profileData = normalizeProfile(input.profile_data && typeof input.profile_data === "object" && !Array.isArray(input.profile_data) ? input.profile_data as Obj : {});
    if (profileData.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileData.contact_email as string)) {
      return reply(422, { ok: false, code: "INVALID_CONTACT_EMAIL" });
    }
    if (profileData.organization_type && !allowedTypes.has(profileData.organization_type as string)) {
      return reply(422, { ok: false, code: "INVALID_ORGANIZATION_TYPE" });
    }
    if (profileData.website_url === null && cleanText((input.profile_data as Obj)?.website_url, 500)) {
      return reply(422, { ok: false, code: "INVALID_WEBSITE_URL" });
    }
    const percent = completion(profileData);
    const { data: draft, error } = await admin.from("organization_profiles").upsert({
      applicant_user_id: profileId, profile_data: profileData, completion_percent: percent,
      status: current?.status === "needs_correction" ? "needs_correction" : "draft", updated_at: new Date().toISOString(),
    }, { onConflict: "applicant_user_id" })
      .select("id,profile_data,completion_percent,status,updated_at").single();
    if (error) return reply(500, { ok: false, code: "DRAFT_SAVE_FAILED" });
    return reply(200, { ok: true, draft });
  }

  if (action === "submit") {
    let { data: draft, error: draftError } = await admin.from("organization_profiles")
      .select("id,profile_data,status").eq("applicant_user_id", profileId).maybeSingle();
    if (draftError) return reply(500, { ok: false, code: "DRAFT_LOOKUP_FAILED" });
    if (!draft) {
      // Backward compatibility for older clients that submitted the form directly.
      const legacyProfile = normalizeProfile(input);
      const { data: created, error: createError } = await admin.from("organization_profiles").upsert({
        applicant_user_id: profileId, profile_data: legacyProfile,
        completion_percent: completion(legacyProfile), status: "draft",
      }, { onConflict: "applicant_user_id" }).select("id,profile_data,status").single();
      if (createError || !created) return reply(500, { ok: false, code: "DRAFT_INITIALIZATION_FAILED" });
      draft = created;
    }
    if (!["draft", "needs_correction"].includes(draft.status)) {
      return reply(409, { ok: false, code: "SUBMISSION_NOT_ALLOWED", status: draft.status });
    }
    const p = draft.profile_data as Obj;
    const legalName = cleanText(p.legal_name, 200);
    const displayName = cleanText(p.display_name, 160);
    const organizationType = cleanText(p.organization_type, 40);
    const contactEmail = cleanText(p.contact_email, 254)?.toLowerCase() ?? null;
    const contactPhones = cleanList(p.contact_phones, 8);
    const contactPhone = cleanText(p.contact_phone, 32) ?? contactPhones[0] ?? null;
    const city = cleanText(p.city, 120);
    const address = cleanText(p.address, 1500);
    if (!legalName || !displayName || !organizationType || !allowedTypes.has(organizationType) ||
        (!contactEmail && !contactPhone) || !city || !address) {
      return reply(422, { ok: false, code: "REQUIRED_FIELDS_MISSING", required: ["legal_name","display_name","organization_type","contact_phone_or_email","city","address"] });
    }
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return reply(422, { ok: false, code: "INVALID_CONTACT_EMAIL" });
    }
    const countryId = cleanText(p.country_id, 36);
    if (countryId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(countryId)) {
      return reply(422, { ok: false, code: "INVALID_COUNTRY_ID" });
    }
    const legalDocuments = cleanDocuments(p.legal_documents);
    if (!legalDocuments.some((doc) => doc.storage_path?.startsWith(authUser.id + "/"))) {
      return reply(422, { ok: false, code: "LEGAL_DOCUMENTS_REQUIRED" });
    }
    const { data: active, error: activeError } = await admin.from("organization_applications")
      .select("id,status").eq("applicant_user_id", profileId)
      .in("status", ["pending", "under_review"]).limit(1).maybeSingle();
    if (activeError) return reply(500, { ok: false, code: "APPLICATION_CHECK_FAILED" });
    if (active) return reply(409, { ok: false, code: "ACTIVE_APPLICATION_EXISTS", application_id: active.id, status: active.status });
    const { data: application, error: insertError } = await admin.from("organization_applications").insert({
      applicant_user_id: profileId, legal_name: legalName, display_name: displayName,
      organization_type: organizationType, registration_number: cleanText(p.registration_number, 120),
      country_id: countryId, country_name: cleanText(p.country_name, 120),
      city, address, website_url: safeUrl(p.website_url), contact_email: contactEmail,
      contact_phone: contactPhone, contact_phones: contactPhones,
      social_links: cleanSocialLinks(p.social_links), office_locations: cleanOfficeLocations(p.office_locations),
      legal_documents: legalDocuments,
      latitude: typeof p.latitude === "number" ? p.latitude : null,
      longitude: typeof p.longitude === "number" ? p.longitude : null,
      description: cleanText(p.description, 2000),
      support_areas: cleanList(p.support_areas), service_regions: cleanList(p.service_regions), status: "pending",
    }).select("id,legal_name,display_name,organization_type,status,submitted_at").single();
    if (insertError) {
      console.error("Organization application insert failed", insertError);
      return reply(500, { ok: false, code: "APPLICATION_SUBMISSION_FAILED" });
    }
    const { error: updateError } = await admin.from("organization_profiles")
      .update({ status: "under_review", submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", draft.id);
    if (updateError) return reply(500, { ok: false, code: "DRAFT_STATUS_UPDATE_FAILED", application_id: application.id });
    return reply(201, { ok: true, application });
  }
  return reply(422, { ok: false, code: "INVALID_ACTION" });
});
