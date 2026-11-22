import {useEffect,useMemo,useState} from "react";
import {CheckCircle2,Clipboard,Landmark,ShieldCheck,Trash2} from "lucide-react";
import {supabase} from "../lib/supabase";

type Organization={id:string;display_name:string;organization_type:string};
type Consent={id:string;organization_id:string;consent_scopes:string[];purpose_code:string;status:string;granted_at:string;expires_at:string|null;revoked_at:string|null;created_at:string};
const scopeOptions=[
 {value:"identity_summary",label:"شناسه و اطلاعات هویتی مختصر کشاورز",detail:"نام نمایشی و کد یکتای SARINA"},
 {value:"institutional_messaging",label:"دریافت پیام رسمی از جهاد و نهادهای مجاز",detail:"اجازه ارسال پیام داخل SARINA؛ فقط برای سازمان تأییدشده و محدوده مجاز، قابل لغو در هر زمان"},
 {value:"farm_summary",label:"خلاصه مزارع و محدوده فعالیت",detail:"تعداد مزارع و نام محدوده اداری ثبت‌شده"},
 {value:"assigned_specialist",label:"متخصص مسئول پرونده",detail:"نام و وضعیت انتساب متخصص مرتبط"},
 {value:"institutional_support_history",label:"سوابق حمایت سازمانی",detail:"حمایت‌های ثبت‌شده و وضعیت تحویل"},
 {value:"productivity_metrics",label:"شاخص‌های بهره‌وری",detail:"اندازه‌گیری‌های ثبت‌شده با واحد و تاریخ"},
 {value:"outcome_summary",label:"خلاصه نتایج و ارزیابی",detail:"نتایج بازبینی‌شده و سطح اطمینان شواهد"},
 {value:"directive_delivery",label:"دستورالعمل‌ها و پیگیری اجرا",detail:"دستورالعمل‌های مرتبط و وضعیت دریافت/اجرا"}
];
const organizationTypes=["government","regulator","support_agency","public_institution"];
const faDate=(value:string|null)=>value?new Date(value).toLocaleDateString("fa-IR"):"بدون تاریخ انقضا";

