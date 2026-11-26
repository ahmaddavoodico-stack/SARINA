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
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Daily = {
  time?: string[];
  temperature_2m_max?: (number | null)[];
  temperature_2m_min?: (number | null)[];
  precipitation_sum?: (number | null)[];
  et0_fao_evapotranspiration?: (number | null)[];
  wind_speed_10m_max?: (number | null)[];
};
function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}
function summarizeDaily(daily: Daily) {
  const times = daily.time ?? [];
  const monthly = new Map<number, { max: number[]; min: number[]; rain: number[]; et0: number[] }>();
  const annualRain = new Map<number, number>();
  const annualDays = new Map<number, number>();
  let maxObserved: { value: number; date: string } | null = null;
  let heatDays40 = 0;
  let heatDays45 = 0;
  let validDays = 0;

  for (let i = 0; i < times.length; i++) {
    const date = times[i];
    const year = Number(date.slice(0, 4));
    const month = Number(date.slice(5, 7));
    const max = daily.temperature_2m_max?.[i];
    const min = daily.temperature_2m_min?.[i];
    const rain = daily.precipitation_sum?.[i];
    const et0 = daily.et0_fao_evapotranspiration?.[i];
    if (!monthly.has(month)) monthly.set(month, { max: [], min: [], rain: [], et0: [] });
    const bucket = monthly.get(month)!;
    if (typeof max === "number" && Number.isFinite(max)) {
      bucket.max.push(max);
      validDays++;
      if (max >= 40) heatDays40++;
      if (max >= 45) heatDays45++;
      if (!maxObserved || max > maxObserved.value) maxObserved = { value: max, date };
    }
    if (typeof min === "number" && Number.isFinite(min)) bucket.min.push(min);
    if (typeof rain === "number" && Number.isFinite(rain)) {
      bucket.rain.push(rain);
      annualRain.set(year, (annualRain.get(year) ?? 0) + rain);
    }
    if (typeof et0 === "number" && Number.isFinite(et0)) bucket.et0.push(et0);
    annualDays.set(year, (annualDays.get(year) ?? 0) + 1);
  }

  const monthlyNormals = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const bucket = monthly.get(month);
    return {
      month,
      mean_daily_max_c: bucket ? mean(bucket.max) : null,
      mean_daily_min_c: bucket ? mean(bucket.min) : null,
      mean_daily_precipitation_mm: bucket ? mean(bucket.rain) : null,
      mean_daily_reference_et0_mm: bucket ? mean(bucket.et0) : null,
      sample_days: bucket?.max.length ?? 0,
    };
  });
  const yearCount = annualDays.size;
  return {
    monthly_normals: monthlyNormals,
    annual_mean_precipitation_mm: mean(Array.from(annualRain.values())),
    annual_mean_reference_et0_mm: mean(monthlyNormals.flatMap((month) =>
      month.mean_daily_reference_et0_mm == null ? [] : [month.mean_daily_reference_et0_mm * month.sample_days]
    )) ?? null,
    annual_heat_days_ge_40c_mean: yearCount ? heatDays40 / yearCount : null,
    annual_heat_days_ge_45c_mean: yearCount ? heatDays45 / yearCount : null,
    historical_max_daily_temperature_c: maxObserved?.value ?? null,
    historical_max_daily_temperature_date: maxObserved?.date ?? null,
    valid_daily_max_samples: validDays,
    years_covered: Array.from(annualDays.keys()).sort(),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { ok: false, code: "METHOD_NOT_ALLOWED" });
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply(401, { ok: false, code: "AUTHORIZATION_REQUIRED" });

  let body: unknown;
  try { body = await req.json(); } catch { return reply(400, { ok: false, code: "INVALID_JSON" }); }
  if (!isRecord(body) || typeof body.farm_id !== "string" || !UUID.test(body.farm_id.trim())) {
    return reply(422, { ok: false, code: "INVALID_FARM_ID" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !publishableKey) return reply(500, { ok: false, code: "SERVER_CONFIGURATION_ERROR" });
  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return reply(401, { ok: false, code: "INVALID_SESSION" });

  const farmId = body.farm_id.trim();
  const { data: farm, error: farmError } = await client.from("farms").select("id").eq("id", farmId).maybeSingle();
  if (farmError || !farm) return reply(404, { ok: false, code: "FARM_ACCESS_DENIED" });
  const { data: location, error: locationError } = await client
    .from("farm_locations")
    .select("latitude,longitude,confirmed_by_user,is_primary")
    .eq("farm_id", farmId).eq("is_primary", true).limit(1).maybeSingle();
  if (locationError || !location) return reply(409, { ok: false, code: "PRIMARY_LOCATION_REQUIRED" });

  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return reply(422, { ok: false, code: "INVALID_FARM_COORDINATES" });
  }
  if (location.confirmed_by_user !== true) {
    return reply(200, {
      ok: true, farm_id: farmId,
      climate: {
        status: "waiting_for_confirmed_location",
        source: "Open-Meteo Historical Weather API (ERA5-Land)",
        data_kind: "reanalysis_model_estimate",
        limitation: "مختصات اصلی مزرعه هنوز توسط کشاورز تأیید نشده است.",
      },
      missing_domains: ["تأیید موقعیت مزرعه", "اقلیم بلندمدت"],
    });
  }

  // Open-Meteo's free API is restricted to non-commercial use. SARINA only
  // enables this adapter after an explicit commercial-use entitlement and
  // customer API key are configured by an operator; no key reaches the client.
  const apiKey = Deno.env.get("OPEN_METEO_CUSTOMER_API_KEY");
  const commercialUseConfirmed = Deno.env.get("OPEN_METEO_COMMERCIAL_USE_CONFIRMED") === "true";
  if (!apiKey || !commercialUseConfirmed) {
    return reply(200, {
      ok: true, farm_id: farmId,
      climate: {
        status: "provider_license_not_configured",
        source: "Open-Meteo Historical Weather API (ERA5-Land)",
        data_kind: "reanalysis_model_estimate",
        temporal_coverage_requested: "1991-01-01/2020-12-31",
        limitation: "اتصال عملیاتی تا زمان ثبت مجوز استفاده تجاری و کلید مشتری ارائه‌دهنده غیرفعال است؛ هیچ داده‌ای از API رایگان غیرتجاری در سامانه تجاری مصرف نمی‌شود.",
      },
      missing_domains: ["اقلیم بلندمدت و میانگین‌های اقلیمی ۱۹۹۱ تا ۲۰۲۰"],
    });
  }

  try {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      start_date: "1991-01-01",
      end_date: "2020-12-31",
      daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration",
      models: "era5_land",
      timezone: "auto",
      temperature_unit: "celsius",
      precipitation_unit: "mm",
      apikey: apiKey,
    });
    const response = await fetch("https://customer-archive-api.open-meteo.com/v1/archive?" + params.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(18000),
    });
    if (!response.ok) {
      return reply(200, {
        ok: true, farm_id: farmId,
        climate: {
          status: "provider_unavailable",
          source: "Open-Meteo Historical Weather API (ERA5-Land)",
          data_kind: "reanalysis_model_estimate",
          http_status: response.status,
          checked_at: new Date().toISOString(),
          limitation: "منبع اقلیم تاریخی فعلاً پاسخ معتبر نداد؛ مقادیر اقلیمی خالی باقی می‌مانند.",
        },
        missing_domains: ["اقلیم بلندمدت و میانگین‌های اقلیمی ۱۹۹۱ تا ۲۰۲۰"],
      });
    }
    const raw = await response.json();
    if (!raw.daily || !Array.isArray(raw.daily.time)) {
      return reply(502, { ok: false, code: "INCOMPLETE_HISTORICAL_CLIMATE_RESPONSE" });
    }
    const summary = summarizeDaily(raw.daily as Daily);
    const years = summary.years_covered;
    const status = years.length >= 25 && summary.valid_daily_max_samples >= 9000 ? "available" : "partial";
    return reply(200, {
      ok: true,
      farm_id: farmId,
      climate: {
        status,
        source: "Open-Meteo Historical Weather API",
        source_dataset: "ERA5-Land",
        source_url: "https://open-meteo.com/en/docs/historical-weather-api",
        data_kind: "reanalysis_model_estimate",
        spatial_resolution_degrees: 0.1,
        approximate_spatial_resolution_km: 9,
        temporal_coverage_requested: "1991-01-01/2020-12-31",
        temporal_coverage_returned: years.length ? years[0] + "-01-01/" + years[years.length - 1] + "-12-31" : null,
        years_covered: years,
        timezone: raw.timezone ?? "unknown",
        elevation_m_used_by_provider: raw.elevation ?? null,
        retrieved_at: new Date().toISOString(),
        summary,
        limitation: "بازتحلیل ERA5-Land برآورد شبکه‌ای مدل با تفکیک حدود ۹ کیلومتر است؛ مشاهده ایستگاه داخل مزرعه یا حسگر مزرعه نیست و ناهمگنی‌های کوچک محلی را نشان نمی‌دهد.",
        license: "Commercial customer entitlement required; attribution required by provider terms.",
      },
      missing_domains: status === "available" ? [] : ["کامل بودن پوشش اقلیم ۳۰ ساله"],
    });
  } catch {
    return reply(200, {
      ok: true, farm_id: farmId,
      climate: {
        status: "provider_unavailable",
        source: "Open-Meteo Historical Weather API (ERA5-Land)",
        data_kind: "reanalysis_model_estimate",
        checked_at: new Date().toISOString(),
        limitation: "درخواست اقلیم تاریخی با خطای شبکه یا زمان‌پایان مواجه شد؛ داده‌ای حدس زده یا جایگزین نشده است.",
      },
      missing_domains: ["اقلیم بلندمدت و میانگین‌های اقلیمی ۱۹۹۱ تا ۲۰۲۰"],
    });
  }
});
