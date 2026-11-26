import { useState } from "react";
import { supabase } from "./lib/supabase";

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
  source?: string;
  data_kind?: string;
  retrieved_at?: string;
  location?: { latitude?: number; longitude?: number; timezone?: string };
  current?: { temperature_c?: number | null; apparent_temperature_c?: number | null; relative_humidity_pct?: number | null; wind_speed_m_s?: number | null; precipitation_mm?: number | null };
  forecast?: Array<{ date: string; max_c?: number | null; min_c?: number | null; precipitation_mm?: number | null; reference_evapotranspiration_mm?: number | null }>;
};
type Props = { farmId: string; farmName: string };

const fa = (value: unknown) => typeof value === "number" ? value.toLocaleString("fa-IR", { maximumFractionDigits: 1 }) : "—";

export default function FarmEnvironmentalAssessment({ farmId, farmName }: Props) {
  const [loading, setLoading] = useState(false);
  const [land, setLand] = useState<LandContext | null>(null);
  const [weather, setWeather] = useState<WeatherContext | null>(null);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");

  async function runAssessment() {
    if (!supabase || loading) return;
    setLoading(true);
    setError("");
    try {
      const [landResult, weatherResult] = await Promise.all([
        supabase.functions.invoke("farm-land-context", { body: { farm_id: farmId } }),
        supabase.functions.invoke("farm-weather-context", { body: { farm_id: farmId } }),
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
      setLand(landPayload.context);
      setWeather(weatherPayload);
      setUpdatedAt(new Date().toISOString());
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

  return <article className="panel" style={{ marginTop: 18 }}>
    <div className="section-title">
      <div><span className="eyebrow">AUTOMATIC FARM ENVIRONMENTAL ASSESSMENT</span><h2>پرونده محیطی خودکار · {farmName}</h2></div>
      <button className="text-button" type="button" onClick={() => void runAssessment()} disabled={loading || !supabase}>
        {loading ? "در حال دریافت داده‌ها..." : land ? "به‌روزرسانی ارزیابی" : "شروع ارزیابی محیطی"}
      </button>
    </div>
    <p className="muted">پس از ثبت موقعیت مزرعه، SARINA داده‌های موجود خاک، آب، گزارش‌های مزرعه و وضعیت جوی را از منابع متصل گردآوری می‌کند. اطلاعات اندازه‌گیری‌شده از برآوردهای منطقه‌ای جدا نگه داشته می‌شوند.</p>
    {error && <div className="notice warning" role="alert">{error}</div>}
    {!land && !loading && !error && <p className="muted">برای تشکیل پرونده اولیه، دکمه «شروع ارزیابی محیطی» را بزنید. این عملیات از سرویس‌های موجود SARINA استفاده می‌کند و به اطلاعات تخصصی کشاورز نیاز ندارد.</p>}
    {loading && <p className="muted" role="status">در حال بررسی منابع خاک، سوابق آزمایش آب و خاک و داده‌های جوی...</p>}
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
      <div className="notice" style={{ marginTop: 14 }}>
        <strong>محدودیت و دقت داده‌ها:</strong> پیش‌بینی جوی، داده مدل ارائه‌دهنده است نه اندازه‌گیری حسگر داخل مزرعه. SoilGrids در صورت دسترسی، برآورد مدل منطقه‌ای با تفکیک تقریبی ۲۵۰ متر است، نه آزمایش خاک این قطعه. کیفیت شیمیایی آب بدون آزمایش معتبر قابل تعیین نیست.
      </div>
      <small className="muted">آخرین دریافت: {new Date(updatedAt).toLocaleString("fa-IR")} · داده‌ها هنوز به‌صورت نسخه مستقل و ماندگار از پرونده محیطی ذخیره نشده‌اند.</small>
    </>}
  </article>;
}
