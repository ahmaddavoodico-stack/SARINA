import {useEffect,useMemo,useState} from "react";
import {CalendarClock,ClipboardCheck,RefreshCw,ShieldCheck,Users} from "lucide-react";
import {supabase} from "../lib/supabase";
import ExpertRecommendationComposer from "./ExpertRecommendationComposer";

type Props={profileId:string;verified:boolean};
type CaseRow={id:string;requester_user_id:string;farm_id:string|null;subject:string;problem_description:string;priority:string;status:string;created_at:string};
type AssistantRow={request_id:string;assistant_status:string;completeness_status:string;missing_information:string[];assistant_summary:string|null;received_at:string};
type ExpertRow={id:string;public_name:string};
type Availability={availability_status:string;pause_new_cases:boolean;vacation_start:string|null;vacation_end:string|null;substitute_expert_profile_id:string|null;max_open_cases:number;status_note:string|null};
type PreparationResult={preparation_status:string;model_invoked:boolean;draft?:Record<string,string[]>;evidence_packet?:{evidence?:{id:string;label:string;value:string;provenance:string}[];coverage?:{missingDomains?:string[]}}};
const db=supabase as any;
const statusLabels:Record<string,string>={received:"دریافت‌شده",initial_review:"در بررسی اولیه",needs_information:"نیازمند اطلاعات تکمیلی",awaiting_expert:"در انتظار نظر متخصص",expert_reviewed:"بررسی متخصص انجام شد"};
const dateTime=(value:string|null)=>value?new Date(value).toISOString().slice(0,16):"";
export default function ExpertCaseOperationsWorkspace({profileId,verified}:Props){
 const [cases,setCases]=useState<CaseRow[]>([]),[assistant,setAssistant]=useState<Record<string,AssistantRow>>({}),[experts,setExperts]=useState<ExpertRow[]>([]);
 const [availability,setAvailability]=useState<Availability>({availability_status:"available",pause_new_cases:false,vacation_start:null,vacation_end:null,substitute_expert_profile_id:null,max_open_cases:10,status_note:""});
 const [vacationStart,setVacationStart]=useState(""),[vacationEnd,setVacationEnd]=useState("");
 const [selectedCase,setSelectedCase]=useState(""),[replacement,setReplacement]=useState(""),[handoverReason,setHandoverReason]=useState("مرخصی یا عدم امکان پاسخ‌گویی متخصص فعلی");
 const [drafts,setDrafts]=useState<Record<string,{status:string;summary:string;missing:string}>>({});
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 const [aiPreparations,setAiPreparations]=useState<Record<string,PreparationResult>>({});
 const [preparingCase,setPreparingCase]=useState("");
 async function refresh(){
  if(!supabase)return;setLoading(true);
  const [a,e]=await Promise.all([
   db.from("expert_availability").select("*").eq("expert_profile_id",profileId).maybeSingle(),
   db.from("expert_profiles").select("id,public_name").eq("verification_status","verified").in("profile_visibility",["directory","public"]).neq("id",profileId).order("public_name")
  ]);
  if(a.error)setNotice(a.error.message);
  if(a.data){setAvailability(a.data);setVacationStart(dateTime(a.data.vacation_start));setVacationEnd(dateTime(a.data.vacation_end));}
  setExperts(e.data||[]);
  const q=await db.from("expert_requests").select("id,requester_user_id,farm_id,subject,problem_description,priority,status,created_at").eq("assigned_expert_profile_id",profileId).in("status",["submitted","assigned","in_progress","waiting_user"]).order("created_at",{ascending:false}).limit(60);
  if(q.error)setNotice(q.error.message);
  const rows=(q.data||[]) as CaseRow[];setCases(rows);
  if(rows.length){
   const r=await db.from("expert_case_assistant_cases").select("request_id,assistant_status,completeness_status,missing_information,assistant_summary,received_at").in("request_id",rows.map(x=>x.id));
   if(r.error)setNotice(r.error.message);
   const map:Record<string,AssistantRow>={};(r.data||[]).forEach((x:AssistantRow)=>map[x.request_id]=x);setAssistant(map);
   setDrafts(old=>{const next={...old};rows.forEach(c=>{if(!next[c.id]){const x=map[c.id];next[c.id]={status:x?.assistant_status||"received",summary:x?.assistant_summary||c.problem_description,missing:(x?.missing_information||[]).join("، ")};}});return next;});
  }else{setAssistant({});}
  setLoading(false);
 }
 useEffect(()=>{void refresh();},[profileId]);
 const openCases=useMemo(()=>cases.filter(c=>!["resolved","closed","cancelled"].includes(c.status)),[cases]);
 async function saveAvailability(e:React.FormEvent){
  e.preventDefault();if(!supabase)return;setBusy(true);setNotice("");
  const payload={expert_profile_id:profileId,availability_status:availability.availability_status,pause_new_cases:availability.pause_new_cases,
   vacation_start:vacationStart?new Date(vacationStart).toISOString():null,vacation_end:vacationEnd?new Date(vacationEnd).toISOString():null,
   substitute_expert_profile_id:availability.substitute_expert_profile_id||null,max_open_cases:Number(availability.max_open_cases),
   status_note:availability.status_note||null,updated_at:new Date().toISOString()};
  const {error}=await db.from("expert_availability").upsert(payload,{onConflict:"expert_profile_id"});
  setBusy(false);if(error){setNotice(error.message);return;}setNotice("وضعیت حضور و ظرفیت پذیرش پرونده ذخیره شد.");await refresh();
 }
 async function saveCase(c:CaseRow){
  if(!supabase)return;setBusy(true);setNotice("");
  const d=drafts[c.id]||{status:"initial_review",summary:c.problem_description,missing:""};
  const missing=d.missing.split(/[،,؛;]/).map(x=>x.trim()).filter(Boolean);
  const {error}=await db.from("expert_case_assistant_cases").update({assistant_status:d.status,completeness_status:missing.length?"missing_information":"appears_complete",missing_information:missing,assistant_summary:d.summary.trim()||c.problem_description}).eq("request_id",c.id);
  setBusy(false);if(error){setNotice(error.message);return;}setNotice("یادداشت و وضعیت بررسی اولیه ثبت شد؛ کشاورز اعلان وضعیت را دریافت می‌کند.");await refresh();
 }
 async function prepareCase(c:CaseRow){
  if(!supabase)return;setPreparingCase(c.id);setNotice("");
  const {data,error}=await supabase.functions.invoke("specialist-case-preparation",{body:{request_id:c.id}});
  setPreparingCase("");
  if(error){setNotice("آماده‌سازی هوشمند انجام نشد: "+error.message);return;}
  if(!data?.ok){setNotice("آماده‌سازی هوشمند انجام نشد: "+(data?.code||"خطای نامشخص"));return;}
  setAiPreparations(old=>({...old,[c.id]:data as PreparationResult}));
  setNotice(data.model_invoked?"پیش‌نویس هوشمند آماده شد و فقط برای بازبینی متخصص نمایش داده می‌شود.":"پرونده شواهد آماده شد؛ فراخوانی مدل هنوز فعال نیست.");
 }
 async function requestHandover(e:React.FormEvent){
  e.preventDefault();if(!supabase||!selectedCase||!replacement)return;const c=cases.find(x=>x.id===selectedCase);if(!c)return;
  setBusy(true);setNotice("");
  const {error}=await db.from("expert_case_handovers").insert({request_id:c.id,requester_user_id:c.requester_user_id,from_expert_profile_id:profileId,to_expert_profile_id:replacement,status:"awaiting_farmer_consent",reason:handoverReason.trim()||null});
  setBusy(false);if(error){setNotice(error.message);return;}setNotice("درخواست جایگزینی برای تأیید کشاورز ارسال شد. تا پیش از رضایت کشاورز و پذیرش متخصص جایگزین، دسترسی پرونده تغییر نمی‌کند.");setSelectedCase("");setReplacement("");await refresh();
 }
 if(!verified)return <section className="expert-panel"><b>این ابزار پس از تأیید صلاحیت متخصص فعال می‌شود.</b></section>;
 return <section className="expert-operations" dir="rtl">
  <div className="expert-section-title"><span>هماهنگی هوشمند پرونده‌ها</span><h2>دستیار پرونده‌های متخصص</h2><p>دریافت و ثبت اولیه پرونده به‌صورت خودکار انجام می‌شود؛ ارزیابی تخصصی، تشخیص و توصیه نهایی همچنان بر عهده متخصص است.</p></div>
  {notice&&<div className="expert-alert">{notice}</div>}
  <div className="expert-operations-toolbar"><div><b>{openCases.length.toLocaleString("fa-IR")} پرونده فعال</b><small>دریافت اولیه، وضعیت بررسی و اطلاعات ناقص</small></div><button className="expert-link" onClick={()=>void refresh()}><RefreshCw size={15}/> تازه‌سازی</button></div>
  {loading?<div className="expert-empty">در حال دریافت پرونده‌ها...</div>:cases.length===0?<div className="expert-empty">در حال حاضر پرونده ارجاع‌شده فعالی ندارید. با ارجاع پرونده، دستیار به‌صورت خودکار دریافت اولیه و ثبت اعلان را انجام می‌دهد.</div>:cases.map(c=>{const d=drafts[c.id]||{status:"received",summary:c.problem_description,missing:""};const a=assistant[c.id];return <article className="expert-panel expert-case-assistant-card" key={c.id}>
   <div className="expert-operations-toolbar"><div><span className="expert-tag">{c.priority==="urgent"?"فوری":c.priority==="high"?"اولویت بالا":"عادی"}</span><h3>{c.subject}</h3><small>دریافت: {new Date(c.created_at).toLocaleString("fa-IR")}</small></div><span className="expert-tag success">{statusLabels[d.status]||d.status}</span></div>
   <div className="expert-case-source"><b>شرح ثبت‌شده کشاورز</b><p>{c.problem_description}</p></div>
   <div className="expert-form-grid">
    <label>مرحله دستیار<select value={d.status} onChange={e=>setDrafts(old=>({...old,[c.id]:{...d,status:e.target.value}}))}>{Object.entries(statusLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
    <label>اطلاعات تکمیلی موردنیاز (با ویرگول جدا کنید)<input value={d.missing} onChange={e=>setDrafts(old=>({...old,[c.id]:{...d,missing:e.target.value}}))} placeholder="مثلاً سن گیاه، EC آب، عکس برگ"/></label>
    <label className="expert-wide">خلاصه پرونده برای متخصص<textarea rows={3} value={d.summary} onChange={e=>setDrafts(old=>({...old,[c.id]:{...d,summary:e.target.value}}))}/></label>
   </div>
   {aiPreparations[c.id]&&<div className="expert-case-source" aria-live="polite">
    <b>{aiPreparations[c.id].model_invoked?"پیش‌نویس هوشمند برای بازبینی متخصص":"بسته شواهد پرونده؛ مدل هنوز فعال نیست"}</b>
    {aiPreparations[c.id].draft&&Object.entries(aiPreparations[c.id].draft||{}).filter(([key,value])=>key!=="review_required"&&Array.isArray(value)&&value.length>0).map(([key,value])=><p key={key}><strong>{key.replaceAll("_"," ")}:</strong> {(value as string[]).join("؛ ")}</p>)}
    {aiPreparations[c.id].evidence_packet?.evidence?.map(item=><p key={item.id}><strong>{item.label} ({item.provenance}):</strong> {item.value}</p>)}
    <small>این خروجی تصمیم تخصصی یا تشخیص نهایی نیست؛ صحت شواهد و هر پیشنهاد باید توسط متخصص بررسی شود.</small>
   </div>}
   <div className="expert-case-assistant-actions"><small>{a?.completeness_status==="missing_information"?"پرونده دارای اطلاعات ناقص است":a?.completeness_status==="appears_complete"?"اطلاعات اولیه ثبت شده؛ کامل بودن تخصصی تأیید نشده است":"کنترل کامل بودن هنوز انجام نشده"}</small><button className="expert-link" disabled={preparingCase===c.id||busy} onClick={()=>void prepareCase(c)}>{preparingCase===c.id?"در حال آماده‌سازی...":"تهیه پیش‌نویس هوشمند"}</button><button className="expert-primary" disabled={busy} onClick={()=>void saveCase(c)}><ClipboardCheck size={15}/> ثبت بررسی اولیه</button></div>\n   <ExpertRecommendationComposer requestId={c.id} farmId={c.farm_id} profileId={profileId}/>
  </article>;})}
  <div className="expert-section-title expert-operations-subtitle"><span>مدیریت حضور و جانشینی</span><h2>حضور، مرخصی و جایگزینی متخصص</h2><p>در زمان مرخصی، پرونده‌ها خودکار و پنهانی منتقل نمی‌شوند؛ ابتدا رضایت کشاورز و سپس پذیرش متخصص جایگزین لازم است.</p></div>
  <form className="expert-panel expert-form-grid" onSubmit={saveAvailability}>
   <label>وضعیت حضور<select value={availability.availability_status} onChange={e=>setAvailability({...availability,availability_status:e.target.value})}><option value="available">آماده دریافت پرونده</option><option value="busy">مشغول؛ ظرفیت محدود</option><option value="away">غیرقابل‌دسترس / مرخصی</option></select></label>
   <label>حداکثر پرونده فعال<input type="number" min="1" max="100" value={availability.max_open_cases} onChange={e=>setAvailability({...availability,max_open_cases:Number(e.target.value)})}/></label>
   <label>شروع مرخصی<input type="datetime-local" value={vacationStart} onChange={e=>setVacationStart(e.target.value)}/></label>
   <label>پایان مرخصی<input type="datetime-local" value={vacationEnd} onChange={e=>setVacationEnd(e.target.value)}/></label>
   <label>متخصص جایگزین پیشنهادی<select value={availability.substitute_expert_profile_id||""} onChange={e=>setAvailability({...availability,substitute_expert_profile_id:e.target.value||null})}><option value="">بدون جایگزین پیشنهادی</option>{experts.map(x=><option key={x.id} value={x.id}>{x.public_name}</option>)}</select></label>
   <label>پیام وضعیت برای کشاورزان<input value={availability.status_note||""} onChange={e=>setAvailability({...availability,status_note:e.target.value})} placeholder="مثلاً از ۲۰ تا ۲۵ آبان در مرخصی هستم"/></label>
   <label className="expert-wide expert-check-row"><input type="checkbox" checked={availability.pause_new_cases} onChange={e=>setAvailability({...availability,pause_new_cases:e.target.checked})}/> توقف ارجاع پرونده‌های جدید در این بازه</label>
   <div className="expert-wide"><button className="expert-primary" disabled={busy}><CalendarClock size={15}/> ذخیره برنامه حضور</button></div>
  </form>
  <div className="expert-section-title expert-operations-subtitle"><span>انتقال با رضایت کشاورز</span><h2>درخواست جایگزینی برای پرونده‌های باز</h2><p>متخصص جدید فقط پس از تأیید کشاورز و پذیرش ارجاع، به پرونده دسترسی پیدا می‌کند. در صورت رد، پرونده نزد متخصص فعلی می‌ماند.</p></div>
  <form className="expert-panel expert-form-grid" onSubmit={requestHandover}>
   <label>پرونده<select required value={selectedCase} onChange={e=>setSelectedCase(e.target.value)}><option value="">انتخاب پرونده</option>{cases.map(c=><option key={c.id} value={c.id}>{c.subject}</option>)}</select></label>
   <label>متخصص جایگزین<select required value={replacement} onChange={e=>setReplacement(e.target.value)}><option value="">انتخاب متخصص تأییدشده</option>{experts.map(x=><option key={x.id} value={x.id}>{x.public_name}</option>)}</select></label>
   <label className="expert-wide">دلیل درخواست<input value={handoverReason} onChange={e=>setHandoverReason(e.target.value)} maxLength={500}/></label>
   <div className="expert-wide"><button className="expert-primary" disabled={busy||!cases.length}><Users size={15}/> ارسال برای تأیید کشاورز</button></div>
  </form>
  <p className="expert-muted"><ShieldCheck size={15}/> انتقال فقط بین متخصصان تأییدشده انجام می‌شود. سوابق درخواست، رضایت کشاورز و پذیرش متخصص جدید برای ممیزی حفظ می‌شود.</p>
 </section>;
}
