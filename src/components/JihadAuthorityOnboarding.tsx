import {useEffect,useState} from "react";
import type {ChangeEvent,FormEvent} from "react";
import type {Session} from "@supabase/supabase-js";
import {AlertCircle,CheckCircle2,FileText,Landmark,ShieldCheck,UploadCloud} from "lucide-react";
import {supabase} from "../lib/supabase";

type FormState={legalName:string;displayName:string;type:string;authorityRef:string;applicantName:string;applicantEmail:string;applicantPhone:string;adminName:string;adminEmail:string;adminPhone:string;mandateRef:string;scopeDescription:string;countryName:string;provinceName:string;countyName:string;serviceHubName:string;serviceLocations:string};
const initial=(email:string):FormState=>({legalName:"",displayName:"",type:"government",authorityRef:"",applicantName:"",applicantEmail:email,applicantPhone:"",adminName:"",adminEmail:"",adminPhone:"",mandateRef:"",scopeDescription:"",countryName:"ایران",provinceName:"خوزستان",countyName:"آبادان",serviceHubName:"آبادان",serviceLocations:"آبادان، چوئبده، اروندکنار"});
const statusLabel:Record<string,string>={pending_verification:"در انتظار احراز مدارک",under_review:"در حال بررسی",needs_correction:"نیازمند تکمیل یا اصلاح",approved:"تأیید شده",rejected:"رد شده",withdrawn:"مختومه"};
const types=[["government","سازمان دولتی"],["regulator","نهاد ناظر"],["support_agency","نهاد حمایتی"],["public_institution","مؤسسه عمومی"],["international_organization","سازمان بین‌المللی"],["research_institution","مؤسسه پژوهشی"],["nonprofit","سازمان مردم‌نهاد"]];
export default function JihadAuthorityOnboarding({session}:{session:Session}){
 const db=supabase as any;
 const [form,setForm]=useState<FormState>(()=>initial(session.user.email??""));
 const [files,setFiles]=useState<File[]>([]),[application,setApplication]=useState<any>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 useEffect(()=>{let live=true;(async()=>{
  if(!supabase){if(live)setLoading(false);return;}
  try{
   const {data:userId,error:userError}=await db.rpc("current_sarina_user_id");
   if(userError||!userId)throw new Error("شناسه حساب SARINA دریافت نشد.");
   const {data,error:readError}=await db.from("authority_onboarding_requests").select("*").eq("applicant_user_id",userId).order("created_at",{ascending:false}).limit(1).maybeSingle();
   if(readError)throw readError;
   if(live&&data)setApplication(data);
  }catch(e){if(live)setError(e instanceof Error?e.message:"خواندن وضعیت درخواست ممکن نشد.");}
  finally{if(live)setLoading(false);}
 })();return()=>{live=false;};},[session.user.id]);
 const change=(key:keyof FormState)=>(e:ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>setForm(old=>({...old,[key]:e.target.value}));
 function pickFiles(e:ChangeEvent<HTMLInputElement>){
  const chosen=Array.from(e.target.files??[]);
  if(chosen.some(f=>f.size>10*1024*1024)){setError("حجم هر مدرک باید حداکثر ۱۰ مگابایت باشد.");e.target.value="";return;}
  if(chosen.some(f=>!["application/pdf","image/jpeg","image/png"].includes(f.type))){setError("فقط PDF، JPG و PNG پذیرفته می‌شود.");e.target.value="";return;}
  if(files.length+chosen.length>10){setError("حداکثر ۱۰ مدرک می‌توانید بارگذاری کنید.");e.target.value="";return;}
  setError("");setFiles(old=>[...old,...chosen]);e.target.value="";
 }
 async function submit(e:FormEvent){
  e.preventDefault();if(!supabase)return;
  const requestedLocations=form.serviceLocations.split(/\\r?\\n/).flatMap(line=>line.split(/[،,]/)).map(x=>x.trim()).filter(Boolean);\n  if(!form.legalName.trim()||!form.displayName.trim()||!form.applicantName.trim()||!form.adminName.trim()||!form.adminEmail.trim()||!form.scopeDescription.trim()||!form.countryName.trim()||!requestedLocations.length){
   setError("نام رسمی سازمان، نام نمایشی، مشخصات متقاضی، مدیر پیشنهادی و شرح محدوده خدمات الزامی است.");return;
  }
  if(!files.length){setError("برای بررسی اولیه، دست‌کم یک مدرک رسمی یا معرفی‌نامه معتبر بارگذاری کنید.");return;}
  setBusy(true);setError("");setMessage("");
  const uploaded:string[]=[];
  try{
   const {data:userId,error:userError}=await db.rpc("current_sarina_user_id");
   if(userError||!userId)throw new Error("شناسه حساب SARINA دریافت نشد.");
   for(const file of files){
    const safe=file.name.replace(/[^\p{L}\p{N}._-]/gu,"_").slice(0,90);
    const path=session.user.id+"/"+crypto.randomUUID()+"-"+safe;
    const {error:uploadError}=await supabase.storage.from("authority-onboarding-documents").upload(path,file,{contentType:file.type,upsert:false});
    if(uploadError)throw new Error("بارگذاری مدرک ناموفق بود: "+uploadError.message);
    uploaded.push(path);
   }
   const {data,error:insertError}=await db.from("authority_onboarding_requests").insert({
    applicant_user_id:userId,organization_legal_name:form.legalName.trim(),organization_display_name:form.displayName.trim(),
    organization_type:form.type,registration_or_authority_reference:form.authorityRef.trim()||null,
    country_name:form.countryName.trim(),province_name:form.provinceName.trim(),county_name:form.countyName.trim(),service_hub_name:form.serviceHubName.trim(),
    requested_service_locations:requestedLocations,
    mandate_reference:form.mandateRef.trim()||null,applicant_contact_name:form.applicantName.trim(),
    applicant_contact_email:form.applicantEmail.trim()||null,applicant_contact_phone:form.applicantPhone.trim()||null,
    proposed_admin_full_name:form.adminName.trim(),proposed_admin_email:form.adminEmail.trim().toLowerCase(),
    proposed_admin_phone:form.adminPhone.trim()||null,service_scope_description:form.scopeDescription.trim(),
    evidence_document_paths:uploaded,status:"pending_verification"
   }).select("*").single();
   if(insertError)throw new Error(insertError.code==="23505"?"برای این حساب یک درخواست فعال وجود دارد؛ وضعیت همان درخواست را بررسی کنید.":"ثبت درخواست انجام نشد. لطفاً اطلاعات و دسترسی را بررسی کنید.");
   setApplication(data);setFiles([]);setMessage("درخواست احراز هویت سازمانی با موفقیت ثبت شد. هنوز هیچ سازمان یا دسترسی عملیاتی ایجاد نشده است.");
  }catch(e){
   if(uploaded.length)await supabase.storage.from("authority-onboarding-documents").remove(uploaded);
   setError(e instanceof Error?e.message:"ثبت درخواست ناموفق بود.");
  }finally{setBusy(false);}
 }
 if(loading)return <section className="jao-card" dir="rtl"><p>در حال بررسی وضعیت احراز سازمان...</p></section>;
 const canSubmit=!application||["rejected","withdrawn","needs_correction"].includes(application.status);
 return <section className="jao-card" dir="rtl">
  <style>{`.jao-card{margin:16px 0;padding:20px;border:1px solid #dce8d9;border-radius:18px;background:#f8fbf7;color:#294a34;display:grid;gap:14px}.jao-head{display:flex;justify-content:space-between;gap:12px}.jao-kicker{display:flex;align-items:center;gap:7px;color:#56805d;font-size:10px;font-weight:800}.jao-head h2{font-size:18px;margin:7px 0}.jao-head p,.jao-help{font-size:11px;color:#708174;line-height:1.9;margin:0}.jao-status{display:inline-flex;align-items:center;gap:7px;padding:7px 10px;border-radius:20px;background:#eef4e9;color:#557047;font-size:10px;font-weight:800;height:max-content}.jao-note{padding:11px 13px;background:#fff8e9;border:1px solid #efe2c2;border-radius:11px;color:#786033;font-size:11px;line-height:1.9}.jao-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.jao-field{display:grid;gap:6px;font-size:11px;font-weight:700}.jao-field input,.jao-field select,.jao-field textarea{width:100%;border:1px solid #dce6da;border-radius:10px;background:#fff;padding:10px;color:#294a34;font:inherit;font-size:12px;min-width:0}.jao-field textarea{resize:vertical}.jao-wide{grid-column:1/-1}.jao-locations{display:flex;flex-wrap:wrap;gap:7px}.jao-location{padding:6px 10px;background:#edf5ec;border:1px solid #dbe9d8;border-radius:30px;font-size:10px;color:#426c49}.jao-files{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.jao-filelist{font-size:10px;color:#687a6b;line-height:1.8}.jao-submit{border:0;border-radius:11px;padding:12px 16px;background:#2e6940;color:white;font:inherit;font-size:12px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:8px;width:max-content}.jao-submit:disabled{opacity:.5;cursor:not-allowed}.jao-alert{padding:10px 12px;border-radius:10px;background:#fff0ed;color:#914a3c;font-size:11px;line-height:1.8}.jao-success{padding:10px 12px;border-radius:10px;background:#edf7ed;color:#3e7148;font-size:11px;line-height:1.8}.jao-existing{border:1px solid #e1e9df;border-radius:12px;padding:13px;background:white;display:grid;gap:8px}.jao-existing b{font-size:13px}.jao-existing small{font-size:10px;color:#728174}.jao-foot{font-size:10px;color:#7b887d;line-height:1.8}@media(max-width:620px){.jao-grid{grid-template-columns:1fr}.jao-wide{grid-column:auto}.jao-head{flex-direction:column}}`}</style>
  <header className="jao-head"><div><span className="jao-kicker"><Landmark size={16}/> SARINA · احراز هویت سازمان‌ها</span><h2>درخواست احراز هویت سازمان و نهاد</h2><p>ثبت درخواست رسمی برای بررسی هویت حقوقی، مدارک، نماینده مجاز و محدوده مأموریت در هر کشور.</p></div><ShieldCheck size={25}/></header>
  <div className="jao-note"><b>مرز امنیتی مهم:</b> ثبت این فرم به معنی تأیید سازمان، ایجاد حساب مدیر، عضویت کارشناسان یا دسترسی به پرونده کشاورزان نیست. این مراحل فقط پس از بررسی مدارک و احراز حساب حقیقی مدیر انجام می‌شود.</div>
  {application&&<div className="jao-existing"><div className="jao-status"><CheckCircle2 size={14}/>{statusLabel[application.status]??application.status}</div><b>{application.organization_legal_name}</b><small>ثبت درخواست: {new Date(application.created_at).toLocaleDateString("fa-IR")} · محدوده: {[application.country_name,application.province_name,application.county_name].filter(Boolean).join("، ")}</small>{application.review_notes&&<div className="jao-note">یادداشت بررسی: {application.review_notes}</div>}</div>}
  {canSubmit&&<form onSubmit={submit} className="jao-grid">
   <label className="jao-field">نام رسمی نهاد مطابق سند *<input value={form.legalName} onChange={change("legalName")} placeholder="نام رسمی درج‌شده در معرفی‌نامه"/></label>
   <label className="jao-field">نام نمایشی سازمان *<input value={form.displayName} onChange={change("displayName")} placeholder="نام قابل نمایش در سارینا"/></label>
   <label className="jao-field">نوع نهاد<select value={form.type} onChange={change("type")}>{types.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>
   <label className="jao-field">شماره ثبت یا شناسه مرجع<input value={form.authorityRef} onChange={change("authorityRef")} placeholder="در صورت وجود"/></label>
   <label className="jao-field">نام و نام خانوادگی متقاضی *<input value={form.applicantName} onChange={change("applicantName")} placeholder="فرد ثبت‌کننده درخواست"/></label>
   <label className="jao-field">ایمیل متقاضی<input type="email" value={form.applicantEmail} onChange={change("applicantEmail")} dir="ltr"/></label>
   <label className="jao-field">تلفن متقاضی<input value={form.applicantPhone} onChange={change("applicantPhone")} dir="ltr" placeholder="+98..."/></label>
   <label className="jao-field">نام مدیر پیشنهادی سازمان *<input value={form.adminName} onChange={change("adminName")} placeholder="مطابق معرفی‌نامه رسمی"/></label>
   <label className="jao-field">ایمیل حساب مدیر پیشنهادی *<input type="email" value={form.adminEmail} onChange={change("adminEmail")} dir="ltr" placeholder="admin@example.gov.ir"/></label>
   <label className="jao-field">تلفن مدیر پیشنهادی<input value={form.adminPhone} onChange={change("adminPhone")} dir="ltr"/></label>
   <label className="jao-field jao-wide">شماره/مرجع ابلاغ مأموریت خدماتی<input value={form.mandateRef} onChange={change("mandateRef")} placeholder="شماره نامه یا مرجع رسمی پوشش منطقه‌ای"/></label>
   <div className="jao-field jao-wide"><span>کشور و محدوده جغرافیایی مأموریت *</span><div className="jao-grid"><label className="jao-field">کشور *<input value={form.countryName} onChange={change("countryName")} required placeholder="مثلاً ایران"/></label><label className="jao-field">استان / ایالت / منطقه اصلی<input value={form.provinceName} onChange={change("provinceName")} placeholder="در صورت کاربرد"/></label><label className="jao-field">شهرستان / ناحیه<input value={form.countyName} onChange={change("countyName")} placeholder="در صورت کاربرد"/></label><label className="jao-field">مرکز خدمات / دفتر مسئول<input value={form.serviceHubName} onChange={change("serviceHubName")} placeholder="مرکز مسئول ارائه خدمات"/></label><label className="jao-field jao-wide">شهرها و مناطق تحت پوشش *<textarea rows={2} value={form.serviceLocations} onChange={change("serviceLocations")} required placeholder="هر منطقه را با ویرگول یا در خط جدا وارد کنید."/></label></div><small className="jao-help">محدوده‌ها در این مرحله به‌صورت عنوان درخواستی ثبت می‌شوند؛ شناسه رسمی تقسیمات کشوری باید جداگانه از منبع معتبر تطبیق داده شود و تا آن زمان دسترسی جغرافیایی فعال نخواهد شد.</small></div>
   <label className="jao-field jao-wide">شرح مأموریت و خدمات مورد درخواست *<textarea rows={3} value={form.scopeDescription} onChange={change("scopeDescription")} placeholder="نوع خدمات، مسئولیت‌ها و محدوده مأموریت را توضیح دهید."/></label>
   <div className="jao-field jao-wide"><span>مدارک اثبات هویت و اختیار سازمان *</span><div className="jao-files"><label className="jao-submit"><UploadCloud size={15}/> انتخاب مدارک<input hidden type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={pickFiles}/></label><span className="jao-help">PDF/JPG/PNG · حداکثر ۱۰ مگابایت برای هر فایل · حداکثر ۱۰ فایل</span></div>{files.length>0&&<div className="jao-filelist">{files.map((f,i)=><div key={i}><FileText size={12} style={{verticalAlign:"middle",marginLeft:5}}/>{f.name}</div>)}</div>}</div>
   <button className="jao-submit jao-wide" type="submit" disabled={busy}>{busy?"در حال ثبت و بارگذاری...":"ثبت درخواست احراز هویت سازمان"} <ShieldCheck size={15}/></button>
  </form>}
  {error&&<div className="jao-alert"><AlertCircle size={14} style={{verticalAlign:"middle",marginLeft:5}}/>{error}</div>}
  {message&&<div className="jao-success">{message}</div>}
  <div className="jao-foot">مدارک در مخزن خصوصی نگهداری می‌شوند و فقط متقاضی و مدیران مجاز سارینا امکان مشاهده دارند. مدیر پیشنهادی تا زمان تطبیق ایمیل با حساب احرازشده، هیچ دسترسی‌ای دریافت نمی‌کند.</div>
 </section>;
}
