import {useCallback,useEffect,useMemo,useState} from "react";
import {AlertCircle,CheckCircle2,Clock3,Download,FileText,Landmark,RefreshCw,ShieldCheck} from "lucide-react";
import {supabase} from "../lib/supabase";

type RequestRow={
 id:string;organization_legal_name:string;organization_display_name:string;organization_type:string;
 registration_or_authority_reference:string|null;province_name:string;county_name:string;service_hub_name:string;
 country_name:string;requested_service_locations:string[];mandate_reference:string|null;applicant_contact_name:string;
 applicant_contact_email:string|null;applicant_contact_phone:string|null;proposed_admin_full_name:string;
 proposed_admin_email:string;proposed_admin_phone:string|null;service_scope_description:string;
 evidence_document_paths:string[];status:string;review_notes:string|null;reviewed_at:string|null;created_at:string;
};
type EventRow={id:string;from_status:string|null;to_status:string;review_notes:string|null;actor_user_id:string|null;occurred_at:string};
const labels:Record<string,string>={pending_verification:"در انتظار احراز مدارک",under_review:"در حال بررسی",needs_correction:"نیازمند اصلاح",approved:"تأیید شده",rejected:"رد شده",withdrawn:"مختومه"};
const types:Record<string,string>={government:"سازمان دولتی",regulator:"نهاد ناظر",support_agency:"نهاد حمایتی",public_institution:"مؤسسه عمومی"};
const date=(v:string)=>new Date(v).toLocaleString("fa-IR",{dateStyle:"medium",timeStyle:"short"});
export default function InstitutionalVerificationDesk(){
 const db=supabase as any;
 const [rows,setRows]=useState<RequestRow[]>([]),[selected,setSelected]=useState<RequestRow|null>(null);
 const [events,setEvents]=useState<EventRow[]>([]),[notes,setNotes]=useState(""),[filter,setFilter]=useState("open");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const reload=useCallback(async()=>{
  if(!db)return;setLoading(true);setError("");
  const {data,error}=await db.from("authority_onboarding_requests").select("*").order("created_at",{ascending:false}).limit(200);
  if(error){setError("دریافت پرونده‌های احراز سازمانی ناموفق بود: "+error.message);setRows([]);setSelected(null);}
  else {const list=(data??[]) as RequestRow[];setRows(list);setSelected(old=>old?list.find(x=>x.id===old.id)??null:list[0]??null);}
  setLoading(false);
 },[]);
 useEffect(()=>{void reload();},[reload]);
 useEffect(()=>{let live=true;(async()=>{if(!db||!selected){setEvents([]);return;}
  const {data,error}=await db.from("authority_onboarding_request_events").select("id,from_status,to_status,review_notes,actor_user_id,occurred_at").eq("request_id",selected.id).order("occurred_at",{ascending:false}).limit(50);
  if(live){if(error)setError("تاریخچه بررسی در دسترس نیست: "+error.message);else setEvents((data??[]) as EventRow[]);}
 })();return()=>{live=false;};},[selected?.id]);
 const visible=useMemo(()=>rows.filter(r=>filter==="all"||(filter==="open"?["pending_verification","under_review","needs_correction"].includes(r.status):r.status===filter)),[rows,filter]);
 async function openEvidence(path:string){
  if(!supabase)return;const {data,error}=await supabase.storage.from("authority-onboarding-documents").createSignedUrl(path,120);
  if(error||!data?.signedUrl){setError("دریافت لینک امن مدرک انجام نشد: "+(error?.message??"خطای نامشخص"));return;}
  window.open(data.signedUrl,"_blank","noopener,noreferrer");
 }
 async function review(status:"under_review"|"needs_correction"|"approved"|"rejected"){
  if(!db||!selected)return;
  if(["needs_correction","rejected"].includes(status)&&!notes.trim()){setError("برای درخواست اصلاح یا رد پرونده، درج توضیح الزامی است.");return;}
  setBusy(true);setError("");setMessage("");
  const {data,error}=await db.rpc("review_authority_onboarding_request",{p_request_id:selected.id,p_new_status:status,p_review_notes:notes.trim()||null});
  if(error){setError(error.message.includes("proposed_admin_account_not_verified")?"ایمیل مدیر پیشنهادی هنوز با حساب فعال و احرازشده سارینا تطبیق ندارد؛ تا زمان تطبیق امکان تأیید وجود ندارد.":error.message.includes("review_notes_required")?"برای این تصمیم درج یادداشت الزامی است.": "ثبت تصمیم بررسی انجام نشد: "+error.message);}
  else {setMessage(status==="approved"?"درخواست احراز سازمان تأیید شد؛ ایجاد سازمان، عضویت و محدوده دسترسی همچنان مرحله‌ای مستقل است.":"تصمیم بررسی ثبت و در تاریخچه ممیزی ذخیره شد.");setNotes("");await reload();}
  setBusy(false);
 }
 return <section className="institutional-desk" dir="rtl">
  <style>{`.institutional-desk{display:grid;gap:16px}.iv-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.iv-head h1{font-size:24px;margin:5px 0}.iv-head p{font-size:12px;color:#738276;margin:0;line-height:1.8}.iv-kicker{font-size:10px;color:#56805d;font-weight:800;display:flex;align-items:center;gap:7px}.iv-layout{display:grid;grid-template-columns:minmax(280px,.85fr) minmax(0,1.5fr);gap:14px}.iv-panel{border:1px solid #e1e9df;background:#fff;border-radius:15px;padding:15px;min-width:0}.iv-toolbar{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0}.iv-toolbar button,.iv-action{border:1px solid #dce7da;background:#f7faf6;color:#365b3d;border-radius:9px;padding:8px 11px;font:inherit;font-size:11px;cursor:pointer}.iv-toolbar button.active{background:#e5f0e3;border-color:#a9c8a5}.iv-list{display:grid;gap:8px;max-height:680px;overflow:auto}.iv-row{display:grid;gap:5px;text-align:right;border:1px solid #e7ece5;border-radius:11px;padding:11px;background:white;cursor:pointer;color:#294a34;font:inherit}.iv-row.selected{border-color:#6c9a70;background:#f5faf3}.iv-row b{font-size:12px}.iv-row small{font-size:10px;color:#7b887d}.iv-pill{font-size:10px;font-weight:800;color:#58734f;background:#eef4e9;padding:5px 8px;border-radius:20px;width:max-content}.iv-detail{display:grid;gap:13px}.iv-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.iv-field{background:#f8faf7;border:1px solid #edf1eb;border-radius:10px;padding:10px;min-width:0}.iv-field small{display:block;color:#819084;font-size:10px;margin-bottom:5px}.iv-field b{font-size:12px;overflow-wrap:anywhere}.iv-wide{grid-column:1/-1}.iv-actions{display:flex;flex-wrap:wrap;gap:8px}.iv-action.primary{background:#2f6940;color:white;border-color:#2f6940}.iv-action.danger{color:#9a493e;border-color:#e9c9c3;background:#fff8f6}.iv-action:disabled{opacity:.5;cursor:not-allowed}.iv-files,.iv-events{display:grid;gap:7px}.iv-file{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px;border:1px solid #edf1eb;border-radius:9px;font-size:11px}.iv-file button{border:0;background:transparent;color:#426e49;cursor:pointer;font:inherit}.iv-event{border-right:2px solid #b8cfb3;padding:2px 10px 9px 0;display:grid;gap:4px}.iv-event small{color:#849087;font-size:10px}.iv-note{width:100%;min-height:72px;border:1px solid #dce7da;border-radius:10px;padding:10px;font:inherit;font-size:12px;box-sizing:border-box}.iv-alert{background:#fff1ed;color:#934c3f;padding:10px;border-radius:9px;font-size:11px}.iv-success{background:#edf7ed;color:#3d7046;padding:10px;border-radius:9px;font-size:11px}.iv-empty{padding:24px;text-align:center;color:#879287;font-size:12px}@media(max-width:760px){.iv-layout{grid-template-columns:1fr}.iv-list{max-height:300px}.iv-grid{grid-template-columns:1fr}.iv-wide{grid-column:auto}.iv-head{flex-direction:column}}`}</style>
  <header className="iv-head"><div><span className="iv-kicker"><Landmark size={16}/> SARINA · مدیریت مرکزی نهادها</span><h1>میز احراز و تأیید سازمان‌ها</h1><p>بررسی مستقل هویت حقوقی، مدارک، نماینده مجاز و حوزه مأموریت سازمان‌ها در کشورهای مختلف.</p></div><button className="iv-action" onClick={()=>void reload()} disabled={loading}><RefreshCw size={14}/> تازه‌سازی</button></header>
  <div className="iv-panel"><div className="iv-kicker"><ShieldCheck size={15}/> اصل تفکیک دسترسی</div><p style={{fontSize:11,lineHeight:1.9,color:"#637568",margin:"7px 0 0"}}>تأیید یک سازمان به‌تنهایی برای نمایش آن به کشاورزان کافی نیست. نمایش خدمات در کارتابل کشاورز به محدوده جغرافیایی ثبت‌شده مزرعه و محدوده دسترسی معتبر سازمان وابسته است. تأیید این پرونده نیز به‌صورت خودکار حساب مدیر، عضویت، قابلیت‌ها یا دسترسی به اطلاعات کشاورزان ایجاد نمی‌کند.</p></div>
  {error&&<div className="iv-alert"><AlertCircle size={14} style={{verticalAlign:"middle",marginLeft:5}}/>{error}</div>}{message&&<div className="iv-success"><CheckCircle2 size={14} style={{verticalAlign:"middle",marginLeft:5}}/>{message}</div>}
  <div className="iv-layout">
   <aside className="iv-panel"><b style={{fontSize:13}}>درخواست‌های احراز ({rows.length.toLocaleString("fa-IR")})</b><div className="iv-toolbar">{[["open","باز"],["all","همه"],["approved","تأییدشده"],["rejected","ردشده"]].map(([v,l])=><button key={v} className={filter===v?"active":""} onClick={()=>setFilter(v)}>{l}</button>)}</div>
    {loading?<div className="iv-empty">در حال دریافت پرونده‌ها…</div>:visible.length===0?<div className="iv-empty">درخواستی در این دسته وجود ندارد.</div>:<div className="iv-list">{visible.map(r=><button key={r.id} className={"iv-row"+(selected?.id===r.id?" selected":"")} onClick={()=>{setSelected(r);setNotes(r.review_notes??"");setMessage("");setError("");}}><b>{r.organization_display_name}</b><small>{r.organization_legal_name}</small><span className="iv-pill">{labels[r.status]??r.status}</span><small>{r.country_name} · {r.province_name} · {r.county_name} · {date(r.created_at)}</small></button>)}</div>}
   </aside>
   <article className="iv-panel">
    {!selected?<div className="iv-empty">برای مشاهده جزئیات، یک درخواست را انتخاب کنید.</div>:<div className="iv-detail">
     <div><span className="iv-kicker"><FileText size={14}/> پرونده احراز سازمانی</span><h2 style={{fontSize:18,margin:"7px 0"}}>{selected.organization_display_name}</h2><span className="iv-pill">{labels[selected.status]??selected.status}</span></div>
     <div className="iv-grid">
      <div className="iv-field"><small>نام حقوقی</small><b>{selected.organization_legal_name}</b></div><div className="iv-field"><small>نوع نهاد</small><b>{types[selected.organization_type]??selected.organization_type}</b></div>
      <div className="iv-field"><small>کشور</small><b>{selected.country_name}</b></div><div className="iv-field"><small>استان / ایالت</small><b>{selected.province_name||"—"}</b></div><div className="iv-field"><small>شهرستان / ناحیه</small><b>{selected.county_name||"—"}</b></div><div className="iv-field"><small>مرکز خدمات</small><b>{selected.service_hub_name||"—"}</b></div><div className="iv-field"><small>شماره ثبت / شناسه</small><b>{selected.registration_or_authority_reference||"ارائه نشده"}</b></div><div className="iv-field"><small>مرجع مأموریت</small><b>{selected.mandate_reference||"ارائه نشده"}</b></div>
      <div className="iv-field"><small>متقاضی</small><b>{selected.applicant_contact_name} · {selected.applicant_contact_email||"بدون ایمیل"}</b></div><div className="iv-field"><small>تلفن متقاضی</small><b>{selected.applicant_contact_phone||"ارائه نشده"}</b></div>
      <div className="iv-field"><small>مدیر پیشنهادی</small><b>{selected.proposed_admin_full_name}</b></div><div className="iv-field"><small>ایمیل حساب مدیر پیشنهادی</small><b dir="ltr">{selected.proposed_admin_email}</b></div>
      <div className="iv-field"><small>تلفن مدیر پیشنهادی</small><b>{selected.proposed_admin_phone||"ارائه نشده"}</b></div><div className="iv-field"><small>محدوده درخواستی</small><b>{selected.requested_service_locations?.join("، ")||"—"}</b></div>
      <div className="iv-field iv-wide"><small>شرح مأموریت و خدمات</small><b style={{fontWeight:500,lineHeight:1.9}}>{selected.service_scope_description}</b></div>
     </div>
     <div><b style={{fontSize:12}}>مدارک اثباتی (دسترسی موقت و امن)</b><div className="iv-files" style={{marginTop:7}}>{(selected.evidence_document_paths??[]).map(path=><div className="iv-file" key={path}><span dir="auto">{path.split("/").slice(-1)[0]}</span><button onClick={()=>void openEvidence(path)}><Download size={14}/> دریافت امن</button></div>)}{!selected.evidence_document_paths?.length&&<small>مدرکی ثبت نشده است.</small>}</div></div>
     <div><b style={{fontSize:12}}>یادداشت تصمیم بررسی</b><textarea className="iv-note" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="نتیجه بررسی، نواقص یا مستندات تکمیلی..."/></div>
     <div className="iv-actions">
      <button className="iv-action" disabled={busy} onClick={()=>void review("under_review")}><Clock3 size={14}/> شروع / ادامه بررسی</button>
      <button className="iv-action" disabled={busy||!notes.trim()} onClick={()=>void review("needs_correction")}>درخواست اصلاح</button>
      <button className="iv-action primary" disabled={busy} onClick={()=>void review("approved")}>تأیید احراز هویت</button>
      <button className="iv-action danger" disabled={busy||!notes.trim()} onClick={()=>void review("rejected")}>رد درخواست</button>
     </div>
     <div><b style={{fontSize:12}}>تاریخچه ممیزی و تصمیم‌ها</b><div className="iv-events" style={{marginTop:8}}>{events.length?events.map(ev=><div className="iv-event" key={ev.id}><b style={{fontSize:11}}>{labels[ev.to_status]??ev.to_status}</b><small>{date(ev.occurred_at)} · شناسه بررسی‌کننده: {ev.actor_user_id??"سیستم ثبت درخواست"}</small>{ev.review_notes&&<span style={{fontSize:11,lineHeight:1.8}}>{ev.review_notes}</span>}</div>):<small>رویدادی برای نمایش ثبت نشده است.</small>}</div></div>
     <small style={{color:"#879287",fontSize:10,lineHeight:1.8}}>ثبت «تأیید احراز» فقط وضعیت پرونده را تأیید می‌کند. ایجاد سازمان، تطبیق و تخصیص مدیر، عضویت، قابلیت‌ها و محدوده جغرافیایی در مراحل جداگانه و با کنترل مدیر مرکزی انجام می‌شوند.</small>
    </div>}
   </article>
  </div>
 </section>;
}
