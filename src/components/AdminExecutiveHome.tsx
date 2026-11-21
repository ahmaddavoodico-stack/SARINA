import {useCallback,useEffect,useState} from "react";
import type {Session} from "@supabase/supabase-js";
import {Activity,ArrowLeft,Building2,ClipboardList,Clock3,RefreshCw,ShieldCheck,Sprout,Users,BriefcaseBusiness,CheckCircle2} from "lucide-react";
import {supabase} from "../lib/supabase";
import SarinaCharacter from "./SarinaCharacter";

type AdminPage="admin-users"|"admin-organizations"|"admin-applications"|"admin-services"|"admin-requests"|"admin-farms"|"admin-expert-verification"|"admin-productivity"|"admin-specialist-economy"|"admin-role-management";
type Props={session:Session;go:(page:AdminPage)=>void};
type ActivityItem={id:string;kind:"request"|"application"|"expert";title:string;status:string;date:string;priority?:string};
type Snapshot={users:number|null;farms:number|null;organizations:number|null;applications:number|null;services:number|null;farmerRequests:number|null;expertProfiles:number|null;pendingApplications:number|null;pendingExperts:number|null};
const empty:Snapshot={users:null,farms:null,organizations:null,applications:null,services:null,farmerRequests:null,expertProfiles:null,pendingApplications:null,pendingExperts:null};
const number=(value:number)=>value.toLocaleString("fa-IR");
const date=(value:string)=>value?new Date(value).toLocaleString("fa-IR",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}):"—";
const statusLabel=(value:string)=>({submitted:"ثبت‌شده",pending:"در انتظار بررسی",in_progress:"در حال پیگیری",completed:"تکمیل‌شده",approved:"تأییدشده",rejected:"ردشده",accepted:"پذیرفته‌شده",urgent:"فوری",high:"اولویت بالا"} as Record<string,string>)[value]||value||"—";

