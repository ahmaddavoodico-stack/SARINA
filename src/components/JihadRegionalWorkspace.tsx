import {useMemo,useState} from "react";
import {Activity,AlertCircle,ArrowDownLeft,ArrowUpLeft,ArrowUpRight,ChevronLeft,Clock3,FileText,Filter,Layers3,MapPin,Search,ShieldCheck,Users} from "lucide-react";

type ScopeId="national"|"province"|"county"|"service"|"expert";
type RequestItem={id:string;title:string;scope:string;status:string;priority:"فوری"|"بالا"|"عادی";age:string;owner:string};
const scopes:{id:ScopeId;label:string;name:string;detail:string}[]=[
 {id:"national",label:"سطح ملی",name:"ستاد ملی",detail:"نمای کلی تجمیعی و سیاست‌گذاری"},
 {id:"province",label:"استان",name:"استان نمونه",detail:"مدیریت و پایش استانی"},
 {id:"county",label:"شهرستان",name:"شهرستان نمونه",detail:"جمع‌بندی و پیگیری شهرستانی"},
 {id:"service",label:"مرکز خدمات",name:"مرکز خدمات نمونه",detail:"رسیدگی میدانی و ارتباط با کشاورز"},
 {id:"expert",label:"کارشناس",name:"کارشناس سازمانی",detail:"اقدام کارشناسی در محدوده مأموریت"},
];
const demoRequests:RequestItem[]=[
 {id:"SR-1405-0128",title:"بررسی افت عملکرد مزرعه",scope:"مرکز خدمات نمونه",status:"در حال بررسی محلی",priority:"فوری",age:"۲ ساعت",owner:"کارشناس نمونه"},
 {id:"SR-1405-0124",title:"درخواست بررسی کیفیت آب آبیاری",scope:"شهرستان نمونه",status:"منتظر اطلاعات تکمیلی",priority:"بالا",age:"۱ روز",owner:"مدیریت شهرستان"},
 {id:"SR-1405-0119",title:"گزارش تنش گرمایی در مزارع",scope:"استان نمونه",status:"آماده جمع‌بندی",priority:"عادی",age:"۳ روز",owner:"کارگروه استانی"},
 {id:"SR-1405-0112",title:"نیاز به هماهنگی پشتیبانی فنی",scope:"مرکز خدمات نمونه",status:"ارجاع‌شده برای تصمیم",priority:"بالا",age:"۴ روز",owner:"کارشناس نمونه"},
];
export default function JihadRegionalWorkspace(){
 const [scope,setScope]=useState<ScopeId>("province");
 const [tab,setTab]=useState<"overview"|"requests"|"referrals">("overview");
 const [query,setQuery]=useState("");
 const [selected,setSelected]=useState<RequestItem|null>(null);
 const [notice,setNotice]=useState("");
 const active=scopes.find(s=>s.id===scope)!;
 const rows=useMemo(()=>demoRequests.filter(r=>(r.title+" "+r.id+" "+r.scope+" "+r.owner).toLowerCase().includes(query.toLowerCase())),[query]);
 return <section className="jihad-workspace" dir="rtl">
  <div className="jihad-demo-banner"><AlertCircle size={17}/><span>پیش‌نمونهٔ طراحی — همهٔ اعداد و پرونده‌های این صفحه دادهٔ نمایشی هستند و از پایگاه داده خوانده نمی‌شوند.</span></div>
  <header className="jihad-heading">
   <div><span className="jihad-eyebrow">SARINA INSTITUTIONAL OPERATIONS</span><h1>پایش منطقه‌ای جهاد کشاورزی</h1><p>نمایش زنجیرهٔ رسیدگی، جمع‌بندی و ارجاع سازمانی در سطوح مختلف</p></div>
   <div className="jihad-scope-chip"><ShieldCheck size={17}/><span>نمونهٔ دسترسی: سطح استانی</span></div>
  </header>
  <div className="jihad-breadcrumb"><span>ملی</span><ChevronLeft size={14}/><span>{scopes[1].name}</span><ChevronLeft size={14}/><strong>{active.name}</strong></div>
  <div className="jihad-layout">
   <aside className="jihad-region-panel">
    <div className="jihad-panel-title"><Layers3 size={18}/><strong>ساختار منطقه‌ای</strong></div>
    <p>انتخاب سطح برای مشاهدهٔ نمونهٔ نمایشی</p>
    <div className="jihad-scope-list">{scopes.map((s,i)=><button key={s.id} className={scope===s.id?"jihad-scope active":"jihad-scope"} onClick={()=>{setScope(s.id);setNotice("");}}><span className="jihad-scope-level">{i+1}</span><span><b>{s.label}</b><small>{s.name}</small></span>{scope===s.id&&<ChevronLeft size={16}/>}</button>)}</div>
    <div className="jihad-privacy-note"><ShieldCheck size={17}/><span>دسترسی واقعی باید بر اساس نقش، عضویت، قابلیت و قلمرو مأموریت در سرور کنترل شود؛ انتخاب این فهرست به‌تنهایی مجوز دسترسی نیست.</span></div>
   </aside>
   <div className="jihad-main">
    <div className="jihad-scope-header"><div><span>{active.label}</span><h2>{active.name}</h2><small>{active.detail}</small></div><span className="jihad-demo-tag">دادهٔ نمونه</span></div>
    <div className="jihad-metrics">
     <article><span className="jihad-metric-icon green"><FileText size={18}/></span><small>پرونده‌های ثبت‌شده</small><strong>{scope==="national"?"۱٬۲۸۴":"۱۲۸"}</strong><em>در بازهٔ نمایشی</em></article>
     <article><span className="jihad-metric-icon amber"><Clock3 size={18}/></span><small>در انتظار اقدام</small><strong>{scope==="national"?"۹۶":"۱۸"}</strong><em>نیازمند پیگیری</em></article>
     <article><span className="jihad-metric-icon blue"><Users size={18}/></span><small>کارشناسان فعال</small><strong>{scope==="national"?"۲۴۶":"۲۴"}</strong><em>در قلمرو نمونه</em></article>
     <article><span className="jihad-metric-icon violet"><Activity size={18}/></span><small>اقدام تکمیل‌شده</small><strong>۷۸٪</strong><em>شاخص ساختگی برای پیش‌نمایش</em></article>
    </div>
    <div className="jihad-tabs"><button className={tab==="overview"?"active":""} onClick={()=>setTab("overview")}>نمای کلی</button><button className={tab==="requests"?"active":""} onClick={()=>setTab("requests")}>پرونده‌ها و درخواست‌ها</button><button className={tab==="referrals"?"active":""} onClick={()=>setTab("referrals")}>ارجاعات بین سطوح</button></div>
    {tab==="overview"&&<div className="jihad-overview-grid">
     <article className="jihad-card"><div className="jihad-card-head"><div><b>جریان رسیدگی سازمانی</b><small>مسیر نمونه از سطح محلی تا سطح ملی</small></div><ArrowUpLeft size={18}/></div>
      <div className="jihad-flow">{scopes.slice().reverse().map((s,i)=><div className="jihad-flow-step" key={s.id}><span>{5-i}</span><div><b>{s.label}</b><small>{s.name}</small></div>{i<4&&<ArrowUpLeft size={16}/>}</div>)}</div>
      <p className="jihad-flow-caption">ارجاع نتیجه به سطح بالاتر باید شامل خلاصهٔ تأییدشده، شواهد مجاز، مهلت و تاریخچهٔ قابل ممیزی باشد.</p>
     </article>
     <article className="jihad-card"><div className="jihad-card-head"><div><b>اصول ارجاع</b><small>دو مسیر مستقل با معنای روشن</small></div><ShieldCheck size={18}/></div>
      <div className="jihad-referral-kind"><span className="kind-icon info"><ArrowUpRight size={18}/></span><div><b>ارجاع برای اطلاع یا تصمیم</b><small>مسئولیت رسیدگی در سطح فعلی باقی می‌ماند.</small></div></div>
      <div className="jihad-referral-kind"><span className="kind-icon transfer"><ArrowDownLeft size={18}/></span><div><b>انتقال مسئولیت</b><small>فقط پس از پذیرش صریح واحد مقصد انجام می‌شود.</small></div></div>
      <div className="jihad-privacy-note"><ShieldCheck size={16}/><span>گزارش مدیریتی پیش‌فرض تجمیعی و بدون اطلاعات هویتی کشاورز است.</span></div>
     </article>
    </div>}
    {tab!=="overview"&&<div className="jihad-card jihad-list-card">
     <div className="jihad-list-head"><div><b>{tab==="requests"?"پرونده‌های نمونه":"ارجاعات نمونه"}</b><small>اطلاعات ساختگی برای ارزیابی چیدمان و گردش کار</small></div><span className="jihad-demo-tag">غیرعملیاتی</span></div>
     <label className="jihad-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="جست‌وجوی عنوان، شناسه یا واحد..."/><Filter size={16}/></label>
     <div className="jihad-request-list">{rows.map(r=><button key={r.id} className="jihad-request-row" onClick={()=>setSelected(r)}><span className={"jihad-priority "+(r.priority==="فوری"?"urgent":r.priority==="بالا"?"high":"normal")}>{r.priority}</span><span className="jihad-request-copy"><b>{r.title}</b><small>{r.id} · {r.scope}</small></span><span className="jihad-request-status">{r.status}<small>{r.age} پیش</small></span><ChevronLeft size={16}/></button>)}</div>
     {selected&&<div className="jihad-selected"><div><b>{selected.title}</b><small>{selected.id} · مسئول فعلی: {selected.owner}</small></div><button onClick={()=>setNotice("این فقط پیش‌نمایش است؛ هیچ ارجاع یا تغییری در سامانه ثبت نشده است.")}>پیش‌نمایش بستهٔ ارجاع</button></div>}
     {notice&&<div className="jihad-notice">{notice}</div>}
    </div>}
    <div className="jihad-bottom-note"><MapPin size={16}/><span>تقسیمات جغرافیایی این نمونه عمداً عمومی است؛ نام و کد رسمی استان، شهرستان، بخش، پهنه و مرکز خدمات باید با مرجع سازمانی تطبیق داده شود.</span></div>
   </div>
  </div>
 </section>;
}
