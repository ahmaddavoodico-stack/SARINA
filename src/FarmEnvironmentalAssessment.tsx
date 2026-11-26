import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import type { Json } from "./lib/database.types";

type LandContext = {
  farm?: { id?: string; farm_name?: string };
  location?: { latitude?: number | null; longitude?: number | null; elevation_m?: number | null; confirmed_by_user?: boolean };
  soil_tests?: unknown[];
  water_tests?: unknown[];
  regional_context?: { soilgrids?: { status?: string; provider?: string; resolution_m?: number; message?: string; checked_at?: string }; status?: string };
  data_quality?: { soil_test_count?: number; water_test_count?: number; regional_dataset_available?: boolean; soilgrids_status?: string };
  safety?: { do_not_use_as_lab_test?: boolean; missing_values_must_remain_missing?: boolean };
};
type WeatherContext = {
  farm_id?: string;
  source?: string;
  data_kind?: string;
  retrieved_at?: string;
  location?: { latitude?: number; longitude?: number; timezone?: string };
  current?: { temperature_c?: number | null; apparent_temperature_c?: number | null; relative_humidity_pct?: number | null; wind_speed_m_s?: number | null; precipitation_mm?: number | null };
  forecast?: Array<{ date: string; max_c?: number | null; min_c?: number | null; precipitation_mm?: number | null; reference_evapotranspiration_mm?: number | null }>;
};
type ClimateContext = {
  status?: string; source?: string; source_dataset?: string; data_kind?: string;
  spatial_resolution_degrees?: number; approximate_spatial_resolution_km?: number;
  temporal_coverage_requested?: string; temporal_coverage_returned?: string | null;
  years_covered?: number[]; retrieved_at?: string; limitation?: string;
  summary?: {
    monthly_normals?: Array<{ month: number; mean_daily_max_c?: number | null; mean_daily_min_c?: number | null; mean_daily_precipitation_mm?: number | null; mean_daily_reference_et0_mm?: number | null; sample_days?: number }>;
    annual_mean_precipitation_mm?: number | null; annual_mean_reference_et0_mm?: number | null;
    annual_heat_days_ge_40c_mean?: number | null; annual_heat_days_ge_45c_mean?: number | null;
    historical_max_daily_temperature_c?: number | null; historical_max_daily_temperature_date?: string | null;
  };
};
type SpatialContext = {
  analysis_area?: { type?: string; approximate_width_km?: number; not_farm_boundary?: boolean };
  terrain?: {
    status?: string; provider?: string; data_kind?: string; native_resolution_m?: number;
    retrieved_at?: string; limitation?: string;
    summary?: { elevation_min_m?: number; elevation_mean_m?: number; elevation_max_m?: number; mean_slope_degrees?: number | null; max_slope_degrees?: number | null; valid_pixel_count?: number };
  };
  satellite?: {
    status?: string; provider?: string; index?: string; data_kind?: string; spatial_resolution_m?: number;
    temporal_window?: { from?: string; to?: string }; aggregation_interval?: string; limitation?: string;
    windows?: Array<{ from?: string; to?: string; mean?: number | null; min?: number | null; max?: number | null; valid_pixel_count?: number; no_data_pixel_count?: number }>;
    catalogue?: { status?: string; scenes?: Array<{ id?: string | null; acquired_at?: string | null; cloud_cover_pct?: number | null }> };
    analysis_status?: string;
  };
  missing_domains?: string[];
};
type Snapshot = {
  id: string;
  version: number;
  assessment_status: string;
  assessed_at: string;
  missing_domains: string[];
  source_manifest: Array<{ source?: string; source_type?: string; status?: string; limitation?: string }>;
  evidence_payload: { land?: LandContext; weather?: WeatherContext; climate?: ClimateContext; spatial?: SpatialContext };
};
type Props = { farmId: string; farmName: string };

const fa = (value: unknown) => typeof value === "number" ? value.toLocaleString("fa-IR", { maximumFractionDigits: 1 }) : "—";
const statusLabel = (value: string) => value === "needs_review" ? "نیازمند تکمیل و بررسی" : value === "complete" ? "تکمیل‌شده" : "نسخه اولیه / ناقص";