export default function FarmerIdentityCard({userId}:{userId:string}){
 const [code,setCode]=useState("");
 const [organizations,setOrganizations]=useState<Organization[]>([]);
 const [consents,setConsents]=useState<Consent[]>([]);
 const [organizationId,setOrganizationId]=useState("");
 const [selectedScopes,setSelectedScopes]=useState<string[]>(["identity_summary"]);
 const [duration,setDuration]=useState("90");
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const [copied,setCopied]=useState(false);
 const db=supabase as any;
 const activeMessagingOrganizationIds=useMemo(()=>new Set(consents.filter(x=>x.status==="active"&&(!x.expires_at||new Date(x.expires_at).getTime()>Date.now())&&x.consent_scopes.includes("identity_summary")&&x.consent_scopes.includes("institutional_messaging")).map(x=>x.organization_id)),[consents]);
 const availableOrganizations=organizations.filter(x=>!activeMessagingOrganizationIds.has(x.id));

 async function refresh(){
  if(!db){setError("اتصال پایگاه داده در دسترس نیست.");setLoading(false);return;}
  setError("");
  const [identityResult,organizationResult,consentResult]=await Promise.all([
   db.rpc("ensure_my_sarina_farmer_identifier"),
   db.from("organizations").select("id,display_name,organization_type").eq("status","verified").in("organization_type",organizationTypes).order("display_name"),
   db.from("farmer_authority_consents").select("id,organization_id,consent_scopes,purpose_code,status,granted_at,expires_at,revoked_at,created_at").eq("user_id",userId).order("created_at",{ascending:false})
  ]);
  if(identityResult.error){setError(identityResult.error.message||"دریافت شناسه یکتا انجام نشد.");}
  else setCode(typeof identityResult.data==="string"?identityResult.data:String(identityResult.data??""));
  if(organizationResult.error) setMessage("فهرست مراجع تأییدشده فعلاً دریافت نشد.");
  else setOrganizations((organizationResult.data??[]) as Organization[]);
  if(consentResult.error) setMessage("سوابق رضایت‌نامه فعلاً دریافت نشد.");
  else setConsents((consentResult.data??[]) as Consent[]);
  setLoading(false);
 }

 useEffect(()=>{let active=true;(async()=>{try{await refresh();}catch(e){if(active)setError(e instanceof Error?e.message:"خطا در دریافت اطلاعات شناسه.");}finally{if(active)setLoading(false);}})();return()=>{active=false;};},[userId]);

 async function grantConsent(){
  if(!db||!organizationId||!selectedScopes.length)return;
  setSaving(true);setMessage("");setError("");
  const expiresAt=new Date(Date.now()+Number(duration)*24*60*60*1000).toISOString();
  const {error:insertError}=await db.from("farmer_authority_consents").insert({
   user_id:userId,organization_id:organizationId,granted_by_user_id:userId,
   consent_scopes:selectedScopes,purpose_code:"jihad_farmer_support_oversight",
   consent_version:"2026-11-22-v1",status:"active",expires_at:expiresAt
  });
  if(insertError){setError(insertError.message||"ثبت رضایت انجام نشد.");setSaving(false);return;}
  setMessage("رضایت شما برای مرجع انتخاب‌شده ثبت شد. هر زمان بخواهید می‌توانید آن را لغو کنید.");
  setOrganizationId("");setSelectedScopes(["identity_summary"]);
  await refresh();setSaving(false);
 }

 async function revokeConsent(id:string){
  if(!db)return;
  setSaving(true);setMessage("");setError("");
  const {data,error:revokeError}=await db.rpc("revoke_my_farmer_authority_consent",{p_consent_id:id});
  if(revokeError||data!==true){setError(revokeError?.message||"لغو رضایت انجام نشد.");setSaving(false);return;}
  setMessage("دسترسی آینده این مرجع لغو شد؛ سابقه رضایت برای ممیزی حفظ می‌شود.");
  await refresh();setSaving(false);
 }

 async function copyCode(){
  if(!code)return;
  try{await navigator.clipboard.writeText(code);setCopied(true);setMessage("کد یکتا کپی شد.");}
  catch{setMessage("کپی خودکار در این مرورگر در دسترس نیست؛ کد را انتخاب و کپی کنید.");}
 }

 return <section className="farmer-identity-card" dir="rtl">
  <style>{`
   .farmer-identity-card{display:grid;gap:15px;margin:16px 0;padding:17px;border:1px solid #dce9dc;border-radius:17px;background:linear-gradient(130deg,#f5faf4,#fffdf6);color:#254632}
   .fic-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
   .fic-kicker{display:flex;align-items:center;gap:7px;color:#57805d;font-size:10px;font-weight:800;letter-spacing:.03em}
   .fic-head h3{margin:7px 0 4px;font-size:16px;color:#244b32}
   .fic-head p,.fic-muted{margin:0;color:#738176;font-size:11px;line-height:1.9}
   .fic-code{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 15px;border:1px dashed #a9c7a9;border-radius:13px;background:#fff}
   .fic-code strong{font:800 20px ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.06em;color:#285d38;direction:ltr}
   .fic-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid #d5e3d4;border-radius:10px;background:#fff;color:#365d40;padding:8px 11px;font:inherit;font-size:11px;cursor:pointer}
   .fic-button.primary{background:#2f6840;border-color:#2f6840;color:#fff}
   .fic-button:disabled{opacity:.5;cursor:not-allowed}
   .fic-note{padding:10px 12px;border-radius:11px;background:#edf5ec;color:#55705a;font-size:10px;line-height:1.9}
   .fic-consent{display:grid;gap:11px;border-top:1px solid #e1eade;padding-top:14px}
   .fic-consent h4{margin:0;font-size:13px;color:#31583b}
   .fic-form{display:grid;grid-template-columns:minmax(0,1fr) 150px;gap:9px}
   .fic-form select{min-width:0;border:1px solid #dce6da;border-radius:10px;background:#fff;padding:9px;color:#405b47;font:inherit;font-size:11px}
   .fic-scopes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
   .fic-scope{display:flex;gap:8px;align-items:flex-start;border:1px solid #e3eae0;background:#fff;border-radius:11px;padding:9px;font-size:10px;line-height:1.7}
   .fic-scope input{margin-top:3px;accent-color:#367346}
   .fic-scope small{display:block;color:#859087;font-size:9px}
   .fic-consent-list{display:grid;gap:8px}
   .fic-consent-row{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #e4ebe1;background:#fff;border-radius:11px;padding:10px}
   .fic-consent-row b{display:block;font-size:11px}
   .fic-consent-row small{display:block;color:#7b887e;font-size:9px;margin-top:4px;line-height:1.7}
   .fic-status{display:inline-flex;align-items:center;gap:5px;font-size:9px;color:#478154}
   .fic-alert{padding:9px 11px;border-radius:10px;background:#fff5e9;color:#85612f;font-size:10px;line-height:1.8}
   @media(max-width:640px){.fic-form,.fic-scopes{grid-template-columns:1fr}.fic-code{align-items:flex-start;flex-direction:column}.fic-code strong{font-size:17px}.fic-head{flex-direction:column}.fic-consent-row{align-items:flex-start;flex-direction:column}}
  `}</style>
  <div className="fic-head">
   <div><span className="fic-kicker"><Landmark size={15}/> شناسه و حریم خصوصی کشاورز</span><h3>شناسه یکتای من در SARINA</h3><p>برای شناسایی پرونده شما در ارتباط با جهاد کشاورزی و سایر مراجع مجاز.</p></div>
   <ShieldCheck size={24} color="#4e8057"/>
  </div>
  {loading?<p className="fic-muted">در حال آماده‌سازی شناسه و دریافت رضایت‌نامه‌ها…</p>:code?<div className="fic-code"><strong>{code}</strong><button className="fic-button" type="button" onClick={()=>void copyCode()}><Clipboard size={14}/>{copied?"کپی شد":"کپی شناسه"}</button></div>:<div className="fic-alert">شناسه یکتا دریافت نشد. {error||"وضعیت حساب یا ارتباط پایگاه داده را بررسی کنید."}</div>}
  <div className="fic-note">این کد فقط شناسه جست‌وجوی پرونده است؛ رمز عبور، شماره ملی یا شناسه رسمی جهاد کشاورزی نیست. داشتن کد به‌تنهایی هیچ دسترسی‌ای ایجاد نمی‌کند.</div>
  {message&&<div className="fic-note">{message}</div>}
  {error&&code&&<div className="fic-alert">{error}</div>}
  <div className="fic-consent">
   <div><h4>مدیریت دسترسی مراجع سازمانی</h4><p className="fic-muted">فقط مرجع تأییدشده‌ای که خودتان انتخاب می‌کنید، آن هم در محدوده اطلاعاتی که مشخص می‌کنید و برای مدت تعیین‌شده، امکان مشاهده خواهد داشت.</p></div>
   {availableOrganizations.length>0?<>
    <div className="fic-form">
     <select value={organizationId} onChange={e=>setOrganizationId(e.target.value)}><option value="">انتخاب مرجع سازمانی تأییدشده</option>{availableOrganizations.map(o=><option key={o.id} value={o.id}>{o.display_name}</option>)}</select>
     <select value={duration} onChange={e=>setDuration(e.target.value)}><option value="30">۳۰ روز</option><option value="90">۹۰ روز</option><option value="180">۱۸۰ روز</option></select>
    </div>
    <div className="fic-scopes">{scopeOptions.map(s=><label className="fic-scope" key={s.value}><input type="checkbox" checked={selectedScopes.includes(s.value)} onChange={e=>setSelectedScopes(old=>e.target.checked?[...old,s.value]:old.filter(x=>x!==s.value))}/><span><b>{s.label}</b><small>{s.detail}</small></span></label>)}</div>
    <button className="fic-button primary" type="button" disabled={saving||!organizationId||!selectedScopes.length} onClick={()=>void grantConsent()}>{saving?"در حال ثبت…":"ثبت رضایت انتخاب‌شده"}</button>
   </>:<div className="fic-alert">هنوز مرجع دولتی یا حمایتی تأییدشده‌ای برای اعطای دسترسی در SARINA ثبت نشده است. پس از ثبت و تأیید سازمان جهاد کشاورزی، نام آن در این بخش ظاهر می‌شود.</div>}
   {consents.length>0&&<div className="fic-consent-list"><b className="fic-muted">سوابق دسترسی</b>{consents.map(c=>{const org=organizations.find(o=>o.id===c.organization_id);const active=c.status==="active"&&(!c.expires_at||new Date(c.expires_at).getTime()>Date.now());return <div className="fic-consent-row" key={c.id}><div><b>{org?.display_name||"مرجع سازمانی"}</b><small>{c.consent_scopes.map(s=>scopeOptions.find(x=>x.value===s)?.label||s).join("، ")}<br/>ثبت: {faDate(c.granted_at)} · انقضا: {faDate(c.expires_at)}</small><span className="fic-status"><CheckCircle2 size={12}/>{active?"فعال":c.status==="revoked"?"لغوشده":"منقضی یا غیرفعال"}</span></div>{c.status==="active"&&<button className="fic-button" type="button" disabled={saving} onClick={()=>void revokeConsent(c.id)}><Trash2 size={13}/>{active?"لغو دسترسی":"بستن رضایت منقضی"}</button>}</div>;})}</div>}
  </div>
 </section>;
}
