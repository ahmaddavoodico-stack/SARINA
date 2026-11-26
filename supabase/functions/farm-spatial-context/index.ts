import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { fromArrayBuffer } from "npm:geotiff@2.1.3";
import { summarizeTerrain } from "./_shared/terrain.ts";

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
const TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
const PROCESS_URL = "https://sh.dataspace.copernicus.eu/process/v1";
const STAC_URL = "https://stac.dataspace.copernicus.eu/v1/search";
const STATS_URL = "https://sh.dataspace.copernicus.eu/statistics/v1";

function areaAround(latitude: number, longitude: number) {
  // Farm boundary polygons are not yet stored in the current registration flow.
  // This bounded ~1 km centroid buffer is explicitly a regional proxy, not a parcel outline.
  const deltaLat = 0.0045;
  const deltaLon = Math.min(0.02, deltaLat / Math.max(Math.cos(latitude * Math.PI / 180), 0.2));
  return [
    Math.max(-180, longitude - deltaLon),
    Math.max(-90, latitude - deltaLat),
    Math.min(180, longitude + deltaLon),
    Math.min(90, latitude + deltaLat),
  ];
}

async function getAccessToken(clientId: string, clientSecret: string) {
  const form = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: form,
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("COPERNICUS_AUTH_FAILED");
  const payload = await response.json();
  if (typeof payload.access_token !== "string") throw new Error("COPERNICUS_TOKEN_MISSING");
  return payload.access_token as string;
}

