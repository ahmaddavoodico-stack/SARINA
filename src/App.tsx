import {useEffect,useMemo,useState} from "react";
import type {FormEvent} from "react";
import type {Session} from "@supabase/supabase-js";
import {Activity,ArrowLeft,Bell,BookOpen,Building2,CheckCircle2,ChevronLeft,ClipboardList,CloudSun,Home,LogOut,Menu,MessageCircle,Search,ShieldCheck,Sprout,Tractor,UserRound} from "lucide-react";
import {isSupabaseConfigured,supabase} from "./lib/supabase";
import FarmWorkspace from "./FarmWorkspace";

type Page="home"|"farms"|"services"|"requests"|"learning";
type Service={id:string;title:string;description:string|null;public_description:string|null;service_category:string|null;submission_mode:string;is_official_authority:boolean;legal_basis:string|null;official_service_url:string|null;response_sla_days:number|null;organization_id:string};
type RequestRow={id:string;request_number:number;request_title:string;status:string;submitted_at:string;submission_mode:string};
const nav:{id:Page;label:string;icon:typeof Home}[]=[{id:"home",label:"نمای کلی",icon:Home},{id:"farms",label:"مزارع من",icon:Sprout},{id:"services",label:"خدمات سازمانی",icon:Building2},{id:"requests",label:"درخواست‌های من",icon:ClipboardList},{id:"learning",label:"آموزش و راهنما",icon:BookOpen}];
const statuses:Record<string,string>={submitted:"ثبت‌شده در سارینا",needs_information:"نیازمند اطلاعات",accepted:"پذیرفته‌شده",in_progress:"در حال بررسی",forwarded_to_authority:"ارجاع به مرجع رسمی",awaiting_official_response:"در انتظار پاسخ مرجع",approved:"تأییدشده",rejected:"ردشده",completed:"تکمیل‌شده",unable_to_route:"نیازمند بررسی مسیر",withdrawn:"پس‌گرفته‌شده"};
function Brand(){return <div className="brand"><div className="brand-mark"><Sprout size={24}/></div><div><strong>SARINA</strong><span>همراه هوشمند کشاورز</span></div></div>}
type AuthLanguage="en"|"fa"|"ar";
const AUTH_LANGUAGES:AuthLanguage[]=["en","fa","ar"];
function getInitialAuthLanguage():AuthLanguage{
  try{
    const saved=localStorage.getItem("sarina-language");
    if(saved&&AUTH_LANGUAGES.includes(saved as AuthLanguage))return saved as AuthLanguage;
  }catch{}
  const browser=typeof navigator!=="undefined"?navigator.language.toLowerCase():"en";
  if(browser.startsWith("fa"))return "fa";
  if(browser.startsWith("ar"))return "ar";
  return "en";
}
const authCopy={
  en:{direction:"ltr",tag:"A global platform for agriculture",headline:"Growing a better future,",headlineAccent:"together.",description:"Knowledge, technology and a connected farming community — helping every farmer move forward.",foot:"Smart agriculture. Shared knowledge. Stronger communities.",welcome:"Welcome to SARINA",loginTitle:"Welcome back",signupTitle:"Create your farmer account",intro:"Your next step towards smarter, more resilient farming starts here.",config:"Authentication is not configured yet. Please check the project environment settings.",name:"Full name",namePlaceholder:"Your name",email:"Email address",password:"Password",passwordPlaceholder:"At least 8 characters",busy:"Please wait…",login:"Sign in",signup:"Create account",switchToSignup:"New to SARINA?",switchToLogin:"Already have an account?",signupLink:"Create an account",loginLink:"Sign in",success:"Your account has been created. If email confirmation is enabled, please check your inbox.",error:"Something went wrong. Please try again.",footer:"No farmer is alone.",language:"Language"},
  fa:{direction:"rtl",tag:"یک پلتفرم جهانی برای کشاورزی",headline:"آینده‌ای بهتر می‌سازیم،",headlineAccent:"در کنار هم.",description:"دانش، فناوری و جامعه‌ای به‌هم‌پیوسته از کشاورزان؛ برای پیشرفت و تاب‌آوری بیشتر هر مزرعه.",foot:"کشاورزی هوشمند. دانش مشترک. جامعه‌ای توانمندتر.",welcome:"به خانواده جهانی SARINA خوش آمدید",loginTitle:"خوش آمدید",signupTitle:"ساخت حساب کشاورز",intro:"گام بعدی شما برای کشاورزی هوشمندتر و تاب‌آورتر از اینجا آغاز می‌شود.",config:"اتصال احراز هویت هنوز تنظیم نشده است. تنظیمات محیط پروژه را بررسی کنید.",name:"نام و نام خانوادگی",namePlaceholder:"نام شما",email:"نشانی ایمیل",password:"رمز عبور",passwordPlaceholder:"حداقل ۸ نویسه",busy:"لطفاً صبر کنید…",login:"ورود به حساب",signup:"ایجاد حساب",switchToSignup:"هنوز به SARINA نپیوسته‌اید؟",switchToLogin:"قبلاً حساب ساخته‌اید؟",signupLink:"ثبت‌نام",loginLink:"ورود",success:"حساب شما ایجاد شد. اگر تأیید ایمیل فعال باشد، لطفاً صندوق ورودی خود را بررسی کنید.",error:"مشکلی پیش آمد. لطفاً دوباره تلاش کنید.",footer:"هیچ کشاورزی تنها نیست.",language:"زبان"},
  ar:{direction:"rtl",tag:"منصة عالمية للزراعة",headline:"نبني مستقبلاً أفضل،",headlineAccent:"معاً.",description:"المعرفة والتكنولوجيا ومجتمع زراعي مترابط — لتمكين كل مزارع من التقدم.",foot:"زراعة ذكية. معرفة مشتركة. مجتمعات أقوى.",welcome:"مرحباً بك في عائلة SARINA",loginTitle:"مرحباً بعودتك",signupTitle:"إنشاء حساب المزارع",intro:"تبدأ من هنا خطوتك التالية نحو زراعة أكثر ذكاءً وقدرةً على الصمود.",config:"لم يتم إعداد المصادقة بعد. يرجى مراجعة إعدادات بيئة المشروع.",name:"الاسم الكامل",namePlaceholder:"اسمك",email:"البريد الإلكتروني",password:"كلمة المرور",passwordPlaceholder:"٨ أحرف على الأقل",busy:"يرجى الانتظار…",login:"تسجيل الدخول",signup:"إنشاء حساب",switchToSignup:"جديد في SARINA؟",switchToLogin:"لديك حساب بالفعل؟",signupLink:"إنشاء حساب",loginLink:"تسجيل الدخول",success:"تم إنشاء حسابك. إذا كان تأكيد البريد الإلكتروني مفعّلاً، يرجى مراجعة صندوق الوارد.",error:"حدث خطأ ما. يرجى المحاولة مرة أخرى.",footer:"لا يوجد مزارع وحده.",language:"اللغة"}
} as const;
function AuthScreen(){
  const[language,setLanguage]=useState<AuthLanguage>(getInitialAuthLanguage);
  const[mode,setMode]=useState<"login"|"signup">("login");
  const[email,setEmail]=useState(""),[password,setPassword]=useState(""),[name,setName]=useState("");
  const[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const t=authCopy[language];
  useEffect(()=>{
    document.documentElement.lang=language;
    document.documentElement.dir=t.direction;
    try{localStorage.setItem("sarina-language",language);}catch{}
  },[language,t.direction]);
  async function submit(e:FormEvent){
    e.preventDefault();if(!supabase)return;setBusy(true);setMessage("");
    try{
      if(mode==="login"){
        const{data,error}=await supabase.auth.signInWithPassword({email,password});
        if(error)throw error;
        const accountLanguage=data.user?.user_metadata?.preferred_language;
        if(accountLanguage&&AUTH_LANGUAGES.includes(accountLanguage as AuthLanguage)){
          const selected=accountLanguage as AuthLanguage;
          setLanguage(selected);
          try{localStorage.setItem("sarina-language",selected);}catch{}
        }
      }else{
        const{error}=await supabase.auth.signUp({email,password,options:{data:{
          full_name:name,
          preferred_language:language,
          language,
        }}});
        if(error)throw error;
        setMessage(t.success);
      }
    }catch{
      setMessage(t.error);
    }finally{setBusy(false);}
  }
  const changeMode=(next:"login"|"signup")=>{setMode(next);setMessage("");};
  return <main className="auth-shell" dir={t.direction}>
    <section className="auth-visual">
      <div className="auth-brand"><div className="auth-brand-mark"><Sprout size={25}/></div><div><strong>SARINA</strong><span>GLOBAL AGRICULTURE PLATFORM</span></div></div>
      <div className="auth-message">
        <span className="eyebrow">{t.tag}</span>
        <h1>{t.headline}<br/><em>{t.headlineAccent}</em></h1>
        <p>{t.description}</p>
      </div>
      <div className="auth-orbit"><div className="auth-orbit-inner"><Sprout size={76}/></div><span className="orbit-dot dot-one"/><span className="orbit-dot dot-two"/><span className="orbit-dot dot-three"/></div>
      <span className="auth-foot">{t.foot}</span>
      <span className="auth-global-mark">SARINA <i>·</i> WE STAND TOGETHER</span>
    </section>
    <section className="auth-panel">
      <div className="auth-card">
        <div className="auth-language-row">
          <span>{t.language}</span>
          <div className="auth-language-switch" role="group" aria-label="Choose language">
            <button type="button" className={language==="en"?"selected":""} aria-pressed={language==="en"} onClick={()=>setLanguage("en")}>English</button>
            <button type="button" className={language==="fa"?"selected":""} aria-pressed={language==="fa"} onClick={()=>setLanguage("fa")}>فارسی</button>
            <button type="button" className={language==="ar"?"selected":""} aria-pressed={language==="ar"} onClick={()=>setLanguage("ar")}>العربية</button>
          </div>
        </div>
        <span className="eyebrow">{t.welcome}</span>
        <h2>{mode==="login"?t.loginTitle:t.signupTitle}</h2>
        <p className="muted">{t.intro}</p>
        {!isSupabaseConfigured&&<div className="notice warning">{t.config}</div>}
        <form onSubmit={submit}>
          {mode==="signup"&&<label>{t.name}<input value={name} onChange={e=>setName(e.target.value)} required placeholder={t.namePlaceholder}/></label>}
          <label>{t.email}<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="name@example.com" dir="ltr" autoComplete="email"/></label>
          <label>{t.password}<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} placeholder={t.passwordPlaceholder} dir="ltr" autoComplete={mode==="login"?"current-password":"new-password"}/></label>
          {message&&<div className="notice" role="status">{message}</div>}
          <button className="primary-button" disabled={!supabase||busy}>{busy?t.busy:mode==="login"?t.login:t.signup}<ArrowLeft size={18}/></button>
        </form>
        <div className="auth-switch">{mode==="login"?t.switchToSignup:t.switchToLogin} <button onClick={()=>changeMode(mode==="login"?"signup":"login")}>{mode==="login"?t.signupLink:t.loginLink}</button></div>
        <div className="auth-trust"><ShieldCheck size={15}/><span>{t.footer}</span></div>
      </div>
      <div className="auth-bottom">© SARINA · WE STAND TOGETHER</div>
    </section>
  </main>;
}
function Heading({eyebrow,title,description}:{eyebrow:string;title:string;description:string}){return <div className="page-heading"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>}
function Empty({icon:Icon,title,description}:{icon:typeof Home;title:string;description:string}){return <section><Heading eyebrow="در حال توسعه" title={title} description={description}/><div className="empty-state"><Icon size={38}/><strong>این بخش در حال آماده‌سازی است</strong><p>ساختار اولیه وب‌اپ آماده شده و این قابلیت‌ها به‌صورت مرحله‌ای اضافه می‌شوند.</p></div></section>}
function HomePage({session,requests,services,loading,go}:{session:Session;requests:RequestRow[];services:Service[];loading:boolean;go:(p:Page)=>void}){const first=session.user.user_metadata?.full_name?.split(" ")[0]||"کشاورز عزیز";return <section><div className="welcome-row"><div><span className="eyebrow">امروز، فرصتی تازه برای رشد</span><h1>سلام {first}، خوش آمدید 🌱</h1><p>بیایید وضعیت مزرعه و مسیر پیشرفتتان را دنبال کنیم.</p></div><div className="weather-card"><CloudSun size={25}/><div><strong>آب‌وهوا</strong><span>پس از ثبت موقعیت مزرعه فعال می‌شود</span></div></div></div><div className="hero-banner"><div className="hero-copy"><span>همراه هوشمند کشاورزی شما</span><h2>مزرعه‌ات را بهتر بشناس،<br/>هوشمندانه‌تر تصمیم بگیر.</h2><p>اطلاعات مزرعه را ثبت کن تا سارینا بتواند راهنمایی دقیق‌تر و متناسب‌تری ارائه دهد.</p><button onClick={()=>go("farms")}>شروع پرونده مزرعه <ArrowLeft size={17}/></button></div><div className="hero-art"><div className="sun"/><div className="hill h1"/><div className="hill h2"/><div className="hill h3"/><Sprout className="plant p1"/><Sprout className="plant p2"/></div></div><div className="section-title"><div><span className="eyebrow">نمای سریع</span><h2>وضعیت فضای کشاورز</h2></div><span className="live-dot">نمای حساب</span></div><div className="stat-grid"><button className="stat-card" onClick={()=>go("farms")}><span className="stat-icon green"><Sprout/></span><span>مزارع ثبت‌شده</span><strong>۰</strong><small>شروع با ثبت اولین مزرعه</small></button><button className="stat-card" onClick={()=>go("services")}><span className="stat-icon sand"><Building2/></span><span>خدمات فعال</span><strong>{loading?"—":services.length.toLocaleString("fa-IR")}</strong><small>خدمات منتشرشده در سارینا</small></button><button className="stat-card" onClick={()=>go("requests")}><span className="stat-icon blue"><ClipboardList/></span><span>درخواست‌های من</span><strong>{loading?"—":requests.length.toLocaleString("fa-IR")}</strong><small>درخواست‌های قابل پیگیری</small></button><button className="stat-card" onClick={()=>go("learning")}><span className="stat-icon lilac"><Activity/></span><span>پیشرفت مزرعه</span><strong>—</strong><small>پس از تکمیل پرونده فعال می‌شود</small></button></div><div className="lower-grid"><article className="panel"><span className="round-icon"><Tractor/></span><h3>پرونده مزرعه‌ات را بساز</h3><p>با چند انتخاب ساده، موقعیت، محصول، منابع آب و ویژگی‌های اصلی مزرعه را ثبت کن.</p><button className="text-button" onClick={()=>go("farms")}>رفتن به مزارع من <ArrowLeft size={16}/></button></article><article className="panel"><span className="round-icon"><ShieldCheck/></span><h3>حریم خصوصی و اعتماد</h3><p>اطلاعات شما فقط در چارچوب دسترسی مجاز و رضایت ثبت‌شده استفاده می‌شود.</p><span className="secure-note"><CheckCircle2 size={15}/> دسترسی مرحله‌ای و کنترل‌شده</span></article></div></section>}
export default function App(){const[session,setSession]=useState<Session|null>(null),[ready,setReady]=useState(!isSupabaseConfigured),[page,setPage]=useState<Page>("home"),[services,setServices]=useState<Service[]>([]),[requests,setRequests]=useState<RequestRow[]>([]),[message,setMessage]=useState(""),[loading,setLoading]=useState(false),[mobile,setMobile]=useState(false),[search,setSearch]=useState("");
useEffect(()=>{if(!supabase)return;supabase.auth.getSession().then(({data})=>{setSession(data.session);setReady(true);});const{data}=supabase.auth.onAuthStateChange((_event,s)=>setSession(s));return()=>data.subscription.unsubscribe();},[]);
useEffect(()=>{if(!session||!supabase)return;let active=true;setLoading(true);Promise.all([supabase.from("organization_services").select("id,title,description,public_description,service_category,submission_mode,is_official_authority,legal_basis,official_service_url,response_sla_days,organization_id").eq("status","active").limit(30),supabase.from("institutional_service_requests").select("id,request_number,request_title,status,submitted_at,submission_mode").order("submitted_at",{ascending:false}).limit(10)]).then(([s,r])=>{if(!active)return;if(s.error||r.error)setMessage("بخشی از اطلاعات هنوز از طریق Data API در دسترس نیست؛ مجوزهای API و سیاست‌های RLS باید بررسی شوند.");else{setServices((s.data??[]) as Service[]);setRequests((r.data??[]) as RequestRow[]);}}).catch(()=>active&&setMessage("دریافت اطلاعات با مشکل روبه‌رو شد. اتصال را بررسی کنید.")).finally(()=>active&&setLoading(false));return()=>{active=false;};},[session]);
const visible=useMemo(()=>services.filter(s=>[s.title,s.description,s.public_description,s.service_category].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase())),[services,search]);
async function logout(){await supabase?.auth.signOut();setSession(null);}
if(!ready)return <div className="loading-screen">در حال آماده‌سازی سارینا...</div>;if(!session)return <AuthScreen/>;
return <div className="app-shell"><aside className={mobile?"sidebar open":"sidebar"}><Brand/><div className="side-label">فضای کشاورز</div><nav>{nav.map(n=><button key={n.id} className={page===n.id?"nav-item active":"nav-item"} onClick={()=>{setPage(n.id);setMobile(false);}}><n.icon size={19}/>{n.label}{page===n.id&&<ChevronLeft className="nav-arrow" size={16}/>}</button>)}</nav><div className="sidebar-bottom"><div className="support-card"><MessageCircle size={19}/><strong>نیاز به راهنمایی دارید؟</strong><p>ما در مسیر مدیریت مزرعه همراه شما هستیم.</p><button onClick={()=>setPage("learning")}>راهنمای سارینا <ArrowLeft size={14}/></button></div><div className="sidebar-user"><span className="avatar"><UserRound size={18}/></span><div className="user-copy"><strong>{session.user.user_metadata?.full_name||"کشاورز سارینا"}</strong><span>{session.user.email}</span></div><button className="icon-button" title="خروج" onClick={logout}><LogOut size={17}/></button></div></div></aside>{mobile&&<button className="scrim" onClick={()=>setMobile(false)} aria-label="بستن منو"/>}<main className="main-area"><header className="topbar"><button className="icon-button mobile-menu" onClick={()=>setMobile(true)}><Menu/></button><div className="breadcrumb">فضای کشاورز <ChevronLeft size={14}/><strong>{nav.find(n=>n.id===page)?.label}</strong></div><div className="top-actions"><span className="connection-pill"/> <Bell size={19}/></div></header><div className="page-content">{message&&<div className="notice warning">{message}</div>}{page==="home"&&<HomePage session={session} requests={requests} services={services} loading={loading} go={setPage}/ >}{page==="farms"&&<FarmWorkspace session={session}/>}{page==="learning"&&<Empty icon={BookOpen} title="آموزش و راهنما" description="راهنماهای کوتاه و کاربردی برای استفاده از سارینا به‌زودی در این بخش قرار می‌گیرند."/>}{page==="services"&&<section><Heading eyebrow="ارتباط با نهادهای مسئول" title="خدمات سازمانی" description="خدمات فعال و مراجع تأییدشده‌ای که می‌توانند به درخواست شما رسیدگی کنند."/><div className="search-box"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="جست‌وجوی خدمت یا موضوع..."/></div>{loading?<div className="empty-state">در حال دریافت خدمات...</div>:visible.length===0?<div className="empty-state"><Building2 size={32}/><strong>هنوز خدمتی برای نمایش ثبت نشده است</strong><p>پس از تأیید و انتشار خدمات توسط مدیر مرکزی، فهرست آن‌ها اینجا نمایش داده می‌شود.</p></div>:<div className="service-grid">{visible.map(s=><article className="service-card" key={s.id}><div className="service-top"><Building2 size={20}/>{s.is_official_authority&&<span className="verified"><ShieldCheck size={14}/> مرجع رسمی</span>}</div><h3>{s.title}</h3><p>{s.public_description||s.description||"توضیحات این خدمت هنوز تکمیل نشده است."}</p>{s.legal_basis&&<small>مبنای قانونی: {s.legal_basis}</small>}<div className="service-meta"><span>{s.submission_mode==="sarina_assisted"?"ثبت در سارینا":s.submission_mode==="official_portal"?"درگاه رسمی":s.submission_mode==="api"?"اتصال سامانه‌ای":s.submission_mode==="email"?"ایمیل":"اطلاع‌رسانی"}</span>{s.response_sla_days&&<span>زمان پاسخ اعلامی: {s.response_sla_days} روز</span>}</div>{s.official_service_url&&<a href={s.official_service_url} target="_blank" rel="noreferrer">ورود به درگاه رسمی <ArrowLeft size={14}/></a>}</article>)}</div>}</section>}{page==="requests"&&<section><Heading eyebrow="پیگیری و شفافیت" title="درخواست‌های من" description="وضعیت درخواست‌های ثبت‌شده و رویدادهای قابل مشاهده برای شما."/><div className="request-list">{requests.length===0?<div className="empty-state"><ClipboardList size={32}/><strong>هنوز درخواستی ثبت نکرده‌اید</strong><p>با فعال‌شدن خدمات سازمانی می‌توانید درخواست خود را ثبت و پیگیری کنید.</p></div>:requests.map(r=><article className="request-row" key={r.id}><b>#{r.request_number}</b><div><strong>{r.request_title}</strong><small>{new Date(r.submitted_at).toLocaleDateString("fa-IR")}</small></div><span>{statuses[r.status]||r.status}</span></article>)}</div></section>}</div><footer className="app-footer"><span>© SARINA · هیچ کشاورزی تنها نیست</span><span>نسخه آزمایشی اولیه</span></footer></main></div>;
}