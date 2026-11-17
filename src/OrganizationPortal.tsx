import {useEffect,useMemo,useState} from "react";
import type {Session,ChangeEvent} from "@supabase/supabase-js";
import {ArrowLeft,Building2,CheckCircle2,Globe,Instagram,MapPin,Phone,Save,ShieldCheck,UploadCloud} from "lucide-react";
import {supabase} from "./lib/supabase";

type Profile = {
  legal_name:string; display_name:string; organization_type:string; registration_number:string;
  country_name:string; city:string; address:string; latitude:string; longitude:string;
  website_url:string; contact_email:string; contact_phone:string; contact_phones:string;
  description:string; support_areas:string; service_regions:string; social_links:string;
  office_locations:string; legal_documents:string;
};
const empty:Profile={legal_name:"",display_name:"",organization_type:"company",registration_number:"",country_name:"",city:"",address:"",latitude:"",longitude:"",website_url:"",contact_email:"",contact_phone:"",contact_phones:"",description:"",support_areas:"",service_regions:"",social_links:"",office_locations:"",legal_documents:""};
const split=(v:string)=>v.split(/[،,\n]/).map(x=>x.trim()).filter(Boolean);
const lines=(v:string)=>v.split("\n").map(x=>x.trim()).filter(Boolean);
function toForm(raw:Record<string,any>|null):Profile {
 if(!raw)return empty;
 const links=Array.isArray(raw.social_links)?raw.social_links.map((x:any)=>[x.platform,x.url].filter(Boolean).join(" | ")).join("\n"):"";
 const offices=Array.isArray(raw.office_locations)?raw.office_locations.map((x:any)=>[x.label,x.city,x.address].filter(Boolean).join(" | ")).join("\n"):"";
 const docs=Array.isArray(raw.legal_documents)?raw.legal_documents.map((x:any)=>[x.document_type,x.title].filter(Boolean).join(" | ")).join("\n"):"";
 return {...empty,...raw,latitude:raw.latitude==null?"":String(raw.latitude),longitude:raw.longitude==null?"":String(raw.longitude),contact_phones:Array.isArray(raw.contact_phones)?raw.contact_phones.join("\n"):"",support_areas:Array.isArray(raw.support_areas)?raw.support_areas.join("\n"):"",service_regions:Array.isArray(raw.service_regions)?raw.service_regions.join("\n"):"",social_links:links,office_locations:offices,legal_documents:docs};
}
function toPayload(f:Profile){
 return {...f,latitude:f.latitude?Number(f.latitude):null,longitude:f.longitude?Number(f.longitude):null,
  contact_phones:split(f.contact_phones),
  support_areas:lines(f.support_areas),service_regions:lines(f.service_regions),
  social_links:lines(f.social_links).map(x=>{const [platform,url]=x.split("|").map(y=>y.trim());return {platform:platform||"other",url};}),
  office_locations:lines(f.office_locations).map(x=>{const [label,city,address]=x.split("|").map(y=>y.trim());return {label:label||"دفتر",city,address:address||city||label};}),
  legal_documents:lines(f.legal_documents).map(x=>{const [document_type,title]=x.split("|").map(y=>y.trim());return {document_type:document_type||"other",title:title||document_type};})
 };
}
export default function OrganizationPortal({session,onLogout}:{session:Session;onLogout:()=>void}){
 const [form,setForm]=useState<Profile>(empty),[percent,setPercent]=useState(0),[status,setStatus]=useState("draft"),[application,setApplication]=useState<any>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[message,setMessage]=useState("");
 const locked=["under_review","verified","suspended"].includes(status);
 const statusText:Record<string,string>={draft:"پیش‌نویس؛ قابل تکمیل",needs_correction:"نیازمند اصلاح",under_review:"در حال بررسی سارینا",verified:"تأییدشده",suspended:"تعلیق‌شده"};
 async function refresh(){
  if(!supabase)return;
  const {data,error}=await supabase.functions.invoke("organization-registration",{body:{action:"status"}});
  if(error||!data?.ok)throw new Error("دریافت اطلاعات سازمان ممکن نشد.");
  setForm(toForm(data.draft?.profile_data??null));setPercent(data.draft?.completion_percent??0);setStatus(data.draft?.status??"draft");setApplication(data.applications?.[0]??null);
 }
 useEffect(()=>{let live=true;(async()=>{try{await refresh();}catch(e){if(live)setMessage(e instanceof Error?e.message:"خطا در دریافت اطلاعات");}finally{if(live)setLoading(false);}})();return()=>{live=false;};},[]);
 const update=(key:keyof Profile,value:string)=>setForm(old=>({...old,[key]:value}));
 async function save(){
  if(!supabase)return;
  setBusy(true);setMessage("");
  try{
   const {data,error}=await supabase.functions.invoke("organization-registration",{body:{action:"save_draft",profile_data:toPayload(form)}});
   if(error||!data?.ok)throw new Error(data?.code==="DRAFT_LOCKED"?"این پرونده در وضعیت بررسی یا تأیید است و فعلاً قابل ویرایش نیست.":"ذخیره اطلاعات انجام نشد؛ موارد واردشده را بررسی کنید.");
   setPercent(data.draft.completion_percent);setStatus(data.draft.status);setMessage("اطلاعات با موفقیت ذخیره شد؛ هر زمان خواستید می‌توانید ادامه دهید.");
  }catch(e){setMessage(e instanceof Error?e.message:"ذخیره اطلاعات ناموفق بود.");}finally{setBusy(false);}
 }
 async function submit(){
  if(!supabase)return;
  setBusy(true);setMessage("");
  try{
   const saved=await supabase.functions.invoke("organization-registration",{body:{action:"save_draft",profile_data:toPayload(form)}});
   if(saved.error||!saved.data?.ok)throw new Error("ابتدا اطلاعات را ذخیره کنید و موارد ضروری را کامل کنید.");
   const result=await supabase.functions.invoke("organization-registration",{body:{action:"submit"}});
   if(result.error||!result.data?.ok)throw new Error(result.data?.code==="REQUIRED_FIELDS_MISSING"?"نام رسمی، نام نمایشی، نوع شرکت، راه تماس، شهر و نشانی دفتر الزامی است.":"ارسال برای بررسی انجام نشد.");
   await refresh();setMessage("پرونده برای بررسی ارسال شد. تا زمان تأیید، امکان فروش فعال نمی‌شود.");
  }catch(e){setMessage(e instanceof Error?e.message:"ارسال پرونده ناموفق بود.");}finally{setBusy(false);}
 }
 const set=(key:keyof Profile)=>(e:ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>update(key,e.target.value);
 const field=(label:string,key:keyof Profile,placeholder="",type="text")=><label className="org-field">{label}<input type={type} value={form[key]} onChange={set(key)} placeholder={placeholder} disabled={locked} dir={["website_url","contact_email","latitude","longitude"].includes(key)?"ltr":"auto"}/></label>;
 if(loading)return <div className="loading-screen">در حال آماده‌سازی پنل شرکت...</div>;
 return <div className="org-shell" dir="rtl">
  <header className="org-top"><div className="org-brand"><span><Building2/></span><div><b>SARINA</b><small>پنل سازمانی</small></div></div><div className="org-user"><span>{session.user.email}</span><button onClick={onLogout}>خروج</button></div></header>
  <main className="org-main">
   <div className="org-welcome"><div><span className="eyebrow">فضای اختصاصی شرکت‌ها</span><h1>به سارینا خوش آمدید</h1><p>اطلاعات شرکت را هر زمان خواستید تکمیل کنید؛ برای آشنایی با محیط نیازی به تکمیل همه مدارک نیست.</p></div><div className="org-status"><ShieldCheck/><b>{statusText[status]||"پیش‌نویس"}</b></div></div>
   <section className="org-progress"><div><strong>تکمیل پروفایل شرکت</strong><b>{percent.toLocaleString("fa-IR")}٪</b></div><div className="org-track"><span style={{width:percent+"%"}}/></div><small>پیشرفت ذخیره می‌شود و می‌توانید بعداً از همین‌جا ادامه دهید.</small></section>
   {message&&<div className="notice">{message}</div>}
   {application&&<div className="org-application"><CheckCircle2/><div><b>درخواست بررسی ثبت شده</b><small>وضعیت: {application.status==="pending"?"در صف بررسی":application.status}</small></div></div>}
   <section className="org-section"><h2>۱. اطلاعات پایه شرکت</h2><p>اطلاعات هویتی و زمینه فعالیت</p><div className="org-grid">
    {field("نام رسمی شرکت *","legal_name","مطابق مدارک ثبت")}
    {field("نام تجاری یا نمایشی *","display_name","نامی که کاربران می‌بینند")}
    <label className="org-field">نوع سازمان *<select value={form.organization_type} onChange={set("organization_type")} disabled={locked}><option value="company">شرکت</option><option value="cooperative">تعاونی</option><option value="laboratory">آزمایشگاه</option><option value="supplier">تأمین‌کننده</option><option value="buyer">خریدار</option><option value="research">مرکز پژوهشی</option><option value="university">دانشگاه</option><option value="other">سایر</option></select></label>
    {field("شناسه یا شماره ثبت","registration_number","شماره ثبت قانونی")}
    {field("کشور","country_name","کشور محل ثبت")}
    {field("شهر *","city","شهر دفتر اصلی")}
    {field("حوزه‌های فعالیت","support_areas","هر مورد در یک خط")}
   </div><label className="org-field">معرفی کوتاه شرکت<textarea value={form.description} onChange={set("description")} disabled={locked} rows={3}/></label></section>
   <section className="org-section"><h2>۲. اطلاعات تماس و نشانی</h2><p>راه‌های ارتباطی و محل دفتر مرکزی و شعب</p><div className="org-grid">
    {field("شماره تماس اصلی *","contact_phone","+98...")}
    {field("ایمیل ارتباطی","contact_email","info@example.com","email")}
    {field("وب‌سایت رسمی","website_url","https://example.com","url")}
    {field("شماره‌های تماس دیگر","contact_phones","هر شماره در یک خط")}
    {field("عرض جغرافیایی دفتر","latitude","مثلاً 35.7","number")}
    {field("طول جغرافیایی دفتر","longitude","مثلاً 51.4","number")}
   </div><label className="org-field">نشانی کامل دفتر *<textarea value={form.address} onChange={set("address")} disabled={locked} rows={2}/></label>
    <label className="org-field">نشانی دفترها و شعب (هر خط: عنوان | شهر | نشانی)<textarea value={form.office_locations} onChange={set("office_locations")} disabled={locked} rows={3} placeholder={"دفتر مرکزی | تهران | خیابان...\nشعبه جنوب | اهواز | خیابان..."}/></label>
   </section>
   <section className="org-section"><h2>۳. شبکه‌های اجتماعی و تبلیغاتی</h2><p>هر تعداد صفحه عمومی دارید اضافه کنید؛ اینستاگرام تنها گزینه نیست.</p><label className="org-field">هر خط: نام شبکه یا صفحه | لینک کامل<textarea value={form.social_links} onChange={set("social_links")} disabled={locked} rows={4} placeholder={"Instagram | https://instagram.com/yourpage\nTelegram | https://t.me/yourchannel\nLinkedIn | https://linkedin.com/company/..."}/></label></section>
   <section className="org-section"><h2>۴. محصولات، خدمات و مناطق فعالیت</h2><p>این اطلاعات به معرفی درست شرکت به کشاورزان کمک می‌کند.</p><div className="org-grid">
    <label className="org-field">محصولات یا خدمات اصلی<textarea value={form.support_areas} onChange={set("support_areas")} disabled={locked} rows={3} placeholder="هر مورد در یک خط"/></label>
    <label className="org-field">استان‌ها و مناطق تحت پوشش<textarea value={form.service_regions} onChange={set("service_regions")} disabled={locked} rows={3} placeholder="هر منطقه در یک خط"/></label>
   </div></section>
   <section className="org-section"><h2>۵. مدارک قانونی</h2><p>فعلاً عنوان مدارک موردنیاز را ثبت کنید. بارگذاری امن فایل‌ها در مرحله اتصال فضای اسناد فعال خواهد شد.</p><label className="org-field">عنوان مدرک و نوع آن (هر خط: نوع | عنوان)<textarea value={form.legal_documents} onChange={set("legal_documents")} disabled={locked} rows={3} placeholder={"مجوز فعالیت | پروانه کسب\nثبت شرکت | آگهی تأسیس"}/></label><div className="org-hint"><UploadCloud size={18}/> فایل‌های مدرک هنوز در این نسخه بارگذاری نمی‌شوند؛ این قسمت فعلاً برای ثبت فهرست مدارک است.</div></section>
   <section className="org-gate"><ShieldCheck/><div><b>مجوز فروش پس از تأیید فعال می‌شود</b><p>ورود به پنل، آشنایی با محیط و ذخیره اطلاعات آزاد است. انتشار محصول و فروش تا تکمیل و تأیید اطلاعات و مدارک ضروری غیرفعال می‌ماند.</p></div></section>
   <div className="org-actions"><button className="primary-button" onClick={save} disabled={busy||locked}><Save size={17}/>{busy?"در حال ذخیره...":"ذخیره و ادامه در آینده"}</button><button className="org-submit" onClick={submit} disabled={busy||locked}>ارسال اطلاعات برای بررسی <ArrowLeft size={17}/></button></div>
   <footer className="org-footer">SARINA · هیچ کشاورزی تنها نیست · پنل سازمانی</footer>
  </main>
 </div>;
}
