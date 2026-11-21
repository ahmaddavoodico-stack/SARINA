import {useCallback,useEffect,useMemo,useState} from "react";
import {AlertCircle,BookOpen,ClipboardList,FileLock2,MessageCircle,Plus,RefreshCw,Send,ShieldCheck,Sparkles} from "lucide-react";
import {supabase} from "../lib/supabase";

type AssignmentStatus="offered"|"accepted"|"declined"|string;
type CaseMessage={id:string;sender_user_id:string;message_text:string|null;created_at:string};
type CaseRow={id:string;subject:string;problem_description:string;request_type:string;priority:string;status:string;created_at:string;updated_at:string;farm_id:string|null;consented_context_snapshot:Record<string,unknown>};
type AssistantRow={assistant_status:string;completeness_status:string;missing_information:string[];assistant_summary:string|null;received_at:string;reviewed_at:string|null;last_reminded_at:string|null;reminder_count:number;escalated_at:string|null};
type Note={id:string;note_type:string;body:string;source_refs:any;created_at:string;author_user_id:string};
type Report={id:string;summary:string;recommendations:string|null;limitations:string|null;created_at:string};
type TestRow={id:string;sampled_at:string;laboratory_name:string|null;ph:number|null;ec_ds_m:number|null;notes:string|null;report_file_ref:string|null;[key:string]:any};
type Props={requestId:string;consultationId:string|null;userId:string;verified:boolean;assignmentStatus:AssignmentStatus;messages:CaseMessage[];messageText:string;setMessageText:(value:string)=>void;onSendMessage:(event:React.FormEvent)=>void;busy:boolean};
const db=supabase as any;
const faDate=(value:string|null|undefined)=>value?new Date(value).toLocaleString("fa-IR",{dateStyle:"medium",timeStyle:"short"}):"—";
const statusLabel=(value:string)=>({submitted:"ثبت‌شده",assigned:"ارجاع‌شده",in_progress:"در حال بررسی",waiting_user:"منتظر پاسخ کشاورز",waiting_farmer:"منتظر پاسخ کشاورز",waiting_expert:"منتظر پاسخ متخصص",resolved:"حل‌شده",closed:"بسته‌شده",received:"دریافت‌شده",initial_review:"بررسی اولیه",needs_information:"نیازمند اطلاعات تکمیلی",awaiting_expert:"در انتظار نظر متخصص",expert_reviewed:"بررسی متخصص انجام شد"} as Record<string,string>)[value]||value||"ثبت نشده";
const contextEntries=(value:unknown,prefix=""):Array<{key:string;value:string}>=>{
 if(value===null||value===undefined)return [];
 if(typeof value!=="object"||Array.isArray(value))return [{key:prefix||"مقدار",value:Array.isArray(value)?value.map(String).join("، "):String(value)}];
 return Object.entries(value as Record<string,unknown>).flatMap(([key,item])=>contextEntries(item,prefix?prefix+" / "+key:key));
};
const elapsed=(start:string,end:string)=>{const ms=Math.max(0,new Date(end).getTime()-new Date(start).getTime());const hours=Math.floor(ms/3600000);const days=Math.floor(hours/24);return days?days+" روز و "+(hours%24)+" ساعت":hours?hours+" ساعت":Math.max(1,Math.floor(ms/60000))+" دقیقه";};

