import {useCallback,useEffect,useMemo,useState} from "react";
import {Activity,AlertCircle,ArrowLeft,CalendarDays,CheckCircle2,ClipboardList,Clock3,Leaf,RefreshCw,Sprout,TrendingUp} from "lucide-react";
import type {Session} from "@supabase/supabase-js";
import {supabase} from "./lib/supabase";

type SupervisedFarm={
 service_contract_id:string;farm_id:string;farmer_user_id:string;farm_name:string;
 total_area:number|null;area_unit:string;country_id:string|null;contract_status:string;
 service_start_at:string|null;service_end_at:string|null;active_plan_count:number;
 overdue_action_count:number;actions_due_this_week_count:number;
 latest_productivity_measurement_at:string|null;latest_farm_observation_at:string|null;
};
type Measurement={
 farm_id:string;farm_name:string;metric_code:string;label_fa:string|null;label_en:string|null;
 default_unit:string|null;observed_at:string;period_start:string|null;period_end:string|null;
 metric_value:number|string;unit_code:string;source_type:string;confidence_score:number|null;
 quality_label:string;notes:string|null;
};
type ScheduledAction={
 action_id:string;plan_id:string;farm_id:string;farm_name:string;farmer_user_id:string;
 plan_title:string;plan_origin:string;plan_priority:string;plan_status:string;
 requires_expert_review:boolean;action_title:string;action_description:string|null;
 due_date:string|null;action_status:string;completed_at:string|null;outcome_notes:string|null;
 is_overdue:boolean;is_due_this_week:boolean;
};
const faDate=(value:string|null|undefined)=>value?new Date(value).toLocaleDateString("fa-IR"):"ثبت نشده";
const actionStatus=(value:string)=>({planned:"برنامه‌ریزی‌شده",in_progress:"در حال انجام",completed:"انجام‌شده",cancelled:"لغوشده",blocked:"متوقف‌شده"} as Record<string,string>)[value]||value;
const priorityText=(value:string)=>({urgent:"فوری",high:"زیاد",normal:"عادی",low:"کم"} as Record<string,string>)[value]||value;
const unitText=(value:string)=>value||"واحد ثبت نشده";

