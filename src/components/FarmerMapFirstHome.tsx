import {useEffect,useMemo,useRef,useState} from "react";
import type {Session} from "@supabase/supabase-js";
import {CalendarDays,ChevronLeft,ChevronRight,MapPin,Plus,Sprout,TrendingUp} from "lucide-react";
import {supabase} from "../lib/supabase";

type Farm={id:string;farm_name:string;total_area:number|null;area_unit:string};
type Field={id:string;farm_id:string;field_name:string;area:number|null;area_unit:string;boundary:any};
type Recommendation={id:string;request_id:string;farm_id:string;title:string;instructions:string;priority:string;starts_on:string;due_on:string|null;status:string;expert_profile_id:string;farmer_note:string|null;field_id?:string|null};
type PersonalAction={id:string;plan_id:string;title:string;status:string;due_date:string|null};
type Plan={id:string;farm_id:string;title:string;status:string;origin:string};
type Baseline={baseline_date:string;metrics_snapshot:Record<string,any>};
type Measurement={metric_code:string;metric_value:number;unit_code:string;observed_at:string};
declare global{interface Window{L?:any}}
const db=supabase as any;
const n=(v:number)=>v.toLocaleString("fa-IR",{maximumFractionDigits:2});
function boundaryRings(value:any):[number,number][][]{try{const g=typeof value==="string"?JSON.parse(value):value;if(!g?.coordinates)return[];const polygons=g.type==="MultiPolygon"?g.coordinates:g.type==="Polygon"?[g.coordinates]:[];return polygons.flatMap((p:any[])=>p.filter((r:any)=>Array.isArray(r)&&r.length>=4).map((r:any)=>r.map((xy:any)=>[Number(xy[1]),Number(xy[0])] as [number,number])));}catch{return[];}}
function MapCanvas({fields,recommendations}:{fields:Field[];recommendations:Recommendation[]}){
 const host=useRef<HTMLDivElement>(null),mapRef=useRef<any>(null),layerRef=useRef<any>(null);
 const[ready,setReady]=useState(false),[error,setError]=useState("");
 useEffect(()=>{let dead=false;let timeout:number|undefined;const init=()=>{if(dead||!host.current||!window.L)return;try{const L=window.L;const map=L.map(host.current,{zoomControl:false,scrollWheelZoom:false,preferCanvas:true});mapRef.current=map;layerRef.current=L.featureGroup().addTo(map);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);setReady(true);}catch(e){setError(e instanceof Error?e.message:"نقشه بارگذاری نشد.");}};
 if(window.L)init();else{let script=document.querySelector<HTMLScriptElement>('script[data-sarina-leaflet="true"]');if(!script){script=document.createElement("script");script.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";script.async=true;script.dataset.sarinaLeaflet="true";document.head.appendChild(script);}script.addEventListener("load",init);script.addEventListener("error",()=>setError("بارگذاری نقشه انجام نشد."));timeout=window.setTimeout(()=>{if(!window.L&&!dead)setError("نقشه در دسترس نیست؛ اتصال اینترنت را بررسی کنید.");},12000);}
 return()=>{dead=true;if(timeout)window.clearTimeout(timeout);if(mapRef.current){mapRef.current.remove();mapRef.current=null;layerRef.current=null;}};
 },[]);
 useEffect(()=>{if(!ready||!mapRef.current||!layerRef.current)return;const L=window.L,group=layerRef.current;group.clearLayers();const bounds:any[]=[];const fieldCentres=new Map<string,[number,number]>();
 for(const field of fields){const rings=boundaryRings(field.boundary);for(const ring of rings){L.polygon(ring,{color:"#28764f",weight:3,fillColor:"#78b486",fillOpacity:.25}).addTo(group).bindTooltip(field.field_name||"قطعه مزرعه");bounds.push(...ring);if(!fieldCentres.has(field.id)){fieldCentres.set(field.id,[ring.reduce((s,p)=>s+p[0],0)/ring.length,ring.reduce((s,p)=>s+p[1],0)/ring.length]);}}}
 for(const rec of recommendations){const point=rec.field_id?fieldCentres.get(rec.field_id):undefined;if(!point)continue;const marker=L.circleMarker(point,{radius:10,color:"#fff",weight:3,fillColor:rec.priority==="urgent"||rec.priority==="high"?"#d28b37":"#347c54",fillOpacity:1}).addTo(group);marker.bindPopup("<strong>"+String(rec.title).replace(/[<>]/g,"")+"</strong>");}
 if(bounds.length)mapRef.current.fitBounds(bounds,{padding:[24,24],maxZoom:17});else mapRef.current.setView([25,0],2);
 },[ready,fields,recommendations]);
 return <div className="myfarm-map-wrap"><div ref={host} className="myfarm-map" aria-label="نقشه مرزهای تأییدشده مزرعه"/>{!ready&&!error&&<div className="myfarm-map-state">در حال آماده‌سازی نقشه اختصاصی…</div>}{error&&<div className="myfarm-map-state">{error}</div>}{ready&&fields.every(f=>!boundaryRings(f.boundary).length)&&<div className="myfarm-map-empty"><MapPin size={25}/><b>مرز تأییدشده‌ای برای نمایش نداریم</b><span>محدوده مزرعه را از بخش ثبت مزرعه روی نقشه مشخص کن.</span></div>}</div>;
}
export default function FarmerMapFirstHome({session,onOpenFarms}:{session:Session;onOpenFarms:()=>void}){
 const[farms,setFarms]=useState<Farm[]>([]),[fields,setFields]=useState<Field[]>([]),[recommendations,setRecommendations]=useState<Recommendation[]>([]),[actions,setActions]=useState<PersonalAction[]>([]),[plans,setPlans]=useState<Plan[]>([]),[baseline,setBaseline]=useState<Baseline|null>(null),[measurements,setMeasurements]=useState<Measurement[]>([]);
 const[loading,setLoading]=useState(true),[error,setError]=useState(""),[selected,setSelected]=useState(0);
 useEffect(()=>{let active=true;async function load(){if(!db){setLoading(false);return;}setLoading(true);setError("");try{
  const fr=await db.from("farms").select("id,farm_name,total_area,area_unit").order("created_at",{ascending:false}).limit(50);if(fr.error)throw fr.error;const rows=(fr.data??[]) as Farm[];if(!active)return;setFarms(rows);
  if(!rows.length){setFields([]);setRecommendations([]);setActions([]);setPlans([]);setBaseline(null);setMeasurements([]);return;}
  const ids=rows.map(x=>x.id);
  const [fieldResult,recResult,planResult]=await Promise.all([
   db.from("farm_fields").select("id,farm_id,field_name,area,area_unit,boundary").in("farm_id",ids).limit(500),
   db.from("expert_recommendation_actions").select("id,request_id,farm_id,title,instructions,priority,starts_on,due_on,status,expert_profile_id,farmer_note").in("farm_id",ids).in("status",["approved","in_progress","completed","needs_review"]).limit(200),
   db.from("farm_improvement_plans").select("id,farm_id,title,status,origin").in("farm_id",ids).eq("origin","farmer").eq("status","active").limit(100)
  ]);
  if(fieldResult.error)throw fieldResult.error;if(recResult.error)throw recResult.error;if(planResult.error)throw planResult.error;
  const recs=(recResult.data??[]) as Recommendation[],reqIds=[...new Set(recs.map(x=>x.request_id))];
  let fieldByRequest:Record<string,string|null>={};if(reqIds.length){const req=await db.from("expert_requests").select("id,field_id").in("id",reqIds);if(!req.error)for(const row of req.data??[])fieldByRequest[row.id]=row.field_id??null;}
  const mapped=recs.map(x=>({...x,field_id:fieldByRequest[x.request_id]??null}));
  const ps=(planResult.data??[]) as Plan[];let actionRows:PersonalAction[]=[];
  if(ps.length){const ar=await db.from("farm_improvement_actions").select("id,plan_id,title,status,due_date").in("plan_id",ps.map(x=>x.id)).order("due_date");if(ar.error)throw ar.error;actionRows=(ar.data??[]) as PersonalAction[];}
  if(!active)return;setFields((fieldResult.data??[]) as Field[]);setRecommendations(mapped);setPlans(ps);setActions(actionRows);
  const farmId=rows[Math.min(selected,rows.length-1)]?.id??rows[0].id;
  const [base,meas]=await Promise.all([
   db.from("farm_productivity_baselines").select("baseline_date,metrics_snapshot").eq("farm_id",farmId).eq("status","confirmed").order("baseline_date",{ascending:false}).limit(1).maybeSingle(),
   db.from("farm_productivity_measurements").select("metric_code,metric_value,unit_code,observed_at").eq("farm_id",farmId).eq("metric_code","marketable_yield").order("observed_at",{ascending:false}).limit(10)
  ]);
  if(!active)return;if(!base.error)setBaseline(base.data as Baseline|null);if(!meas.error)setMeasurements((meas.data??[]) as Measurement[]);
 }catch(e){if(active)setError(e instanceof Error?e.message:"دریافت اطلاعات مزرعه انجام نشد.");}finally{if(active)setLoading(false);}}
 void load();return()=>{active=false;};
 },[session.user.id]);
 const farm=farms[selected]??null,farmFields=useMemo(()=>fields.filter(x=>x.farm_id===farm?.id),[fields,farm?.id]),farmRecommendations=useMemo(()=>recommendations.filter(x=>x.farm_id===farm?.id),[recommendations,farm?.id]),farmPlans=useMemo(()=>plans.filter(x=>x.farm_id===farm?.id),[plans,farm?.id]),farmActions=useMemo(()=>actions.filter(a=>farmPlans.some(p=>p.id===a.plan_id)),[actions,farmPlans]);
 const baselineYield=baseline?.metrics_snapshot?.marketable_yield,currentYield=measurements.find(x=>x.observed_at&&(!baseline?.baseline_date||x.observed_at.slice(0,10)>=baseline.baseline_date));
 const comparable=baselineYield&&typeof baselineYield.value==="number"&&baselineYield.value>0&&currentYield&&baselineYield.unit===currentYield.unit_code;
 const change=comparable?Math.round((currentYield.metric_value-baselineYield.value)/baselineYield.value*100):null;
 const first=session.user.user_metadata?.full_name?.split(" ")[0]||"کشاورز عزیز";
 const shift=(delta:number)=>setSelected(v=>Math.min(Math.max(v+delta,0),Math.max(0,farms.length-1)));
 return <section className="farmer-map-first-home" dir="rtl">
  <div className="welcome-row"><div><span className="eyebrow">امروز، فرصتی تازه برای رشد</span><h1>سلام {first}، خوش آمدی 🌱</h1><p>بیایید وضعیت مزرعه و مسیر پیشرفتتان را با هم دنبال کنیم.</p></div></div>
  <div className="myfarm-heading"><div><span className="eyebrow">فضای اصلی مدیریت مزرعه</span><h2>مزرعه من</h2></div>{farm&&<span className="myfarm-count">مزرعه {n(selected+1)} از {n(farms.length)}</span>}</div>
  {loading?<div className="empty-state">در حال دریافت مزارع شما…</div>:error?<div className="notice warning" role="alert">{error}</div>:!farm?<div className="myfarm-empty"><Sprout size={34}/><h3>هنوز مزرعه‌ای ثبت نکرده‌ای</h3><p>اولین مزرعه‌ات را روی نقشه مشخص کن تا فضای اختصاصی آن ساخته شود.</p><button type="button" onClick={onOpenFarms}><Plus size={16}/> ثبت مزرعه روی نقشه</button></div>:<article className="myfarm-card">
  <div className="myfarm-card-top"><div><b>{farm.farm_name}</b><span>{farm.total_area===null?"مساحت ثبت نشده":n(Number(farm.total_area))+" "+(farm.area_unit==="hectare"?"هکتار":farm.area_unit)}</span></div><button type="button" onClick={onOpenFarms}>ویرایش اطلاعات مزرعه</button></div>
  <MapCanvas fields={farmFields} recommendations={farmRecommendations}/>
  <div className="myfarm-productivity"><div><span>تغییر عملکرد نسبت به خط پایه</span><b>{change===null?"—":(change>0?"+":"")+n(change)+"٪"}</b></div><p>{change===null?"برای ارزیابی معتبر، هنوز داده عملکرد قابل مقایسه ثبت نشده است.":("عملکرد ثبت‌شده نسبت به خط پایه "+(change>0?"افزایش":change<0?"کاهش":"تغییر")+" داشته است؛ این مقایسه به‌تنهایی علت تغییر را مشخص نمی‌کند.")}</p></div>
  <div className="myfarm-plan"><div className="myfarm-plan-head"><div><CalendarDays size={18}/><b>برنامه هفتگی مزرعه</b></div><span>{n(farmRecommendations.length+farmActions.length)} مورد</span></div>
   {farmRecommendations.length?farmRecommendations.slice(0,4).map(r=><div className="myfarm-action" key={r.id}><span className={r.status==="completed"?"done":"pending"}/><div><b>{r.title}</b><small>{r.due_on?new Date(r.due_on+"T00:00:00").toLocaleDateString("fa-IR"):"بدون مهلت مشخص"} · توصیه متخصص</small></div><span>{r.status==="completed"?"تکمیل‌شده":r.status==="needs_review"?"نیازمند بازبینی":"در انتظار اجرا"}</span></div>):null}
   {farmActions.slice(0,4).map(a=><div className="myfarm-action" key={a.id}><span className={a.status==="completed"?"done":"pending"}/><div><b>{a.title}</b><small>{a.due_date?new Date(a.due_date+"T00:00:00").toLocaleDateString("fa-IR"):"بدون زمان‌بندی"}</small></div><span>{a.status==="completed"?"انجام‌شده":a.status==="in_progress"?"در حال انجام":"برنامه‌ریزی‌شده"}</span></div>)}
   {!farmRecommendations.length&&!farmActions.length&&<p className="myfarm-no-actions">هنوز توصیه تأییدشده یا اقدام زمان‌بندی‌شده‌ای برای نمایش ثبت نشده است.</p>}
  </div>
  <div className="myfarm-switch"><button type="button" onClick={()=>shift(-1)} disabled={selected===0} aria-label="مزرعه قبلی"><ChevronRight/></button><div>{farms.map((f,i)=><button type="button" key={f.id} className={i===selected?"active":""} onClick={()=>setSelected(i)} aria-label={"نمایش "+f.farm_name}/>)}</div><button type="button" onClick={()=>shift(1)} disabled={selected>=farms.length-1} aria-label="مزرعه بعدی"><ChevronLeft/></button></div>
  </article>}
 </section>;
}