export default function FarmEnvironmentalAssessment({ farmId, farmName }: Props) {
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [land, setLand] = useState<LandContext | null>(null);
  const [weather, setWeather] = useState<WeatherContext | null>(null);
  const [climate, setClimate] = useState<ClimateContext | null>(null);\n  const [spatial, setSpatial] = useState<SpatialContext | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [error, setError] = useState("");

  async function loadHistory() {
    if (!supabase) return;
    setLoadingHistory(true);
    const { data, error: readError } = await supabase
      .from("farm_environmental_assessments")
      .select("id, version, assessment_status, assessed_at, missing_domains, source_manifest, evidence_payload")
      .eq("farm_id", farmId)
      .order("version", { ascending: false })
      .limit(10);
    if (readError) {
      setError("خواندن تاریخچه پرونده محیطی انجام نشد: " + readError.message);
      setLoadingHistory(false);
      return;
    }
    const rows = (data ?? []) as unknown as Snapshot[];
    setSnapshots(rows);
    const latest = rows[0];
    if (latest?.evidence_payload?.land && latest.evidence_payload.weather) {
      setLand(latest.evidence_payload.land);
      setWeather(latest.evidence_payload.weather);
      setClimate(latest.evidence_payload.climate ?? null);\n      setSpatial(latest.evidence_payload.spatial ?? null);
    }
    setLoadingHistory(false);
  }

  useEffect(() => {
    void loadHistory();
  }, [farmId]);

  async function runAssessment() {
    if (!supabase || loading) return;
    setLoading(true);
    setError("");
    try {
      const [landResult, weatherResult, climateResult, spatialResult] = await Promise.all([
        supabase.functions.invoke("farm-land-context", { body: { farm_id: farmId } }),
        supabase.functions.invoke("farm-weather-context", { body: { farm_id: farmId } }),
        supabase.functions.invoke("farm-historical-climate-context", { body: { farm_id: farmId } }),\n        supabase.functions.invoke("farm-spatial-context", { body: { farm_id: farmId } }),
      ]);
      if (landResult.error) throw new Error("دریافت پرونده خاک و آب انجام نشد: " + landResult.error.message);
      if (weatherResult.error) throw new Error("دریافت اطلاعات جوی انجام نشد: " + weatherResult.error.message);
      const landPayload = landResult.data as { ok?: boolean; context?: LandContext; code?: string } | null;
      if (!landPayload?.ok || !landPayload.context?.farm || landPayload.context.farm.id !== farmId) {
        throw new Error("پاسخ ارزیابی خاک و آب معتبر نیست یا به این مزرعه تعلق ندارد.");
      }
      const weatherPayload = weatherResult.data as WeatherContext & { ok?: boolean; code?: string };
      if (weatherPayload?.code || weatherPayload?.farm_id !== farmId || !weatherPayload.current) {
        throw new Error("پاسخ هواشناسی معتبر نیست یا برای این مزرعه دریافت نشده است.");
      }

      const climatePayload = !climateResult.error && climateResult.data?.ok === true && climateResult.data?.farm_id === farmId
        ? climateResult.data.climate as ClimateContext
        : { status: "request_failed", source: "Open-Meteo Historical Weather API (ERA5-Land)", data_kind: "reanalysis_model_estimate", limitation: "دریافت اقلیم تاریخی انجام نشد؛ داده‌ای جایگزین یا حدس زده نشده است." } as ClimateContext;
      const spatialPayload = !spatialResult.error && spatialResult.data?.ok === true && spatialResult.data?.farm_id === farmId\n        ? spatialResult.data as SpatialContext\n        : { terrain: { status: "request_failed" }, satellite: { status: "request_failed" }, missing_domains: ["ارتفاع و شیب منطقه", "پردازش NDVI و شاخص‌های پوشش گیاهی"] } as SpatialContext;\n      const soilCount = landPayload.context.data_quality?.soil_test_count ?? landPayload.context.soil_tests?.length ?? 0;
      const waterCount = landPayload.context.data_quality?.water_test_count ?? landPayload.context.water_tests?.length ?? 0;
      const soilGridStatus = landPayload.context.regional_context?.soilgrids?.status ?? "not_available";
      const missingDomains = [
        ...(soilCount === 0 ? ["آزمایش اختصاصی خاک"] : []),
        ...(waterCount === 0 ? ["آزمایش کیفیت آب"] : []),
        ...(soilGridStatus !== "available" ? ["برآورد منطقه‌ای خاک"] : []),
        ...(climatePayload.status !== "available" ? ["اقلیم بلندمدت و میانگین‌های چندساله"] : []),
        "ارتفاع، شیب و تحلیل توپوگرافی",
        ...(spatialPayload.terrain?.status !== "available" ? ["ارتفاع و شیب منطقه"] : []),\n        ...(spatialPayload.satellite?.status !== "available" ? ["پردازش NDVI و شاخص‌های پوشش گیاهی"] : []),
      ];
      const sourceManifest = [
        {
          source: landPayload.context.regional_context?.soilgrids?.provider ?? "ISRIC SoilGrids",
          source_type: "gridded_soil_model",
          status: soilGridStatus,
          spatial_resolution_m: landPayload.context.regional_context?.soilgrids?.resolution_m ?? null,
          retrieved_at: landPayload.context.regional_context?.soilgrids?.checked_at ?? new Date().toISOString(),
          limitation: "برآورد شبکه‌ای منطقه‌ای است و جایگزین نمونه‌برداری و آزمایش خاک مزرعه نیست.",
        },
        {
          source: weatherPayload.source ?? "weather provider",
          source_type: weatherPayload.data_kind ?? "weather_model",
          status: "retrieved",
          retrieved_at: weatherPayload.retrieved_at ?? new Date().toISOString(),
          limitation: "شرایط مدل/پیش‌بینی است و اندازه‌گیری حسگر داخل مزرعه محسوب نمی‌شود.",
        },
        {
          source: climatePayload.source ?? "Open-Meteo Historical Weather API",
          source_type: climatePayload.data_kind ?? "historical_reanalysis_model_estimate",
          status: climatePayload.status ?? "not_available",
          temporal_coverage: climatePayload.temporal_coverage_returned ?? climatePayload.temporal_coverage_requested ?? null,
          spatial_resolution_km: climatePayload.approximate_spatial_resolution_km ?? null,
          retrieved_at: climatePayload.retrieved_at ?? new Date().toISOString(),
          limitation: climatePayload.limitation ?? "اقلیم بلندمدت در دسترس نیست؛ مقادیر خالی باقی می‌مانند.",
        },
        {
          source: "SARINA farm laboratory records",
          source_type: "farm_specific_measurements",
          status: soilCount + waterCount > 0 ? "available" : "no_records",
          soil_test_count: soilCount,
          water_test_count: waterCount,
        },
      ];

      const { error: saveError } = await supabase.from("farm_environmental_assessments").insert({
        farm_id: farmId,
        assessment_status: missingDomains.length ? "needs_review" : "partial",
        source_manifest: sourceManifest as unknown as Json,
        evidence_payload: { land: landPayload.context, weather: weatherPayload, climate: climatePayload, spatial: spatialPayload } as unknown as Json,
        quality_summary: {
          soil_test_count: soilCount,
          water_test_count: waterCount,
          soilgrids_status: soilGridStatus,
          weather_source: weatherPayload.source ?? "provider_not_reported",
          historical_climate_status: climatePayload.status ?? "not_available",\n          terrain_status: spatialPayload.terrain?.status ?? "not_available",\n          satellite_vegetation_status: spatialPayload.satellite?.status ?? "not_available",
          evidence_classes: ["farm_measurement", "regional_model_estimate", "weather_model"],
          missing_values_policy: "unknown_values_remain_null",
        } as unknown as Json,
        missing_domains: missingDomains as unknown as Json,
      });
      if (saveError) throw new Error("داده‌ها دریافت شدند اما ذخیره نسخه پایدار پرونده انجام نشد: " + saveError.message);

      setLand(landPayload.context);
      setWeather(weatherPayload);
      setClimate(climatePayload);
      await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ارزیابی محیطی مزرعه انجام نشد.");
    } finally {
      setLoading(false);
    }
  }

  const soilStatus = land?.regional_context?.soilgrids?.status ?? "not_run";
  const soilStatusLabel = soilStatus === "available" ? "داده منطقه‌ای دریافت شد" :
    soilStatus === "provider_unavailable" ? "منبع خاک فعلاً در دسترس نیست" :
    soilStatus === "waiting_for_confirmed_coordinates" ? "نیازمند مختصات معتبر" : "هنوز بررسی نشده";
  const latest = snapshots[0];

  return <article className="panel" style={{ marginTop: 18 }}>
    <div className="section-title">
      <div><span className="eyebrow">AUTOMATIC FARM ENVIRONMENTAL ASSESSMENT</span><h2>پرونده محیطی خودکار · {farmName}</h2></div>
      <button className="text-button" type="button" onClick={() => void runAssessment()} disabled={loading || loadingHistory || !supabase}>
        {loading ? "در حال ارزیابی و ثبت نسخه..." : latest ? "به‌روزرسانی و ثبت نسخه جدید" : "شروع ارزیابی و تشکیل پرونده"}
      </button>
    </div>
    <p className="muted">هر بار ارزیابی موفق، یک نسخه مستقل و غیرقابل بازنویسی ثبت می‌کند. برآوردهای منطقه‌ای، مدل‌های جوی و اندازه‌گیری‌های اختصاصی مزرعه جداگانه نگهداری می‌شوند.</p>
    {error && <div className="notice warning" role="alert">{error}</div>}
    {loadingHistory && <p className="muted" role="status">در حال بارگذاری تاریخچه پرونده...</p>}
    {!latest && !loading && !loadingHistory && !error && <p className="muted">برای تشکیل اولین نسخه پرونده، دکمه ارزیابی را انتخاب کنید.</p>}
    {loading && <p className="muted" role="status">در حال دریافت منابع خاک، آب و هوا و ذخیره نسخه جدید...</p>}
    {land && weather && <>
      <div className="farm-form-grid" style={{ marginTop: 16 }}>
        <div className="panel"><strong>موقعیت مزرعه</strong><p>{land.location?.confirmed_by_user ? "تأییدشده توسط کاربر" : "نیازمند تأیید موقعیت"}</p><small className="muted">مختصات: {fa(land.location?.latitude)} ، {fa(land.location?.longitude)}</small></div>
        <div className="panel"><strong>سوابق آزمایشگاهی</strong><p>{fa(land.data_quality?.soil_test_count ?? 0)} آزمایش خاک · {fa(land.data_quality?.water_test_count ?? 0)} آزمایش آب</p><small className="muted">نبود آزمایش به معنی مناسب بودن خاک یا آب نیست.</small></div>
        <div className="panel"><strong>داده خاک منطقه‌ای</strong><p>{soilStatusLabel}</p><small className="muted">{land.regional_context?.soilgrids?.provider ?? "ISRIC SoilGrids"} · تفکیک مکانی اسمی {fa(land.regional_context?.soilgrids?.resolution_m)} متر</small></div>
        <div className="panel"><strong>وضعیت جوی فعلی مدل</strong><p>{fa(weather.current?.temperature_c)}°C · رطوبت {fa(weather.current?.relative_humidity_pct)}٪</p><small className="muted">باد {fa(weather.current?.wind_speed_m_s)} متر بر ثانیه · بارش {fa(weather.current?.precipitation_mm)} میلی‌متر</small></div>
      </div>
      <div style={{ marginTop: 16 }}>
        <strong>پیش‌بینی هفت‌روزه</strong>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>روز</th><th>کمینه</th><th>بیشینه</th><th>بارش</th><th>تبخیر و تعرق مرجع</th></tr></thead><tbody>
          {(weather.forecast ?? []).map(day => <tr key={day.date}><td>{day.date}</td><td>{fa(day.min_c)}°</td><td>{fa(day.max_c)}°</td><td>{fa(day.precipitation_mm)} mm</td><td>{fa(day.reference_evapotranspiration_mm)} mm</td></tr>)}
        </tbody></table></div>
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <strong>اقلیم بلندمدت منطقه · بازه مرجع ۱۹۹۱ تا ۲۰۲۰</strong>
        <p>{climate?.status === "available" ? "داده بازتحلیل اقلیمی دریافت شد" : climate?.status === "provider_license_not_configured" ? "اتصال منبع نیازمند مجوز استفاده تجاری است" : climate?.status === "waiting_for_confirmed_location" ? "برای تحلیل اقلیم، موقعیت مزرعه باید تأیید شود" : "داده اقلیم بلندمدت هنوز در دسترس نیست"}</p>
        {climate?.summary && <>
          <div className="farm-form-grid">
            <div><small className="muted">میانگین بارش سالانه</small><p>{fa(climate.summary.annual_mean_precipitation_mm)} میلی‌متر</p></div>
            <div><small className="muted">روزهای سالانه با بیشینه حداقل ۴۰ درجه</small><p>{fa(climate.summary.annual_heat_days_ge_40c_mean)} روز</p></div>
            <div><small className="muted">روزهای سالانه با بیشینه حداقل ۴۵ درجه</small><p>{fa(climate.summary.annual_heat_days_ge_45c_mean)} روز</p></div>
            <div><small className="muted">بیشینه دمای روزانه مدل در بازه</small><p>{fa(climate.summary.historical_max_daily_temperature_c)}°C · {climate.summary.historical_max_daily_temperature_date ?? "—"}</p></div>
          </div>
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>ماه</th><th>میانگین بیشینه روزانه</th><th>میانگین کمینه روزانه</th><th>میانگین بارش روزانه</th></tr></thead><tbody>
            {(climate.summary.monthly_normals ?? []).map(month => <tr key={month.month}><td>{fa(month.month)}</td><td>{fa(month.mean_daily_max_c)}°C</td><td>{fa(month.mean_daily_min_c)}°C</td><td>{fa(month.mean_daily_precipitation_mm)} mm</td></tr>)}
          </tbody></table></div>
        </>}
        <small className="muted">{climate?.source ?? "Open-Meteo / ERA5-Land"} · {climate?.approximate_spatial_resolution_km ? "تفکیک تقریبی " + fa(climate.approximate_spatial_resolution_km) + " کیلومتر" : "تفکیک مکانی منطقه‌ای"} · {climate?.limitation ?? "داده مدل بازتحلیل است، نه اندازه‌گیری ایستگاهی داخل مزرعه."}</small>
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <strong>ارتفاع، شیب و توپوگرافی منطقه</strong>
        <p>{spatial?.terrain?.status === "available" ? "داده مدل ارتفاعی دریافت و تحلیل شد" : spatial?.terrain?.status === "provider_credentials_not_configured" ? "اتصال پردازش Copernicus هنوز پیکربندی نشده است" : "داده ارتفاع و شیب فعلاً در دسترس نیست"}</p>
        {spatial?.terrain?.summary && <>
          <div className="farm-form-grid">
            <div><small className="muted">حداقل ارتفاع</small><p>{fa(spatial.terrain.summary.elevation_min_m)} متر</p></div>
            <div><small className="muted">میانگین ارتفاع</small><p>{fa(spatial.terrain.summary.elevation_mean_m)} متر</p></div>
            <div><small className="muted">حداکثر ارتفاع</small><p>{fa(spatial.terrain.summary.elevation_max_m)} متر</p></div>
            <div><small className="muted">میانگین شیب منطقه‌ای</small><p>{fa(spatial.terrain.summary.mean_slope_degrees)}°</p></div>
            <div><small className="muted">بیشینه شیب محاسبه‌شده</small><p>{fa(spatial.terrain.summary.max_slope_degrees)}°</p></div>
          </div>
        </>}
        <small className="muted">{spatial?.terrain?.provider ?? "Copernicus DEM GLO-90"} · تفکیک بومی ۹۰ متر · {spatial?.terrain?.limitation ?? "این داده جایگزین نقشه‌برداری دقیق مزرعه نیست."}</small>
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <strong>پایش پوشش گیاهی با Sentinel-2</strong>
        <p>{spatial?.satellite?.status === "available" ? "شاخص NDVI از تصاویر ماهواره‌ای پردازش شد" : spatial?.satellite?.analysis_status === "scene_discovery_only" ? "فقط فراداده تصاویر شناسایی شده؛ تحلیل شاخص هنوز فعال نیست" : "تحلیل طیفی ماهواره‌ای فعلاً در دسترس نیست"}</p>
        {spatial?.satellite?.windows && <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>بازه</th><th>میانگین NDVI</th><th>کمینه</th><th>بیشینه</th><th>پیکسل معتبر</th></tr></thead><tbody>
          {spatial.satellite.windows.map((window, index) => <tr key={String(window.from ?? index)}><td>{window.from ? new Date(window.from).toLocaleDateString("fa-IR") : "—"} تا {window.to ? new Date(window.to).toLocaleDateString("fa-IR") : "—"}</td><td>{fa(window.mean)}</td><td>{fa(window.min)}</td><td>{fa(window.max)}</td><td>{fa(window.valid_pixel_count)}</td></tr>)}
        </tbody></table></div>}
        {spatial?.satellite?.catalogue?.scenes && spatial.satellite.catalogue.scenes.length > 0 && <p>صحنه‌های شناسایی‌شده در کاتالوگ: {fa(spatial.satellite.catalogue.scenes.length)} · آخرین دریافت: {spatial.satellite.catalogue.scenes[0].acquired_at ? new Date(spatial.satellite.catalogue.scenes[0].acquired_at).toLocaleDateString("fa-IR") : "—"} · پوشش ابر: {fa(spatial.satellite.catalogue.scenes[0].cloud_cover_pct)}٪</p>}
        <small className="muted">{spatial?.satellite?.provider ?? "Copernicus Sentinel-2 L2A"} · تفکیک شاخص ۱۰ متر · {spatial?.satellite?.limitation ?? "شاخص NDVI به‌تنهایی نوع محصول یا سلامت قطعی درخت را مشخص نمی‌کند."}</small>
      </div>
      <div className="notice" style={{ marginTop: 14 }}>
        <strong>محدودیت و دقت داده‌ها:</strong> پیش‌بینی جوی، داده مدل ارائه‌دهنده است نه اندازه‌گیری حسگر داخل مزرعه. SoilGrids در صورت دسترسی، برآورد مدل منطقه‌ای با تفکیک تقریبی ۲۵۰ متر است، نه آزمایش خاک این قطعه. ERA5-Land نیز بازتحلیل شبکه‌ای حدود ۹ کیلومتر است و شرایط خرداقلیم مزرعه را به‌تنهایی نشان نمی‌دهد. مدل ارتفاعی Copernicus GLO-90 تفکیک ۹۰ متر دارد و DSM است؛ شیب آن صرفاً زمینه منطقه‌ای است. تا زمان ثبت مرز دقیق مزرعه، تحلیل ماهواره‌ای روی محدوده تقریبی اطراف نقطه اصلی انجام می‌شود، نه مرز قطعه.
      </div>
    </>}
    {snapshots.length > 0 && <div style={{ marginTop: 16 }}>
      <strong>تاریخچه نسخه‌های پرونده</strong>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>نسخه</th><th>تاریخ ثبت</th><th>وضعیت</th><th>موارد نیازمند تکمیل</th></tr></thead><tbody>
        {snapshots.map(snapshot => <tr key={snapshot.id}><td>v{fa(snapshot.version)}</td><td>{new Date(snapshot.assessed_at).toLocaleString("fa-IR")}</td><td>{statusLabel(snapshot.assessment_status)}</td><td>{fa(snapshot.missing_domains?.length ?? 0)}</td></tr>)}
      </tbody></table></div>
    </div>}
    <small className="muted">نسخه جاری: {latest ? "v" + latest.version : "هنوز ثبت نشده"} · هر نسخه قبلی برای حفظ سابقه تغییرات باقی می‌ماند.</small>
  </article>;
}