export default function AdminExecutiveHome({session,go}:Props){
 const[data,setData]=useState<Snapshot>(empty);
 const[activity,setActivity]=useState<ActivityItem[]>([]);
 const[loading,setLoading]=useState(true);
 const[error,setError]=useState("");
 const[activityUnavailable,setActivityUnavailable]=useState(false);
 const[updatedAt,setUpdatedAt]=useState<string|null>(null);
 const load=useCallback(async()=>{
  if(!supabase){setError("اتصال پایگاه داده در این محیط پیکربندی نشده است.");setLoading(false);return;}
  setLoading(true);setError("");setActivityUnavailable(false);
  const db=supabase as any;
  const queries=[
   db.from("users").select("id",{count:"exact",head:true}),
   db.from("farms").select("id",{count:"exact",head:true}),
   db.from("organizations").select("id",{count:"exact",head:true}),
   db.from("organization_applications").select("id",{count:"exact",head:true}),
   db.from("organization_services").select("id",{count:"exact",head:true}),
   db.from("institutional_service_requests").select("id",{count:"exact",head:true}),
   db.from("expert_profiles").select("id",{count:"exact",head:true}),
   db.from("organization_applications").select("id",{count:"exact",head:true}).eq("status","pending"),
   db.from("expert_profiles").select("id",{count:"exact",head:true}).eq("verification_status","pending"),
   db.from("institutional_service_requests").select("id,request_title,status,submitted_at").order("submitted_at",{ascending:false}).limit(4),
   db.from("organization_applications").select("id,display_name,legal_name,status,submitted_at").order("submitted_at",{ascending:false}).limit(4),
   db.from("expert_profiles").select("id,public_name,verification_status,created_at").order("created_at",{ascending:false}).limit(4)
  ];
  const results=await Promise.all(queries);
  const keys:(keyof Snapshot)[]=["users","farms","organizations","applications","services","farmerRequests","expertProfiles","pendingApplications","pendingExperts"];
  const next={...empty};
  results.slice(0,9).forEach((result,index)=>{next[keys[index]]=result.error?null:(result.count??0);});
  const metricLabels=["کاربران","مزارع","سازمان‌ها","درخواست‌های عضویت","خدمات سازمانی","درخواست‌های کشاورزان","متخصصان","عضویت‌های در انتظار بررسی","متخصصان در انتظار تأیید"];
  const errors=results.slice(0,9).map((result,index)=>result.error?metricLabels[index]:null).filter(Boolean);
  setData(next);
  const items:ActivityItem[]=[
   ...(results[9].data??[]).map((item:any)=>({id:"request-"+item.id,kind:"request" as const,title:item.request_title||"درخواست خدمات کشاورزی",status:item.status,date:item.submitted_at})),
   ...(results[10].data??[]).map((item:any)=>({id:"application-"+item.id,kind:"application" as const,title:item.display_name||item.legal_name||"درخواست عضویت سازمان",status:item.status,date:item.submitted_at})),
   ...(results[11].data??[]).map((item:any)=>({id:"expert-"+item.id,kind:"expert" as const,title:item.public_name||"پروفایل متخصص",status:item.verification_status,date:item.created_at}))
  ].sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).slice(0,7);
  setActivity(items);
  const activityErrors=results.slice(9).filter(result=>result.error);
  setActivityUnavailable(activityErrors.length>0);
  if(errors.length||activityErrors.length){const labels=[...errors,...(activityErrors.length?["جریان فعالیت‌های اخیر"]:[])];setError("اطلاعات این بخش‌ها در دسترس نیست: "+labels.join("، ")+". خطای دریافت را بررسی کنید؛ مقدار «—» به معنی صفر نیست.");}
  setUpdatedAt(new Date().toISOString());setLoading(false);
 },[]);
 useEffect(()=>{void load();},[load]);
 const stats=[
  {label:"کاربران ثبت‌شده",value:data.users,icon:Users,target:"admin-users" as AdminPage,detail:"حساب‌های پلتفرم"},
  {label:"مزارع ثبت‌شده",value:data.farms,icon:Sprout,target:"admin-farms" as AdminPage,detail:"دارایی‌های کشاورزی"},
  {label:"سازمان‌ها",value:data.organizations,icon:Building2,target:"admin-organizations" as AdminPage,detail:"شبکه نهادی و خصوصی"},
  {label:"درخواست‌های عضویت",value:data.applications,icon:ClipboardList,target:"admin-applications" as AdminPage,detail:"درخواست‌های ثبت‌شده سازمان‌ها"},
  {label:"خدمات سازمانی",value:data.services,icon:ShieldCheck,target:"admin-services" as AdminPage,detail:"خدمات قابل ارائه"},
  {label:"درخواست‌های کشاورزان",value:data.farmerRequests,icon:ClipboardList,target:"admin-requests" as AdminPage,detail:"درخواست‌های ثبت‌شده"},
  {label:"متخصصان ثبت‌نام‌شده",value:data.expertProfiles,icon:BriefcaseBusiness,target:"admin-expert-verification" as AdminPage,detail:"شبکه متخصصان سارینا"}
 ];
 return <main className="executive-home" dir="rtl">
  <section className="executive-welcome">
   <div className="executive-welcome-copy">
    <span className="executive-kicker"><span/> SARINA EXECUTIVE HOME</span>
    <h1>اتاق فرمان سارینا</h1>
    <p>تصویر روشن‌تری از آنچه در سراسر سازمان می‌گذرد؛ از جامعه کشاورزان تا متخصصان و سازمان‌های همکار.</p>
    <div className="executive-welcome-meta"><span><ShieldCheck size={15}/> فضای امن مدیریت مرکزی</span><span>{session.user.email||"مدیر مرکزی"}</span><span><Clock3 size={15}/> {updatedAt?"آخرین به‌روزرسانی "+date(updatedAt):"در انتظار دریافت اطلاعات"}</span></div>
   </div>
   <div className="executive-sarina-card">
    <div className="executive-character"><SarinaCharacter large/></div>
    <div><span>دستیار دفتر مدیریت</span><strong>سلام، خوش آمدید.</strong><p>من کنار شما هستم تا نمای کلی سازمان و کارهای نیازمند توجه را یک‌جا ببینید.</p></div>
   </div>
  </section>
  {error&&<div className="executive-alert"><Activity size={17}/>{error}</div>}
  <div className="executive-section-heading"><div><span>نمای کلی سازمان</span><h2>نبض سارینا</h2></div><button className="executive-refresh" onClick={()=>void load()} disabled={loading}><RefreshCw size={15} className={loading?"executive-spin":""}/> به‌روزرسانی</button></div>
  <section className="executive-stat-grid">
   {stats.map(item=><button className="executive-stat" key={item.target} onClick={()=>go(item.target)}><span className="executive-stat-icon"><item.icon size={19}/></span><small>{item.label}</small><strong>{loading?"…":item.value===null?"—":number(item.value)}</strong><em>{item.detail}<ArrowLeft size={13}/></em></button>)}
  </section>
  <section className="executive-focus-grid">
   <article className="executive-focus-card">
    <div className="executive-card-title"><span className="executive-card-icon attention"><Activity size={18}/></span><div><h3>موارد نیازمند توجه</h3><p>چیزهایی که بهتر است در اولویت بررسی قرار بگیرند.</p></div></div>
    <button className="executive-focus-row" onClick={()=>go("admin-applications")}><span className="executive-focus-number">{loading?"…":data.pendingApplications===null?"—":number(data.pendingApplications)}</span><span><b>درخواست عضویت در انتظار بررسی</b><small>بررسی و تعیین تکلیف سازمان‌های متقاضی</small></span><ArrowLeft size={16}/></button>
    <button className="executive-focus-row" onClick={()=>go("admin-expert-verification")}><span className="executive-focus-number">{loading?"…":data.pendingExperts===null?"—":number(data.pendingExperts)}</span><span><b>پروفایل متخصص در انتظار بررسی</b><small>بررسی صلاحیت و تکمیل اطلاعات حرفه‌ای</small></span><ArrowLeft size={16}/></button>
    <div className="executive-focus-foot"><CheckCircle2 size={15}/> تصمیم‌های مدیریتی همچنان از مسیرهای دارای مجوز انجام می‌شوند.</div>
   </article>
   <article className="executive-shortcuts">
    <div className="executive-card-title"><span className="executive-card-icon"><ArrowLeft size={18}/></span><div><h3>دسترسی سریع</h3><p>مستقیم به بخش‌های کلیدی مدیریت بروید.</p></div></div>
    <div className="executive-shortcut-grid">
     <button onClick={()=>go("admin-users")}><Users size={17}/> مدیریت کاربران</button>
     <button onClick={()=>go("admin-organizations")}><Building2 size={17}/> سازمان‌ها و همکاران</button>
     <button onClick={()=>go("admin-productivity")}><Activity size={17}/> پایش بهره‌وری</button>
     <button onClick={()=>go("admin-specialist-economy")}><BriefcaseBusiness size={17}/> اقتصاد متخصصان</button>
     <button onClick={()=>go("admin-role-management")}><ShieldCheck size={17}/> نقش‌ها و دسترسی‌ها</button>
     <button onClick={()=>go("admin-applications")}><ClipboardList size={17}/> درخواست‌های عضویت</button>
    </div>
   </article>
  </section>
  <section className="executive-activity">
   <div className="executive-card-title"><span className="executive-card-icon"><Clock3 size={18}/></span><div><h3>جریان فعالیت‌های اخیر</h3><p>آخرین موارد ثبت‌شده در بخش‌های مختلف سازمان.</p></div></div>
   {loading?<div className="executive-empty">در حال دریافت فعالیت‌ها…</div>:activityUnavailable&&activity.length===0?<div className="executive-empty">دریافت فعالیت‌های اخیر با خطا روبه‌رو شد؛ این وضعیت به معنی نبود فعالیت نیست.</div>:activity.length===0?<div className="executive-empty">هنوز فعالیتی برای نمایش در این نمای مدیریتی پیدا نشد.</div>:<div className="executive-activity-list">{activity.map(item=><article key={item.id}><span className="executive-activity-dot"/><div><b>{item.title}</b><small>{item.kind==="request"?"درخواست کشاورز":item.kind==="application"?"درخواست سازمان":"پرونده متخصص"} · {date(item.date)}</small></div><span className="executive-status">{item.priority?statusLabel(item.priority):statusLabel(item.status)}</span></article>)}</div>}
  </section>
  <p className="executive-footnote">نمای مدیریتی SARINA · اعداد بر پایه شمارش رکوردهای قابل دسترس برای مدیر مرکزی هستند؛ «—» یعنی داده دریافت نشده و نباید آن را صفر واقعی تلقی کرد.</p>
 </main>;
}
