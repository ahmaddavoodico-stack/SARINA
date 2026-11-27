import {useEffect,useMemo,useRef,useState} from "react";
import type {Session} from "@supabase/supabase-js";
import {Activity,CalendarDays,ChevronLeft,ChevronRight,MessageCircle,Mic,Plus,Send,Sprout,Volume2} from "lucide-react";
import {supabase} from "../lib/supabase";

type Farm={id:string;farm_name:string;total_area:number|null;area_unit:string;status:string};
type Field={id:string;farm_id:string;field_name:string;area:number|null;area_unit:string;boundary:any};
type Action={id:string;title:string;status:string;due_date:string|null;plan_id:string};
type Plan={id:string;farm_id:string;title:string;status:string;priority:string;farm_improvement_actions?:Action[]};
declare global{interface Window{L?:any}}
const db=supabase as any;
const faNumber=(n:number)=>n.toLocaleString("fa-IR",{maximumFractionDigits:2});
function pointsFromBoundary(value:any):[number,number][][]{
 try{const geometry=typeof value==="string"?JSON.parse(value):value;if(!geometry||!Array.isArray(geometry.coordinates))return [];
  const rings=geometry.type==="MultiPolygon"?geometry.coordinates.flatMap((p:any[])=>p):geometry.type==="Polygon"?geometry.coordinates:[];
  return rings.filter((ring:any)=>Array.isArray(ring)&&ring.length>=4).map((ring:any)=>ring.map((p:any)=>[Number(p[1]),Number(p[0])] as [number,number]));
 }catch{return [];}
}
function FarmMapView({fields}:{fields:Field[]}){
 const host=useRef<HTMLDivElement>(null),mapRef=useRef<any>(null),layersRef=useRef<any>(null);
 const[ready,setReady]=useState(false),[error,setError]=useState("");
 useEffect(()=>{let cancelled=false;let timer:number|undefined;
  const setup=()=>{if(cancelled||!host.current||!window.L)return;try{const L=window.L;const map=L.map(host.current,{zoomControl:false,scrollWheelZoom:false,preferCanvas:true});mapRef.current=map;layersRef.current=L.featureGroup().addTo(map);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);setReady(true);}catch(e){setError(e instanceof Error?e.message:"نقشه بارگذاری نشد.");}};
  if(window.L)setup();else{let script=document.querySelector<HTMLScriptElement>('script[data-sarina-leaflet="true"]');if(!script){script=document.createElement("script");script.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";script.async=true;script.dataset.sarinaLeaflet="true";document.head.appendChild(script);}script.addEventListener("load",setup);script.addEventListener("error",()=>setError("بارگذاری نقشه انجام نشد."));timer=window.setTimeout(()=>{if(!window.L&&!cancelled)setError("نقشه در دسترس نیست؛ اتصال اینترنت را بررسی کنید.");},12000);}
  return()=>{cancelled=true;if(timer)window.clearTimeout(timer);if(mapRef.current){mapRef.current.remove();mapRef.current=null;layersRef.current=null;}};
 },[]);
 useEffect(()=>{if(!ready||!mapRef.current||!layersRef.current)return;const L=window.L,group=layersRef.current;group.clearLayers();const bounds:any[]=[];
  for(const field of fields){const rings=pointsFromBoundary(field.boundary);for(const ring of rings){const polygon=L.polygon(ring,{color:"#24724e",weight:3,fillColor:"#75ad7b",fillOpacity:.28}).addTo(group);polygon.bindTooltip(field.field_name||"قطعه مزرعه");bounds.push(...ring);}}
  if(bounds.length)mapRef.current.fitBounds(bounds,{padding:[22,22],maxZoom:17});else mapRef.current.setView([25,0],2);
 },[ready,fields]);
 return <div className="myfarm-map-wrap"><div ref={host} className="myfarm-map" aria-label="نقشه محدوده تأییدشده مزرعه"/>{!ready&&!error&&<div className="myfarm-map-state">در حال آماده‌سازی نقشه مزرعه…</div>}{error&&<div className="myfarm-map-state">{error}</div>}{ready&&fields.every(f=>!pointsFromBoundary(f.boundary).length)&&<div className="myfarm-map-empty"><Sprout size={24}/><b>مرز تأییدشده‌ای برای نمایش نداریم</b><span>می‌توانی محدوده مزرعه را از بخش ثبت مزرعه روی نقشه مشخص کنی.</span></div>}</div>;
}
function ConversationPreview({onClose}:{onClose:()=>void}){
 return <div className="sarina-chat-overlay" role="dialog" aria-modal="true" aria-label="گفتگو با سارینا"><section className="sarina-chat-panel" dir="rtl"><header><div className="sarina-chat-avatar"><Sprout/></div><div><b>SARINA</b><small>همراه هوشمند کشاورز</small></div><button type="button" onClick={onClose} aria-label="بستن گفتگو">×</button></header><div className="sarina-chat-welcome"><span>سلام دوست خوبم 🌱</span><p>من سارینا هستم؛ دستیار هوشمند کشاورزی تو. می‌توانیم درباره مزرعه‌ات صحبت کنیم.</p><small>این محیط در حال اتصال به سرویس امن مکالمه و حافظه SARINA است.</small></div><div className="sarina-chat-disabled-note">ارسال پیام تا زمان تکمیل اتصال امن سرویس مکالمه فعال نشده است. گفتگوی متخصصان همچنان از بخش مستقل خودش در دسترس است.</div><div className="sarina-chat-composer"><button disabled aria-label="افزودن پیوست"><Plus/></button><input disabled placeholder="به‌زودی می‌توانی اینجا با سارینا گفتگو کنی…"/><button disabled aria-label="ضبط صدا"><Mic/></button><button disabled aria-label="ارسال پیام"><Send/></button></div></section></div>;
}
export default function FarmerHomeExperience({session,onOpenFarms,onOpenChat}:{session:Session;onOpenFarms:()=>void;onOpenChat:()=>void}){
 const[farms,setFarms]=useState<Farm[]>([]),[fields,setFields]=useState<Field[]>([]),[plans,setPlans]=useState<Plan[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[selected,setSelected]=useState(0),[showChat,setShowChat]=useState(false);
 useEffect(()=>{let active=true;async function load(){if(!db){setLoading(false);return;}setLoading(true);setError("");try{
  const f=await db.from("farms").select("id,farm_name,total_area,area_unit,status").order("created_at",{ascending:false}).limit(30);if(f.error)throw f.error;
  const rows=(f.data??[]) as Farm[];if(!active)return;setFarms(rows);const ids=rows.map(x=>x.id);
  if(!ids.length){setFields([]);setPlans([]);return;}
  const [fieldResult,planResult]=await Promise.all([
   db.from("farm_fields").select("id,farm_id,field_name,area,area_unit,boundary").in("farm_id",ids).limit(500),
   db.from("farm_improvement_plans").select("id,farm_id,title,status,priority,farm_improvement_actions(id,title,status,due_date,plan_id)").in("farm_id",ids).eq("status","active").limit(100)
  ]);
  if(fieldResult.error)throw fieldResult.error;if(planResult.error)throw planResult.error;
  if(active){setFields((fieldResult.data??[]) as Field[]);setPlans((planResult.data??[]) as Plan[]);}
 }catch(e){if(active)setError(e instanceof Error?e.message:"دریافت اطلاعات مزرعه انجام نشد.");}finally{if(active)setLoading(false);}}
 void load();return()=>{active=false;};
 },[session.user.id]);
 const farm=farms[selected]??null, farmFields=useMemo(()=>fields.filter(x=>x.farm_id===farm?.id),[fields,farm?.id]),farmPlans=useMemo(()=>plans.filter(x=>x.farm_id===farm?.id),[plans,farm?.id]),actions=useMemo(()=>farmPlans.flatMap(p=>p.farm_improvement_actions??[]),[farmPlans]);
 const first=session.user.user_metadata?.full_name?.split(" ")[0]||"کشاورز عزیز";
 const shift=(delta:number)=>setSelected(v=>Math.min(Math.max(v+delta,0),Math.max(0,farms.length-1)));
 return <section className="farmer-home-experience" dir="rtl">
  <div className="welcome-row"><div><span className="eyebrow">همراه هوشمند کشاورز</span><h1>سلام {first}، خوش آمدی 🌱</h1><p>امروز هم سارینا در کنار تو و مزرعه‌ات است.</p></div><div className="myfarm-welcome-actions"><button type="button" onClick={()=>setShowChat(true)}><MessageCircle size={17}/> گفتگو با سارینا</button></div></div>
  <div className="myfarm-heading"><div><span className="eyebrow">فضای اصلی مدیریت مزرعه</span><h2>مزرعه من</h2></div>{farms.length>0&&<span className="myfarm-count">مزرعه {faNumber(selected+1)} از {faNumber(farms.length)}</span>}</div>
  {loading?<div className="empty-state">در حال دریافت مزارع شما…</div>:error?<div className="notice warning" role="alert">{error}</div>:farms.length===0?<div className="myfarm-empty"><Sprout size={34}/><h3>هنوز مزرعه‌ای ثبت نکرده‌ای</h3><p>اولین مزرعه‌ات را روی نقشه مشخص کن تا فضای اختصاصی آن ساخته شود.</p><button type="button" onClick={onOpenFarms}>ثبت مزرعه روی نقشه <ChevronLeft size={17}/></button></div>:farm&&<article className="myfarm-card">
   <div className="myfarm-card-top"><div><b>{farm.farm_name}</b><span>{farm.total_area===null?"مساحت ثبت نشده":faNumber(Number(farm.total_area))+" "+(farm.area_unit==="hectare"?"هکتار":farm.area_unit)}</span></div><button type="button" onClick={onOpenFarms}>مدیریت اطلاعات مزرعه</button></div>
   <FarmMapView fields={farmFields}/>
   <div className="myfarm-productivity"><div><span>بهره‌وری مزرعه</span><b>—</b></div><p>برای ارزیابی معتبر، هنوز داده‌های کافی و قابل مقایسه ثبت نشده است.</p></div>
   <div className="myfarm-plan"><div className="myfarm-plan-head"><div><CalendarDays size={18}/><b>برنامه و اقدامات مزرعه</b></div><span>{faNumber(actions.length)} اقدام ثبت‌شده</span></div>
    {actions.length?actions.slice(0,4).map(a=><div className="myfarm-action" key={a.id}><span className={a.status==="completed"?"done":"pending"}/><div><b>{a.title}</b><small>{a.due_date?new Date(a.due_date+"T00:00:00").toLocaleDateString("fa-IR"):"زمان‌بندی ثبت نشده"}</small></div><span>{a.status==="completed"?"انجام‌شده":a.status==="in_progress"?"در حال انجام":"برنامه‌ریزی‌شده"}</span></div>):<p className="myfarm-no-actions">هنوز اقدام هفتگی تأییدشده‌ای برای نمایش ثبت نشده است. توصیه‌های معتبر پس از اتصال جریان تخصصی در همین بخش قرار می‌گیرند.</p>}
   </div>
   <div className="myfarm-switch"><button type="button" onClick={()=>shift(-1)} disabled={selected===0} aria-label="مزرعه قبلی"><ChevronRight/></button><div>{farms.map((f,i)=><button type="button" key={f.id} className={i===selected?"active":""} onClick={()=>setSelected(i)} aria-label={"نمایش "+f.farm_name}/>)}</div><button type="button" onClick={()=>shift(1)} disabled={selected>=farms.length-1} aria-label="مزرعه بعدی"><ChevronLeft/></button></div>
  </article>}
  <div className="myfarm-bottom-actions"><button type="button" onClick={onOpenFarms}><Sprout size={17}/> مزارع و قطعات من</button><button type="button" onClick={onOpenChat}><MessageCircle size={17}/> گفت‌وگو با متخصصان</button></div>
  {showChat&&<ConversationPreview onClose={()=>setShowChat(false)}/>}
 </section>;
}