async function discoverScenes(bbox: number[]) {
  const to = new Date();
  const from = new Date(to.getTime() - 180 * 24 * 60 * 60 * 1000);
  const datetime = from.toISOString() + "/" + to.toISOString();
  try {
    const response = await fetch(STAC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/geo+json" },
      body: JSON.stringify({
        collections: ["sentinel-2-l2a"],
        bbox,
        datetime,
        limit: 20,
        query: { "eo:cloud_cover": { lte: 50 } },
        sortby: [{ field: "properties.datetime", direction: "desc" }],
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return { status: "catalogue_unavailable", scenes: [], checked_at: new Date().toISOString() };
    const payload = await response.json();
    const scenes = (Array.isArray(payload.features) ? payload.features : []).slice(0, 10).map((feature: Record<string, unknown>) => {
      const properties = isRecord(feature.properties) ? feature.properties : {};
      return {
        id: typeof feature.id === "string" ? feature.id : null,
        acquired_at: typeof properties.datetime === "string" ? properties.datetime : null,
        cloud_cover_pct: typeof properties["eo:cloud_cover"] === "number" ? properties["eo:cloud_cover"] : null,
        platform: typeof properties.platform === "string" ? properties.platform : "Sentinel-2",
        collection: "sentinel-2-l2a",
      };
    });
    return {
      status: scenes.length ? "available" : "no_scenes_in_window",
      scenes,
      searched_window: datetime,
      cloud_cover_filter_pct: 50,
      checked_at: new Date().toISOString(),
      data_kind: "satellite_scene_catalogue_metadata_only",
    };
  } catch {
    return { status: "catalogue_unavailable", scenes: [], checked_at: new Date().toISOString() };
  }
}

async function getTerrain(token: string, bbox: number[]) {
  const evalscript = `//VERSION=3
function setup() {
  return {
    input: ["DEM"],
    output: { id: "default", bands: 1, sampleType: SampleType.FLOAT32 }
  };
}
function evaluatePixel(sample) { return [sample.DEM]; }`;
  const response = await fetch(PROCESS_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", Accept: "image/tiff" },
    body: JSON.stringify({
      input: {
        bounds: { bbox, properties: { crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84" } },
        data: [{
          type: "dem",
          dataFilter: { demInstance: "COPERNICUS_90" },
          processing: { upsampling: "BILINEAR", downsampling: "BILINEAR" },
        }],
      },
      output: {
        width: 11,
        height: 11,
        responses: [{ identifier: "default", format: { type: "image/tiff" } }],
      },
      evalscript,
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) return { status: "provider_unavailable", provider_http_status: response.status };
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("tiff")) return { status: "invalid_provider_response" };
  const tiff = await fromArrayBuffer(await response.arrayBuffer());
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const raster = await image.readRasters({ interleave: true });
  const bboxWidthMeters = (bbox[2] - bbox[0]) * 111320 * Math.cos(((bbox[1] + bbox[3]) / 2) * Math.PI / 180);
  const bboxHeightMeters = (bbox[3] - bbox[1]) * 110574;
  const summary = summarizeTerrain(
    raster as ArrayLike<number>,
    width,
    height,
    bboxWidthMeters / width,
    bboxHeightMeters / height,
  );
  if (!summary) return { status: "no_valid_dem_pixels" };
  return {
    status: "available",
    provider: "Copernicus DEM GLO-90",
    source_url: "https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM.html",
    data_kind: "digital_surface_model_estimate",
    native_resolution_m: 90,
    output_grid: { width, height, pixel_width_m: bboxWidthMeters / width, pixel_height_m: bboxHeightMeters / height },
    summary,
    retrieved_at: new Date().toISOString(),
    limitation: "مدل سطحی شبکه‌ای ۹۰ متری است و ممکن است پوشش گیاهی و سازه‌ها را نیز در ارتفاع نشان دهد. شیب محاسبه‌شده در مقیاس منطقه‌ای است و برای طراحی جوی و پشته، زهکشی یا نقشه‌برداری دقیق قطعه کافی نیست.",
    attribution: "Copernicus DEM GLO-90; acknowledge Copernicus Programme and ESA.",
  };
}

async function getNdvi(token: string, bbox: number[]) {
  const to = new Date();
  const from = new Date(to.getTime() - 180 * 24 * 60 * 60 * 1000);
  const evalscript = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "SCL", "dataMask"] }],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(s) {
  const denominator = s.B08 + s.B04;
  const valid = s.dataMask === 1 && denominator !== 0 &&
    s.SCL !== 3 && s.SCL !== 6 && s.SCL !== 8 &&
    s.SCL !== 9 && s.SCL !== 10 && s.SCL !== 11;
  const ndvi = valid ? (s.B08 - s.B04) / denominator : 0;
  return { ndvi: [ndvi], dataMask: [valid ? 1 : 0] };
}`;
  const response = await fetch(STATS_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      input: {
        bounds: { bbox, properties: { crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84" } },
        data: [{ type: "sentinel-2-l2a", dataFilter: { mosaickingOrder: "leastCC", maxCloudCoverage: 50 } }],
      },
      aggregation: {
        timeRange: { from: from.toISOString(), to: to.toISOString() },
        aggregationInterval: { of: "P30D" },
        evalscript,
        resx: 10,
        resy: 10,
      },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) return { status: "provider_unavailable", provider_http_status: response.status };
  const payload = await response.json();
  if (payload.status !== "OK" || !Array.isArray(payload.data)) return { status: "invalid_provider_response" };
  const windows = payload.data.map((entry: Record<string, unknown>) => {
    const outputs = isRecord(entry.outputs) ? entry.outputs : {};
    const ndviOutput = isRecord(outputs.ndvi) ? outputs.ndvi : {};
    const bands = isRecord(ndviOutput.bands) ? ndviOutput.bands : {};
    const band = isRecord(bands.B0) ? bands.B0 : {};
    const stats = isRecord(band.stats) ? band.stats : {};
    return {
      from: isRecord(entry.interval) ? entry.interval.from ?? null : null,
      to: isRecord(entry.interval) ? entry.interval.to ?? null : null,
      mean: typeof stats.mean === "number" ? stats.mean : null,
      min: typeof stats.min === "number" ? stats.min : null,
      max: typeof stats.max === "number" ? stats.max : null,
      stdev: typeof stats.stDev === "number" ? stats.stDev : null,
      valid_pixel_count: typeof stats.sampleCount === "number" ? stats.sampleCount : 0,
      no_data_pixel_count: typeof stats.noDataCount === "number" ? stats.noDataCount : 0,
    };
  });
  return {
    status: windows.some((window: { valid_pixel_count: number }) => window.valid_pixel_count > 0) ? "available" : "no_valid_observations",
    provider: "Copernicus Sentinel-2 L2A via Sentinel Hub Statistical API",
    source_url: "https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical.html",
    data_kind: "satellite_derived_vegetation_index",
    index: "NDVI",
    spatial_resolution_m: 10,
    temporal_window: { from: from.toISOString(), to: to.toISOString() },
    aggregation_interval: "P30D",
    cloud_filter_pct: 50,
    cloud_shadow_snow_and_water_masked: true,
    windows,
    retrieved_at: new Date().toISOString(),
    limitation: "NDVI شاخص طیفی پوشش گیاهی در محدوده تقریبی پیرامون نقطه اصلی مزرعه است؛ به‌تنهایی نوع محصول، سلامت درخت، کمبود غذایی یا نیاز آبی را تشخیص نمی‌دهد. نبود مرز دقیق مزرعه باعث می‌شود آمار فعلی مختص قطعه ثبت‌شده نباشد.",
    attribution: "Contains modified Copernicus Sentinel data.",
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
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !key) return reply(500, { ok: false, code: "SERVER_CONFIGURATION_ERROR" });
  const client = createClient(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) return reply(401, { ok: false, code: "INVALID_SESSION" });
  const farmId = body.farm_id.trim();
  const { data: farm, error: farmError } = await client.from("farms").select("id").eq("id", farmId).maybeSingle();
  if (farmError || !farm) return reply(404, { ok: false, code: "FARM_ACCESS_DENIED" });
  const { data: location, error: locationError } = await client.from("farm_locations")
    .select("latitude,longitude,confirmed_by_user,is_primary")
    .eq("farm_id", farmId).eq("is_primary", true).limit(1).maybeSingle();
  if (locationError || !location) return reply(409, { ok: false, code: "PRIMARY_LOCATION_REQUIRED" });
  const latitude = location.latitude == null ? NaN : Number(location.latitude);
  const longitude = location.longitude == null ? NaN : Number(location.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return reply(422, { ok: false, code: "INVALID_FARM_COORDINATES" });
  }
  if (location.confirmed_by_user !== true) {
    return reply(200, {
      ok: true, farm_id: farmId,
      terrain: { status: "waiting_for_confirmed_location" },
      satellite: { status: "waiting_for_confirmed_location", scenes: [] },
      missing_domains: ["تأیید موقعیت مزرعه", "ارتفاع و شیب منطقه", "تحلیل پوشش گیاهی ماهواره‌ای"],
    });
  }

  const bbox = areaAround(latitude, longitude);
  const scenesPromise = discoverScenes(bbox);
  const clientId = Deno.env.get("CDSE_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("CDSE_OAUTH_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return reply(200, {
      ok: true,
      farm_id: farmId,
      analysis_area: { type: "centroid_buffer_proxy", bbox, approximate_width_km: 1, not_farm_boundary: true },
      terrain: {
        status: "provider_credentials_not_configured",
        provider: "Copernicus DEM GLO-90",
        native_resolution_m: 90,
        limitation: "برای پردازش ارتفاع و شیب، OAuth client سرویس Sentinel Hub در Copernicus Data Space باید در secretهای سرور تنظیم شود.",
      },
      satellite: await scenesPromise.then((catalogue) => ({
        ...catalogue,
        analysis_status: "scene_discovery_only",
        limitation: "در این وضعیت فقط فراداده صحنه‌ها جست‌وجو می‌شود؛ NDVI و شاخص‌های پوشش گیاهی هنوز پردازش نشده‌اند.",
      })),
      missing_domains: ["ارتفاع و شیب منطقه", "پردازش NDVI و شاخص‌های پوشش گیاهی"],
    });
  }

  try {
    const token = await getAccessToken(clientId, clientSecret);
    const [terrainResult, satelliteStats, catalogue] = await Promise.all([
      getTerrain(token, bbox).catch(() => ({ status: "provider_unavailable" })),
      getNdvi(token, bbox).catch(() => ({ status: "provider_unavailable" })),
      scenesPromise,
    ]);
    const terrain = terrainResult as Record<string, unknown>;
    const satellite = { ...satelliteStats, catalogue } as Record<string, unknown>;
    return reply(200, {
      ok: true,
      farm_id: farmId,
      analysis_area: { type: "centroid_buffer_proxy", bbox, approximate_width_km: 1, not_farm_boundary: true },
      terrain,
      satellite,
      missing_domains: [
        ...(terrain.status === "available" ? [] : ["ارتفاع و شیب منطقه"]),
        ...(satelliteStats.status === "available" ? [] : ["پردازش NDVI و شاخص‌های پوشش گیاهی"]),
      ],
      retrieved_at: new Date().toISOString(),
    });
  } catch {
    return reply(200, {
      ok: true,
      farm_id: farmId,
      analysis_area: { type: "centroid_buffer_proxy", bbox, approximate_width_km: 1, not_farm_boundary: true },
      terrain: { status: "provider_unavailable", provider: "Copernicus DEM GLO-90" },
      satellite: {
        ...(await scenesPromise),
        analysis_status: "provider_unavailable",
        limitation: "دسترسی پردازشی Copernicus برقرار نشد؛ از فراداده صحنه‌ها به‌عنوان تحلیل تصویری استفاده نمی‌شود.",
      },
      missing_domains: ["ارتفاع و شیب منطقه", "پردازش NDVI و شاخص‌های پوشش گیاهی"],
    });
  }
});