export default function SpecialistCaseDetail({requestId,consultationId,userId,verified,assignmentStatus,messages,messageText,setMessageText,onSendMessage,busy}:Props){
 const [tab,setTab]=useState<"case"|"conversation"|"assistant">("case");
 const [request,setRequest]=useState<CaseRow|null>(null),[assistant,setAssistant]=useState<AssistantRow|null>(null);
 const [notes,setNotes]=useState<Note[]>([]),[reports,setReports]=useState<Report[]>([]);
 const [soilTests,setSoilTests]=useState<TestRow[]>([]),[waterTests,setWaterTests]=useState<TestRow[]>([]);
 const [noteText,setNoteText]=useState(""),[noteType,setNoteType]=useState("observation");
 const [missingText,setMissingText]=useState(""),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[notice,setNotice]=useState("");
 const [notesUnavailable,setNotesUnavailable]=useState(false),[soilAccess,setSoilAccess]=useState<"loading"|"available"|"restricted"|"none">("loading"),[waterAccess,setWaterAccess]=useState<"loading"|"available"|"restricted"|"none">("loading");
 const refresh=useCallback(async()=>{
  if(!supabase)return;setLoading(true);setNotice("");
  const [r,a,n,p]=await Promise.all([
   db.from("expert_requests").select("id,subject,problem_description,request_type,priority,status,created_at,updated_at,farm_id,consented_context_snapshot").eq("id",requestId).maybeSingle(),
   db.from("expert_case_assistant_cases").select("assistant_status,completeness_status,missing_information,assistant_summary,received_at,reviewed_at,last_reminded_at,reminder_count,escalated_at").eq("request_id",requestId).maybeSingle(),
   db.from("expert_case_notes").select("id,note_type,body,source_refs,created_at,author_user_id").eq("request_id",requestId).order("created_at",{ascending:false}).limit(100),
   db.from("expert_request_reports").select("id,summary,recommendations,limitations,created_at").eq("request_id",requestId).order("created_at",{ascending:false}).limit(20)
  ]);
  if(r.error)setNotice("اطلاعات اصلی پرونده بارگذاری نشد: "+r.error.message);else setRequest(r.data);
  if(a.error)setNotice(old=>old||"وضعیت دستیار پرونده در دسترس نیست: "+a.error.message);else{setAssistant(a.data);setMissingText((a.data?.missing_information||[]).join("\n"));}
  if(n.error){setNotesUnavailable(true);setNotes([]);}else{setNotesUnavailable(false);setNotes(n.data||[]);}
  if(p.error)setNotice(old=>old||"گزارش‌های پرونده بارگذاری نشد: "+p.error.message);else setReports(p.data||[]);
  if(r.data?.farm_id){
   const [soil,water]=await Promise.all([
    db.from("soil_tests").select("id,sampled_at,laboratory_name,ph,ec_ds_m,soil_texture,organic_matter_pct,calcium_carbonate_pct,nitrogen_mg_kg,phosphorus_mg_kg,potassium_mg_kg,report_file_ref,notes").eq("farm_id",r.data.farm_id).order("sampled_at",{ascending:false}).limit(10),
    db.from("water_tests").select("id,sampled_at,laboratory_name,water_source,ph,ec_ds_m,tds_mg_l,sar,chloride_mg_l,bicarbonate_mg_l,boron_mg_l,report_file_ref,notes").eq("farm_id",r.data.farm_id).order("sampled_at",{ascending:false}).limit(10)
   ]);
   setSoilTests(soil.data||[]);setWaterTests(water.data||[]);
   setSoilAccess(soil.error?"restricted":soil.data?.length?"available":"none");
   setWaterAccess(water.error?"restricted":water.data?.length?"available":"none");
  }else{setSoilAccess("none");setWaterAccess("none");}
  setLoading(false);
 },[requestId]);
 useEffect(()=>{void refresh();},[refresh]);
 const firstExpertMessage=useMemo(()=>messages.filter(m=>m.sender_user_id===userId).sort((a,b)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime())[0],[messages,userId]);
 const latestMessage=useMemo(()=>[...messages].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())[0],[messages]);
 const sourceEntries=useMemo(()=>contextEntries(request?.consented_context_snapshot||{}),[request]);
 async function addNote(e:React.FormEvent){
  e.preventDefault();if(!supabase||!noteText.trim()||!verified||assignmentStatus!=="accepted")return;
  setSaving(true);setNotice("");
  const {error}=await db.from("expert_case_notes").insert({request_id:requestId,author_user_id:userId,note_type:noteType,body:noteText.trim(),source_refs:[]});
  setSaving(false);
  if(error){setNotice(error.message.includes("expert_case_notes")?"زیرساخت یادداشت کارشناسی هنوز روی پایگاه داده فعال نشده است. پس از اجرای migration، ثبت یادداشت فعال می‌شود.":error.message);return;}
  setNoteText("");await refresh();setNotice("یادداشت کارشناسی مستقل در پرونده ثبت شد.");
 }
 async function requestInformation(e:React.FormEvent){
  e.preventDefault();if(!supabase||!assistant||!verified||assignmentStatus!=="accepted")return;
  const items=missingText.split(/[\n،,؛;]/).map(x=>x.trim()).filter(Boolean);
  if(!items.length){setNotice("حداقل یک مورد اطلاعات یا مدرک موردنیاز را وارد کنید.");return;}
  setSaving(true);setNotice("");
  const {error}=await db.from("expert_case_assistant_cases").update({assistant_status:"needs_information",completeness_status:"missing_information",missing_information:items,reviewed_at:new Date().toISOString(),reviewed_by_user_id:userId}).eq("request_id",requestId);
  setSaving(false);
  if(error){setNotice(error.message);return;}
  setAssistant(old=>old?{...old,assistant_status:"needs_information",completeness_status:"missing_information",missing_information:items,reviewed_at:new Date().toISOString()}:old);
  setNotice("درخواست اطلاعات تکمیلی برای کشاورز ثبت و اعلان پرونده ارسال شد. پاسخ کشاورز در مکالمه انسانی همین پرونده دریافت می‌شود.");
 }
 if(loading)return <section className="expert-panel specialist-case-detail" dir="rtl">در حال بارگذاری جزئیات پرونده...</section>;
 if(!request)return <section className="expert-panel specialist-case-detail" dir="rtl"><b>جزئیات پرونده در دسترس نیست.</b>{notice&&<p>{notice}</p>}</section>;
 const canWork=verified&&assignmentStatus==="accepted";
 const tabs=[{id:"case",label:"پرونده کارشناسی",icon:ClipboardList},{id:"conversation",label:"مکالمه انسانی",icon:MessageCircle},{id:"assistant",label:"دستیار هوشمند",icon:Sparkles}] as const;
 return <section className="specialist-case-detail" dir="rtl">
  <header className="specialist-detail-heading"><div><span className="eyebrow">پرونده کارشناسی SARINA</span><h2>{request.subject}</h2><p>{request.problem_description}</p></div><div className="specialist-detail-status"><b>{statusLabel(request.status)}</b><small>اولویت: {request.priority==="urgent"?"فوری":request.priority==="high"?"زیاد":request.priority==="low"?"کم":"عادی"}</small></div></header>
  <nav className="specialist-detail-tabs" aria-label="بخش‌های پرونده">{tabs.map(item=>{const Icon=item.icon;return <button type="button" key={item.id} className={tab===item.id?"active":""} onClick={()=>setTab(item.id)}><Icon size={15}/>{item.label}</button>;})}</nav>
  {notice&&<div className="expert-alert" role="status">{notice}</div>}
  {tab==="case"&&<>
   <div className="specialist-detail-metrics">
    <article><small>تاریخ ثبت پرونده</small><b>{faDate(request.created_at)}</b></article>
    <article><small>زمان تا اولین پاسخ متخصص</small><b>{firstExpertMessage?elapsed(request.created_at,firstExpertMessage.created_at):"هنوز ثبت نشده"}</b></article>
    <article><small>وضعیت پیگیری مکالمه</small><b>{latestMessage?.sender_user_id!==userId&&latestMessage?"منتظر پاسخ متخصص":"بدون پیام معوق"}</b></article>
   </div>
   <div className="specialist-detail-grid">
    <article className="expert-panel"><h3><BookOpen size={16}/> اطلاعات ثبت‌شده با رضایت کشاورز</h3><p className="specialist-source-note">منشأ: تصویر ثابت اطلاعاتی که هنگام ثبت درخواست و با محدوده رضایت ثبت شده است (consented_context_snapshot).</p>
     {sourceEntries.length?<dl className="specialist-source-list">{sourceEntries.map((item,i)=><div key={item.key+i}><dt>{item.key.replaceAll("_"," ")}</dt><dd>{item.value}</dd></div>)}</dl>:<p className="expert-muted">در این پرونده، داده زمینه‌ایِ دارای رضایت ثبت نشده است؛ اطلاعات حدسی نمایش داده نمی‌شود.</p>}
    </article>
    <article className="expert-panel"><h3><ShieldCheck size={16}/> سوابق و منشأ پرونده</h3><dl className="specialist-source-list"><div><dt>نوع درخواست</dt><dd>{request.request_type}</dd></div><div><dt>شناسه مزرعه</dt><dd>{request.farm_id||"به پرونده متصل نیست"}</dd></div><div><dt>منشأ شرح</dt><dd>متن ثبت‌شده مستقیم توسط کشاورز</dd></div><div><dt>آخرین به‌روزرسانی</dt><dd>{faDate(request.updated_at)}</dd></div></dl>
     <p className="specialist-source-note">داده‌های زمینه‌ای صرفاً برای محدوده رضایت ثبت‌شده قابل استفاده‌اند. پرونده جامع کشاورز با این نمای کارشناسی یکی نیست.</p>
    </article>
   </div>
   <div className="specialist-detail-grid">
    <article className="expert-panel"><h3>آزمایش خاک</h3>{soilAccess==="available"?soilTests.map(t=><div className="specialist-test-row" key={t.id}><b>{faDate(t.sampled_at)} · {t.laboratory_name||"آزمایشگاه ثبت نشده"}</b><span>pH: {t.ph??"—"} · EC: {t.ec_ds_m??"—"} dS/m · بافت: {t.soil_texture||"—"}</span><small>ماده آلی: {t.organic_matter_pct??"—"}٪ · آهک: {t.calcium_carbonate_pct??"—"}٪</small></div>):<p className="expert-muted">{soilAccess==="restricted"?"دسترسی به نتایج آزمایش خاک با مجوز فعلی ممکن نیست.":"آزمایش خاکی در محدوده دسترسی فعلی برای این مزرعه ثبت نشده است."}</p>}</article>
    <article className="expert-panel"><h3>آزمایش آب</h3>{waterAccess==="available"?waterTests.map(t=><div className="specialist-test-row" key={t.id}><b>{faDate(t.sampled_at)} · {t.laboratory_name||"آزمایشگاه ثبت نشده"}</b><span>pH: {t.ph??"—"} · EC: {t.ec_ds_m??"—"} dS/m · SAR: {t.sar??"—"}</span><small>TDS: {t.tds_mg_l??"—"} mg/L · بور: {t.boron_mg_l??"—"} mg/L</small></div>):<p className="expert-muted">{waterAccess==="restricted"?"دسترسی به نتایج آزمایش آب با مجوز فعلی ممکن نیست.":"آزمایش آبی در محدوده دسترسی فعلی برای این مزرعه ثبت نشده است."}</p>}</article>
   </div>
   <div className="specialist-detail-grid">
    <article className="expert-panel"><h3>یادداشت کارشناسی مستقل</h3><p className="specialist-source-note">یادداشت‌ها فقط برای متخصصان مجاز پرونده‌اند و با مکالمه کشاورز یا گزارش نهایی ادغام نمی‌شوند.</p>
     {notesUnavailable&&<p className="specialist-locked-note"><FileLock2 size={15}/> زیرساخت یادداشت در انتظار اجرای migration این مرحله است.</p>}
     {notes.map(n=><div className="specialist-note-row" key={n.id}><b>{({observation:"مشاهده",assessment:"ارزیابی",follow_up:"پیگیری",decision:"تصمیم"} as Record<string,string>)[n.note_type]||n.note_type}</b><p>{n.body}</p><small>{faDate(n.created_at)}</small></div>)}
     <form className="specialist-detail-form" onSubmit={addNote}><select value={noteType} onChange={e=>setNoteType(e.target.value)}><option value="observation">مشاهده</option><option value="assessment">ارزیابی</option><option value="follow_up">پیگیری</option><option value="decision">تصمیم</option></select><textarea value={noteText} onChange={e=>setNoteText(e.target.value)} maxLength={8000} rows={3} placeholder="یادداشت تخصصی محرمانه برای پرونده..." required/><button className="expert-primary" disabled={!canWork||saving||notesUnavailable}><Plus size={14}/> ثبت یادداشت</button></form>
    </article>
    <article className="expert-panel"><h3>درخواست اطلاعات و مدارک تکمیلی</h3><p className="specialist-source-note">با ثبت درخواست، اعلان خودکار به کشاورز ارسال می‌شود و از او خواسته می‌شود پاسخ را در مکالمه انسانی پرونده بفرستد.</p>
     <form className="specialist-detail-form" onSubmit={requestInformation}><textarea value={missingText} onChange={e=>setMissingText(e.target.value)} rows={4} placeholder={"هر مورد را در یک خط بنویسید؛ مثلاً:\nسن درخت\nتاریخ آخرین آبیاری\nنتیجه EC آب"} required/><button className="expert-primary" disabled={!canWork||saving||!assistant}><Send size={14}/> ارسال درخواست تکمیلی</button></form>
     {((assistant?.missing_information??[]).length>0)&&<p className="specialist-source-note">موارد در انتظار: {(assistant?.missing_information??[]).join("، ")}</p>}
    </article>
   </div>
   <article className="expert-panel"><h3>گزارش‌های ثبت‌شده</h3>{reports.length?reports.map(r=><div className="specialist-note-row" key={r.id}><b>{faDate(r.created_at)}</b><p>{r.summary}</p>{r.recommendations&&<small>توصیه‌ها: {r.recommendations}</small>}{r.limitations&&<small>محدودیت‌ها: {r.limitations}</small>}</div>):<p className="expert-muted">گزارش نهایی برای این پرونده ثبت نشده است.</p>}</article>
   <article className="expert-panel"><h3><AlertCircle size={16}/> پیگیری و یادآوری</h3><div className="specialist-detail-metrics"><article><small>تعداد یادآوری‌های ثبت‌شده</small><b>{assistant?.reminder_count??0}</b></article><article><small>آخرین یادآوری</small><b>{faDate(assistant?.last_reminded_at)}</b></article><article><small>وضعیت پیگیری</small><b>{latestMessage&&latestMessage.sender_user_id!==userId?"نیازمند پاسخ متخصص":"در انتظار اقدام بعدی"}</b></article></div><p className="specialist-source-note">این نما وضعیت پیگیری و سوابق یادآوری موجود را نشان می‌دهد. زمان‌بندی خودکار یادآوری‌ها هنوز به سرویس زمان‌بندی متصل نشده و در این نسخه ادعای ارسال خودکار نداریم.</p></article>
   <article className="expert-panel"><h3><FileLock2 size={16}/> تصاویر و مستندات</h3><p className="specialist-locked-note">نمایش و دریافت فایل‌ها موقتاً غیرفعال است. مخزن فعلی اسناد کشاورز خصوصی است، اما سیاست Storage و جدول farm_documents هنوز فقط دسترسی مالک مزرعه را می‌دهند؛ تا تکمیل سیاست رضایت‌محور و آزمون signed URL، فایل‌ها برای متخصص باز نمی‌شوند.</p></article>
  </>}
  {tab==="conversation"&&<article className="expert-panel specialist-human-chat"><h3><MessageCircle size={16}/> مکالمه انسانی متخصص و کشاورز</h3><p className="specialist-source-note">این مکالمه مستقل از یادداشت کارشناسی و دستیار هوشمند است. پیام‌ها در جدول مکالمه فعلی SARINA ثبت می‌شوند.</p>
   {!consultationId?<p className="expert-muted">برای این پرونده هنوز جلسه مکالمه‌ای ایجاد نشده است.</p>:<><div className="expert-chat">{messages.map(m=><div key={m.id} className={m.sender_user_id===userId?"mine":""}><p>{m.message_text||"محتوای غیرمتنی"}</p><small>{faDate(m.created_at)}</small></div>)}</div><form className="expert-inline-form" onSubmit={onSendMessage}><input value={messageText} onChange={e=>setMessageText(e.target.value)} placeholder="پیام به کشاورز..." required/><button className="expert-primary" disabled={!canWork||busy}><Send size={15}/></button></form></>}
  </article>}
  {tab==="assistant"&&<div className="specialist-detail-grid">
   <article className="expert-panel"><h3><Sparkles size={16}/> خلاصه دستیار پرونده</h3><p className="specialist-source-note">منشأ مستقیم: فیلد assistant_summary از جدول expert_case_assistant_cases. این نمایش به‌تنهایی به معنی فراخوانی مدل زبانی در همین لحظه نیست.</p><p>{assistant?.assistant_summary||"خلاصه‌ای در پرونده ثبت نشده است."}</p><small>وضعیت: {statusLabel(assistant?.assistant_status||"received")} · دریافت اولیه: {faDate(assistant?.received_at)}</small><p className="specialist-source-note">کامل بودن اطلاعات: {assistant?.completeness_status==="appears_complete"?"اطلاعات اولیه ثبت شده؛ کامل بودن تخصصی تأیید نشده":assistant?.completeness_status==="missing_information"?"اطلاعات تکمیلی لازم است":"هنوز ارزیابی نشده"}</p></article>
   <article className="expert-panel"><h3>منشأ و محدودیت اطلاعات</h3><p>هر مقدار در بخش اطلاعات زمینه‌ای از snapshot رضایت‌محور درخواست آمده است. دستیار نباید داده مفقود را حدس بزند و متخصص باید شواهد را مستقلاً ارزیابی کند.</p><small>منشأ: expert_requests.consented_context_snapshot · آخرین بازبینی: {faDate(assistant?.reviewed_at)}</small></article>
  </div>}
  <div className="specialist-detail-footer"><button className="expert-link" type="button" onClick={()=>void refresh()}><RefreshCw size={14}/> تازه‌سازی جزئیات</button><span><ShieldCheck size={14}/> دسترسی بر اساس نقش، ارجاع پذیرفته‌شده و RLS کنترل می‌شود.</span></div>
 </section>;
}