export default function SpecialistWorkspace({session}:{session:Session}){
 const[farms,setFarms]=useState<SupervisedFarm[]>([]);
 const[measurements,setMeasurements]=useState<Measurement[]>([]);
 const[actions,setActions]=useState<ScheduledAction[]>([]);
 const[selectedFarm,setSelectedFarm]=useState("");
 const[selectedMetric,setSelectedMetric]=useState("");
 const[loading,setLoading]=useState(true);
 const[refreshing,setRefreshing]=useState(false);
 const[error,setError]=useState("");
 const[notice,setNotice]=useState("");

 const load=useCallback(async()=>{
  if(!supabase)return;
  setError("");setNotice("");
  const client=supabase as any;
  const [farmResult,measurementResult,actionResult]=await Promise.all([
   client.from("expert_supervised_farm_dashboard").select("*").order("farm_name",{ascending:true}),
   client.from("expert_farm_productivity_timeline").select("*").order("observed_at",{ascending:false}).limit(600),
   client.from("expert_farm_action_schedule").select("*").order("due_date",{ascending:true}).limit(300)
  ]);
  const problems=[farmResult.error,measurementResult.error,actionResult.error].filter(Boolean);
  if(farmResult.error){setError("دریافت فهرست مزارع تحت نظارت ممکن نشد: "+farmResult.error.message);setFarms([]);}
  else setFarms((farmResult.data??[]) as SupervisedFarm[]);
  if(measurementResult.error){setMeasurements([]);setNotice("اطلاعات نمودار بهره‌وری در دسترس نیست: "+measurementResult.error.message);}
  else setMeasurements((measurementResult.data??[]) as Measurement[]);
  if(actionResult.error){setActions([]);setNotice("برنامه اقدامات بارگذاری نشد: "+actionResult.error.message);}
  else setActions((actionResult.data??[]) as ScheduledAction[]);
  if(!farmResult.error&&!problems.length)setNotice("اطلاعات از پرونده‌ها و برنامه‌های موجود SARINA دریافت شد.");
  setLoading(false);setRefreshing(false);
 },[]);

 useEffect(()=>{setLoading(true);void load();},[session.user.id,load]);

 const activeFarmId=selectedFarm||farms[0]?.farm_id||"";
 const activeFarm=farms.find(f=>f.farm_id===activeFarmId)||null;
 const farmMeasurements=useMemo(()=>measurements.filter(m=>m.farm_id===activeFarmId),[measurements,activeFarmId]);
 const metrics=useMemo(()=>Array.from(new Map(farmMeasurements.map(m=>[m.metric_code,{code:m.metric_code,label:m.label_fa||m.label_en||m.metric_code,unit:m.unit_code||m.default_unit||""}])).values()),[farmMeasurements]);
 const metricCode=metrics.some(m=>m.code===selectedMetric)?selectedMetric:(metrics[0]?.code||"");
 const chartRows=useMemo(()=>farmMeasurements.filter(m=>m.metric_code===metricCode).slice().sort((a,b)=>new Date(a.observed_at).getTime()-new Date(b.observed_at).getTime()).slice(-24),[farmMeasurements,metricCode]);
 const chartPoints=useMemo(()=>{
  if(!chartRows.length)return "";
  const values=chartRows.map(r=>Number(r.metric_value)).filter(Number.isFinite);
  if(!values.length)return "";
  const min=Math.min(...values),max=Math.max(...values),range=max-min||1;
  return chartRows.map((r,i)=>{
   const x=30+(i*(540/Math.max(chartRows.length-1,1)));
   const y=166-((Number(r.metric_value)-min)/range)*126;
   return x.toFixed(1)+","+y.toFixed(1);
  }).join(" ");
 },[chartRows]);
 const summary=useMemo(()=>{
  const overdue=actions.filter(a=>a.is_overdue&&a.action_status!=="completed");
  const due=actions.filter(a=>a.is_due_this_week&&a.action_status!=="completed");
  const stale=farms.filter(f=>!f.latest_farm_observation_at||Date.now()-new Date(f.latest_farm_observation_at).getTime()>14*86400000);
  return {overdue,due,stale};
 },[actions,farms]);
 const visibleActions=actions.filter(a=>a.farm_id===activeFarmId&&(a.is_overdue||a.is_due_this_week||a.action_status==="in_progress"));
 const handleRefresh=async()=>{setRefreshing(true);await load();};

 return <section className="specialist-workspace" dir="rtl">
  <div className="specialist-heading">
   <div><span className="eyebrow">SARINA · Farm Productivity Intelligence</span><h1>داشبورد متخصص</h1><p>نمای یکپارچه مزارع تحت نظارت، روند بهره‌وری و برنامه هفتگی کشاورزان.</p></div>
   <button className="specialist-refresh" onClick={()=>void handleRefresh()} disabled={loading||refreshing}><RefreshCw size={15} className={refreshing?"spin":""}/>{refreshing?"در حال به‌روزرسانی":"به‌روزرسانی اطلاعات"}</button>
  </div>
  {error&&<div className="notice warning" role="alert">{error}</div>}
  {notice&&!error&&<div className="specialist-data-note"><CheckCircle2 size={15}/>{notice}</div>}
  {loading?<div className="empty-state">در حال دریافت مزارع و برنامه‌های تحت نظارت...</div>:<>
   <div className="specialist-kpis">
    <article className="specialist-kpi"><span><Sprout size={19}/></span><small>مزارع تحت نظارت فعال</small><strong>{farms.length.toLocaleString("fa-IR")}</strong><em>بر اساس قرارداد معتبر</em></article>
    <article className="specialist-kpi"><span className="sand"><CalendarDays size={19}/></span><small>اقدامات برنامه‌ریزی‌شده این هفته</small><strong>{summary.due.length.toLocaleString("fa-IR")}</strong><em>از برنامه‌های بهبود موجود</em></article>
    <article className="specialist-kpi"><span className="rose"><AlertCircle size={19}/></span><small>اقدامات عقب‌افتاده</small><strong>{summary.overdue.length.toLocaleString("fa-IR")}</strong><em>نیازمند پیگیری</em></article>
    <article className="specialist-kpi"><span className="blue"><Activity size={19}/></span><small>مزارع نیازمند ثبت مشاهده</small><strong>{summary.stale.length.toLocaleString("fa-IR")}</strong><em>بدون مشاهده جدید در ۱۴ روز اخیر</em></article>
   </div>

   {farms.length===0?<div className="specialist-empty"><span><Sprout size={30}/></span><h2>هنوز مزرعه‌ای به نظارت شما متصل نشده است</h2><p>پس از تأیید قرارداد خدمات و پذیرش آن توسط کشاورز و متخصص، مزرعه به‌صورت خودکار در این داشبورد نمایش داده می‌شود.</p></div>:<>
    <div className="specialist-section-head"><div><span className="eyebrow">نظارت و پرونده‌ها</span><h2>مزارع تحت نظر شما</h2></div><span className="specialist-count">{farms.length.toLocaleString("fa-IR")} مزرعه</span></div>
    <div className="specialist-farm-grid">
     {farms.map(f=><button key={f.service_contract_id} className={"specialist-farm-card"+(activeFarmId===f.farm_id?" selected":"")} onClick={()=>setSelectedFarm(f.farm_id)}>
      <div className="specialist-farm-top"><span><Leaf size={17}/></span><small>{f.contract_status==="active"?"قرارداد فعال":"پذیرفته‌شده"}</small></div>
      <h3>{f.farm_name}</h3><p>{f.total_area?Number(f.total_area).toLocaleString("fa-IR")+" "+f.area_unit:"مساحت ثبت نشده"}</p>
      <div className="specialist-farm-meta"><span>{Number(f.active_plan_count||0).toLocaleString("fa-IR")} برنامه فعال</span><span>{Number(f.overdue_action_count||0).toLocaleString("fa-IR")} عقب‌افتاده</span></div>
     </button>)}
    </div>

    {activeFarm&&<div className="specialist-detail-grid">
     <article className="specialist-panel">
      <div className="specialist-panel-head"><div><span className="eyebrow">پرونده مزرعه</span><h2>{activeFarm.farm_name}</h2></div><span className="specialist-panel-icon"><ClipboardList size={18}/></span></div>
      <div className="specialist-facts">
       <div><small>مساحت</small><strong>{activeFarm.total_area?Number(activeFarm.total_area).toLocaleString("fa-IR")+" "+activeFarm.area_unit:"ثبت نشده"}</strong></div>
       <div><small>شروع همکاری</small><strong>{faDate(activeFarm.service_start_at)}</strong></div>
       <div><small>آخرین اندازه‌گیری بهره‌وری</small><strong>{faDate(activeFarm.latest_productivity_measurement_at)}</strong></div>
       <div><small>آخرین مشاهده مزرعه</small><strong>{faDate(activeFarm.latest_farm_observation_at)}</strong></div>
      </div>
      <p className="specialist-panel-foot">اطلاعات این بخش از پرونده اصلی مزرعه و قرارداد خدمات خوانده می‌شود؛ تغییرات پرونده از مسیرهای مجاز SARINA ثبت می‌شوند.</p>
     </article>
     <article className="specialist-panel specialist-chart-panel">
      <div className="specialist-panel-head"><div><span className="eyebrow">روند اندازه‌گیری‌ها</span><h2>نمودار بهره‌وری مزرعه</h2></div><span className="specialist-panel-icon"><TrendingUp size={18}/></span></div>
      {metrics.length>0&&<label className="specialist-metric-select">شاخص مورد بررسی<select value={metricCode} onChange={e=>setSelectedMetric(e.target.value)}>{metrics.map(m=><option key={m.code} value={m.code}>{m.label} · {m.unit}</option>)}</select></label>}
      {chartRows.length<2?<div className="specialist-chart-empty"><Activity size={25}/><strong>برای رسم روند، دست‌کم دو اندازه‌گیری لازم است.</strong><span>پس از ثبت داده‌های دوره‌ای، نمودار رشد اینجا نمایش داده می‌شود.</span></div>:<>
       <div className="specialist-chart-value"><strong>{Number(chartRows[chartRows.length-1].metric_value).toLocaleString("fa-IR")}</strong><span>{unitText(chartRows[chartRows.length-1].unit_code)}</span></div>
       <svg className="specialist-line-chart" viewBox="0 0 600 190" role="img" aria-label="نمودار روند اندازه‌گیری شاخص بهره‌وری">
        <defs><linearGradient id="specialist-chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#6d9c72" stopOpacity=".25"/><stop offset="100%" stopColor="#6d9c72" stopOpacity="0"/></linearGradient></defs>
        {[40,82,124,166].map(y=><line key={y} x1="30" x2="570" y1={y} y2={y} stroke="#e8eee7" strokeDasharray="4 5"/>)} 
        <polyline points={chartPoints} fill="none" stroke="#3d7955" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
        {chartRows.map((r,i)=>{const x=30+(i*(540/Math.max(chartRows.length-1,1)));const vals=chartRows.map(z=>Number(z.metric_value)).filter(Number.isFinite);const min=Math.min(...vals),range=Math.max(...vals)-min||1;const y=166-((Number(r.metric_value)-min)/range)*126;return <circle key={r.observed_at+i} cx={x} cy={y} r="4" fill="#fff" stroke="#3d7955" strokeWidth="2"/>;})}
       </svg>
       <div className="specialist-chart-dates"><span>{faDate(chartRows[0].observed_at)}</span><span>{faDate(chartRows[chartRows.length-1].observed_at)}</span></div>
       <p className="specialist-chart-note">نقاط نمودار از اندازه‌گیری‌های ثبت‌شده می‌آیند؛ این روند به‌تنهایی اثبات‌کننده اثر یک اقدام خاص نیست.</p>
      </>}
      {metrics.length===0&&<div className="specialist-chart-empty"><Activity size={25}/><strong>هنوز اندازه‌گیری بهره‌وری ثبت نشده است.</strong><span>با ثبت خط پایه و اندازه‌گیری‌های دوره‌ای، نمودار فعال می‌شود.</span></div>}
     </article>
    </div>

    <div className="specialist-section-head specialist-week-head"><div><span className="eyebrow">پیگیری اجرایی</span><h2>برنامه هفتگی و اقدامات</h2></div><span className="specialist-count">{visibleActions.length.toLocaleString("fa-IR")} اقدام برای این مزرعه</span></div>
    {visibleActions.length===0?<div className="specialist-chart-empty"><CalendarDays size={25}/><strong>برای این مزرعه اقدام عقب‌افتاده یا برنامه‌ریزی‌شده‌ای در هفته جاری ثبت نشده است.</strong><span>برنامه‌های جدید پس از ثبت در پرونده به این قسمت اضافه می‌شوند.</span></div>:<div className="specialist-action-list">{visibleActions.map(a=><article className="specialist-action-row" key={a.action_id}>
     <span className={"specialist-action-state "+(a.action_status==="completed"?"done":a.is_overdue?"late":"planned")}>{a.action_status==="completed"?<CheckCircle2 size={17}/>:a.is_overdue?<AlertCircle size={17}/>:<Clock3 size={17}/>}</span>
     <div className="specialist-action-copy"><strong>{a.action_title}</strong><small>{a.farm_name} · {a.plan_title}</small>{a.action_description&&<p>{a.action_description}</p>}</div>
     <div className="specialist-action-meta"><span>{a.due_date?faDate(a.due_date):"بدون موعد"}</span><small>{actionStatus(a.action_status)} · اولویت {priorityText(a.plan_priority)}</small></div>
    </article>)}</div>}
    </>}
   <div className="specialist-assistant-note"><span><Activity size={19}/></span><div><strong>خلاصه پایش دستیار متخصص</strong><p>این نسخه، هشدارهای عملیاتی را از موعد اقدامات و تاریخ آخرین مشاهده/اندازه‌گیری استخراج می‌کند. تولید تحلیل زبانی، پیشنهاد علمی و گزارش خودکار زمان‌بندی‌شده در گام بعدی به موتور دستیار متصل خواهد شد.</p></div></div>
  </>}
 </section>;
}
