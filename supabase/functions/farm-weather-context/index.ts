import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function reply(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders });
}

function isValidCoordinate(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function localDate(timestamp: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(timestamp * 1000));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.year + "-" + values.month + "-" + values.day;
}

async function persistForecastRecord(admin: ReturnType<typeof createClient>, row: Record<string, unknown>) {
  const { data: existing, error: lookupError } = await admin
    .from("weather_records")
    .select("id")
    .eq("farm_id", row.farm_id)
    .eq("observed_at", row.observed_at)
    .eq("data_kind", "forecast")
    .limit(1)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing?.id) {
    const { error } = await admin.from("weather_records").update(row).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await admin.from("weather_records").insert(row);
    if (error) throw error;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { ok: false, code: "METHOD_NOT_ALLOWED" });

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return reply(401, { ok: false, code: "AUTHORIZATION_REQUIRED" });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return reply(400, { ok: false, code: "INVALID_JSON" });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body) ||
      typeof (body as Record<string, unknown>).farm_id !== "string") {
    return reply(422, { ok: false, code: "FARM_ID_REQUIRED" });
  }

  const farmId = ((body as Record<string, unknown>).farm_id as string).trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(farmId)) {
    return reply(422, { ok: false, code: "INVALID_FARM_ID" });
  }
  // Read-only callers (including the environmental dossier builder) must not
  // trigger forecast persistence as a side effect.
  const readOnly = (body as Record<string, unknown>).read_only === true;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || (!readOnly && !serviceRoleKey)) {
    console.error("Missing Supabase function environment configuration");
    return reply(500, { ok: false, code: "SERVER_CONFIGURATION_ERROR" });
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return reply(401, { ok: false, code: "INVALID_SESSION" });

  // These reads run with the caller's JWT, so existing owner-scoped RLS policies
  // prove that the authenticated farmer can access this farm and its location.
  const { data: farm, error: farmError } = await userClient
    .from("farms").select("id").eq("id", farmId).maybeSingle();
  if (farmError || !farm) return reply(404, { ok: false, code: "FARM_NOT_FOUND" });

  const { data: location, error: locationError } = await userClient
    .from("farm_locations")
    .select("latitude,longitude,is_primary,confirmed_by_user")
    .eq("farm_id", farmId)
    .eq("is_primary", true)
    .limit(1)
    .maybeSingle();
  if (locationError || !location) {
    return reply(409, { ok: false, code: "FARM_LOCATION_REQUIRED" });
  }

  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (!isValidCoordinate(latitude, longitude)) {
    return reply(422, { ok: false, code: "INVALID_FARM_COORDINATES" });
  }

  try {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,precipitation",
      daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,et0_fao_evapotranspiration",
      forecast_days: "7",
      timezone: "auto",
      timeformat: "unixtime",
      temperature_unit: "celsius",
      wind_speed_unit: "ms",
      precipitation_unit: "mm",
    });
    const response = await fetch("https://api.open-meteo.com/v1/forecast?" + params.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      console.error("Open-Meteo returned", response.status);
      return reply(502, { ok: false, code: "WEATHER_PROVIDER_UNAVAILABLE" });
    }

    const raw = await response.json();
    if (!raw.current || !raw.daily || !Array.isArray(raw.daily.time)) {
      return reply(502, { ok: false, code: "INCOMPLETE_WEATHER_RESPONSE" });
    }

    const timezone = raw.timezone || "UTC";
    const retrievedAt = new Date().toISOString();
    const currentAt = new Date(Number(raw.current.time) * 1000).toISOString();
    const current = {
      observed_at: currentAt,
      temperature_c: raw.current.temperature_2m ?? null,
      apparent_temperature_c: raw.current.apparent_temperature ?? null,
      relative_humidity_pct: raw.current.relative_humidity_2m ?? null,
      wind_speed_m_s: raw.current.wind_speed_10m ?? null,
      wind_direction_deg: raw.current.wind_direction_10m ?? null,
      precipitation_mm: raw.current.precipitation ?? null,
      provenance: "provider_current_model_estimate_not_farm_sensor",
    };

    const forecast = raw.daily.time.map((timestamp: number, index: number) => ({
      date: localDate(Number(timestamp), timezone),
      max_c: raw.daily.temperature_2m_max?.[index] ?? null,
      min_c: raw.daily.temperature_2m_min?.[index] ?? null,
      precipitation_mm: raw.daily.precipitation_sum?.[index] ?? null,
      max_wind_speed_m_s: raw.daily.wind_speed_10m_max?.[index] ?? null,
      reference_evapotranspiration_mm: raw.daily.et0_fao_evapotranspiration?.[index] ?? null,
    }));

    const context = {
      farm_id: farmId,
      location: { latitude, longitude, timezone, confirmed_by_user: location.confirmed_by_user === true },
      source: "open-meteo",
      data_kind: "forecast_model_current_and_daily_forecast",
      retrieved_at: retrievedAt,
      current,
      forecast,
      decision_guidance: {
        use_for_farm_analysis: true,
        distinguish_model_data_from_local_sensor: true,
        do_not_issue_chemical_or_fertilizer_rates_from_weather_alone: true,
        require_crop_stage_soil_water_and_product_label_context: true,
      },
    };

    if (!readOnly) {
      const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
  
      await persistForecastRecord(admin, {
        farm_id: farmId,
        observed_at: currentAt,
        temperature_c: current.temperature_c,
        feels_like_c: current.apparent_temperature_c,
        relative_humidity_pct: current.relative_humidity_pct,
        precipitation_mm: current.precipitation_mm,
        wind_speed_m_s: current.wind_speed_m_s,
        wind_direction_deg: current.wind_direction_deg,
        data_kind: "forecast",
        raw_payload: {
          provider: "open-meteo",
          provider_data_kind: "current_model_estimate",
          timezone,
          latitude,
          longitude,
          retrieved_at: retrievedAt,
          ...current,
        },
      });
  
      for (let index = 0; index < forecast.length; index++) {
        const day = forecast[index];
        const dayTimestamp = Number(raw.daily.time[index]);
        await persistForecastRecord(admin, {
          farm_id: farmId,
          observed_at: new Date(dayTimestamp * 1000).toISOString(),
          temperature_c: null,
          feels_like_c: null,
          relative_humidity_pct: null,
          precipitation_mm: day.precipitation_mm,
          wind_speed_m_s: day.max_wind_speed_m_s,
          wind_direction_deg: null,
          data_kind: "forecast",
          raw_payload: {
            provider: "open-meteo",
            provider_data_kind: "daily_forecast",
            timezone,
            latitude,
            longitude,
            retrieved_at: retrievedAt,
            ...day,
          },
        });
      }
    }

    return reply(200, {
      ...context,
      stored_records: readOnly ? 0 : forecast.length + 1,
      persistence: readOnly ? "not_persisted" : "stored",
    });
  } catch (error) {
    console.error("Farm weather context failed", error);
    return reply(500, { ok: false, code: "WEATHER_CONTEXT_FAILED" });
  }
});