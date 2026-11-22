import {useEffect,useMemo,useState} from "react";
import type {FormEvent} from "react";
import type {Session} from "@supabase/supabase-js";
import {AlertCircle,CheckCircle2,Landmark,Search,ShieldCheck} from "lucide-react";
import {supabase} from "../lib/supabase";

type AuthorityOrg={id:string;display_name:string;legal_name:string;organization_type:string};
type FarmerResult={farmer_code:string;farmer_name:string|null;country_id:string|null;visible_farm_count:number;administrative_regions:string[];consent_scopes:string[];consent_expires_at:string|null};
const authorityTypes=["government","regulator","support_agency","public_institution"];
const labels:Record<string,string>={identity_summary:"شناسه و مشخصات مختصر",farm_summary:"خلاصه مزارع و محدوده فعالیت",assigned_specialist:"متخصص مسئول",institutional_support_history:"سوابق حمایت سازمانی",productivity_metrics:"شاخص‌های بهره‌وری",outcome_summary:"نتایج و ارزیابی",directive_delivery:"دستورالعمل و پیگیری اجرا"};
export default function JihadAuthorityWorkspace({session}:{session:Session}){
 const db=supabase as any;
 const [loading,setLoading]=useState(true),[orgs,setOrgs]=useState<AuthorityOrg[]>([]),[orgId,setOrgId]=useState("");
 const [code,setCode]=useState(""),[result,setResult]=useState<FarmerResult|null>(null),[searched,setSearched]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const selected=useMemo(()=>orgs.find(x=>x.id===orgId)??null,[orgs,orgId]);
 useEffect(()=>{let active=true;(async()=>{
  if(!supabase){if(active)setLoading(false);return;}
  try{
   const {data:userId,error:userError}=await db.rpc("current_sarina_user_id");
   if(userError||!userId)throw new Error("شناسه کاربر سازمانی دریافت نشد.");
   const {data:members,error:memberError}=await db.from("organization_members").select("organization_id").eq("user_id",userId).eq("status","active");
   if(memberError)throw memberError;
   const ids=[...new Set((members??[]).map((x:any)=>x.organization_id).filter(Boolean))];
   if(!ids.length){if(active)setOrgs([]);return;}
   const {data:organizations,error:orgError}=await db.from("organizations").select("id,display_name,legal_name,organization_type").in("id",ids).eq("status","verified").in("organization_type",authorityTypes).order("display_name");
   if(orgError)throw orgError;
   if(active){setOrgs((organizations??[]) as AuthorityOrg[]);if(organizations?.length)setOrgId(organizations[0].id);}
  }catch(e){if(active)setError(e instanceof Error?e.message:"دریافت دسترسی سازمانی ممکن نشد.");}
  finally{if(active)setLoading(false);}
 })();return()=>{active=false;};},[session.user.id]);
 async function lookup(e:FormEvent){
  e.preventDefault();if(!supabase||!orgId||!code.trim())return;
  setBusy(true);setError("");setResult(null);setSearched(false);
  const {data,error:rpcError}=await db.rpc("lookup_farmer_by_public_code",{p_organization_id:orgId,p_public_code:code.trim().toUpperCase()});
  setBusy(false);setSearched(true);
  if(rpcError){setError("دسترسی یا جست‌وجو تأیید نشد. عضویت، قابلیت، محدوده مأموریت و رضایت فعال کشاورز باید بررسی شود.");return;}
  const row=Array.isArray(data)?data[0]:data;
  if(!row){setError("پرونده‌ای با این کد در محدوده مجاز پیدا نشد؛ ممکن است کد نامعتبر باشد یا رضایت/محدوده دسترسی فعال نباشد.");return;}
  setResult(row as FarmerResult);
 }
 if(loading)return <div className="jihad-authority-card" dir="rtl"><p>در حال بررسی عضویت سازمانی...</p></div>;
 if(!orgs.length)return null;
 return <section className="jihad-authority-card" dir="rtl">
  <style>{`.jihad-authority-card{margin:18px 0;padding:20px;border:1px solid #d8e6d8;border-radius:18px;background:#f7faf6;color:#284b34;display:grid;gap:15px}.jaw-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.jaw-head h2{font-size:18px;margin:6px 0}.jaw-head p,.jaw-muted{font-size:12px;color:#6d7f70;line-height:1.9;margin:0}.jaw-kicker{display:flex;align-items:center;gap:7px;color:#527a59;font-size:10px;font-weight:800}.jaw-orgrow{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,1fr);gap:10px}.jaw-orgrow label,.jaw-search label{display:grid;gap:6px;font-size:11px;font-weight:700}.jaw-orgrow select,.jaw-search input{width:100%;border:1px solid #d6e2d5;border-radius:10px;background:#fff;padding:11px;color:#294b34;font:inherit;font-size:12px}.jaw-search{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;align-items:end}.jaw-search button{border:0;border-radius:10px;background:#2e6940;color:white;padding:12px 16px;font:inherit;font-size:12px;font-weight:700;display:flex;gap:8px;align-items:center;cursor:pointer}.jaw-search button:disabled{opacity:.5;cursor:not-allowed}.jaw-alert{padding:11px 13px;border-radius:11px;background:#fff5e8;color:#805e2b;font-size:11px;line-height:1.8}.jaw-result{border:1px solid #dce8da;background:white;border-radius:13px;padding:14px;display:grid;gap:11px}.jaw-code{font:800 17px ui-monospace,monospace;direction:ltr;color:#28603a}.jaw-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.jaw-item{background:#f5f8f4;border-radius:10px;padding:10px}.jaw-item small{display:block;color:#758276;font-size:10px}.jaw-item b{display:block;margin-top:5px;font-size:12px}.jaw-scopes{display:flex;flex-wrap:wrap;gap:6px}.jaw-scope{background:#edf5ed;color:#426b49;border-radius:30px;padding:5px 9px;font-size:10px}.jaw-foot{font-size:10px;color:#7b887d;line-height:1.8}.jaw-empty{padding:12px;border:1px dashed #cbdacb;border-radius:11px;color:#728273;font-size:11px;line-height:1.9}@media(max-width:640px){.jaw-head{flex-direction:column}.jaw-orgrow,.jaw-search,.jaw-grid{grid-template-columns:1fr}}`}</style>
  <div className="jaw-head"><div><span className="jaw-kicker"><Landmark size={16}/> SARINA · سازمان جهاد کشاورزی</span><h2>کارتابل مجاز سازمانی</h2><p>جست‌وجوی پرونده فقط با عضویت فعال، قابلیت مجاز، محدوده مأموریت و رضایت معتبر کشاورز انجام می‌شود.</p></div><ShieldCheck size={25}/></div>
  <div className="jaw-orgrow"><label>سازمان فعال<select value={orgId} onChange={e=>{setOrgId(e.target.value);setResult(null);setSearched(false);}}>{orgs.map(o=><option key={o.id} value={o.id}>{o.display_name}</option>)}</select></label><div className="jaw-empty"><b>{selected?.legal_name}</b><br/>سازمان تأییدشده · دسترسی‌ها در سمت سرور کنترل می‌شوند.</div></div>
  <form className="jaw-search" onSubmit={lookup}><label>کد یکتای SARINA کشاورز<input value={code} onChange={e=>setCode(e.target.value)} placeholder="SRN-XXXX-XXXX-XXXX-XXXX" autoComplete="off" spellCheck={false}/></label><button type="submit" disabled={busy||!orgId||!code.trim()}><Search size={16}/>{busy?"در حال بررسی...":"جست‌وجوی مجاز"}</button></form>
  {error&&<div className="jaw-alert"><AlertCircle size={15} style={{verticalAlign:"middle",marginLeft:6}}/>{error}</div>}
  {result&&<div className="jaw-result"><div className="jaw-code">{result.farmer_code}</div><div className="jaw-grid"><div className="jaw-item"><small>کشاورز</small><b>{result.farmer_name||"نام در دسترس نیست"}</b></div><div className="jaw-item"><small>تعداد مزارع قابل مشاهده</small><b>{result.consent_scopes.includes("farm_summary")?Number(result.visible_farm_count).toLocaleString("fa-IR"):"با رضایت جداگانه قابل مشاهده است"}</b></div><div className="jaw-item"><small>محدوده‌های اداری قابل مشاهده</small><b>{result.administrative_regions?.length?result.administrative_regions.join("، "):"در محدوده رضایت و دسترسی موجود نیست"}</b></div><div className="jaw-item"><small>اعتبار رضایت</small><b>{result.consent_expires_at?new Date(result.consent_expires_at).toLocaleDateString("fa-IR"):"بدون تاریخ انقضا"}</b></div></div><div><small className="jaw-muted">دامنه‌های مجاز اشتراک‌گذاری</small><div className="jaw-scopes">{(result.consent_scopes??[]).map(s=><span className="jaw-scope" key={s}>{labels[s]??s}</span>)}</div></div><div className="jaw-foot"><CheckCircle2 size={13} style={{verticalAlign:"middle",marginLeft:5}}/>این پاسخ از RPC محدودشده پایگاه داده دریافت شده و رویداد دسترسی در دفتر ممیزی ثبت می‌شود. اطلاعات متخصص، حمایت و بهره‌وری تا تکمیل سرویس جزئیات پرونده، در این صفحه ادعا یا نمایش داده نمی‌شود.</div></div>}
  {searched&&!result&&!error&&<div className="jaw-empty">برای این کد نتیجه‌ای در محدوده مجاز وجود ندارد.</div>}
  <div className="jaw-foot">جست‌وجو به معنی دسترسی نامحدود نیست. لغو یا انقضای رضایت کشاورز فوراً مانع دسترسی‌های بعدی می‌شود.</div>
 </section>;
}
