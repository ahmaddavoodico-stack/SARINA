import {useEffect,useMemo,useState} from "react";
import {AlertCircle,CheckCircle2,Clock,Play,Send} from "lucide-react";
import {supabase} from "../lib/supabase";

const db=supabase as any;
type Recommendation={
 id:string;farm_id:string;field_id:string|null;title:string;instructions:string;priority:string;
 starts_on:string;due_on:string|null;status:string;farmer_note:string|null;completed_at?:string|null;
};
type Props={
 farmId:string;
 recommendations:Recommendation[];
 selectedTaskId:string|null;
 onSelect:(task:Recommendation)=>void;
 onUpdated:(task:Recommendation)=>void;
};
const priorityLabel=(value:string)=>value==="urgent"?"فوری":value==="high"?"زیاد":value==="low"?"کم":"عادی";
const statusLabel=(value:string)=>({approved:"در انتظار شروع",in_progress:"در حال انجام",completed:"کشاورز اتمام کار را ثبت کرده",needs_review:"در انتظار بازبینی متخصص"} as Record<string,string>)[value]||value;
const dateLabel=(value:string|null)=>value?new Date(value+"T12:00:00").toLocaleDateString("fa-IR"):"بدون مهلت مشخص";
const localToday=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)};
export default function FarmerRecommendationTaskPanel({farmId,recommendations,selectedTaskId,onSelect,onUpdated}:Props){
 const [activeId,setActiveId]=useState<string|null>(selectedTaskId);
 const [note,setNote]=useState("");
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 useEffect(()=>{if(selectedTaskId){setActiveId(selectedTaskId);setNote("");}},[selectedTaskId]);
 const today=localToday();
 const rows=useMemo(()=>[...recommendations].sort((a,b)=>{
  const aDue=a.due_on||"9999-12-31",bDue=b.due_on||"9999-12-31";
  return aDue.localeCompare(bDue)||a.starts_on.localeCompare(b.starts_on);
 }),[recommendations]);
 const active=rows.find(r=>r.id===activeId)||null;
 const priorityTone=(r:Recommendation)=>r.status!=="completed"&&r.status!=="needs_review"&&r.due_on&&r.due_on<today?"orange":r.priority==="urgent"?"orange":r.priority==="high"?"yellow":"green";
 async function updateStatus(status:"in_progress"|"completed"|"needs_review"){
  if(!supabase||!active||busy)return;
  setBusy(true);setNotice("");
  const payload={status,farmer_note:note.trim()||active.farmer_note,updated_at:new Date().toISOString()};
  const {data,error}=await db.from("expert_recommendation_actions")
   .update(payload).eq("id",active.id).eq("farm_id",farmId)
   .in("status",["approved","in_progress"])
   .select("id,farm_id,field_id,title,instructions,priority,starts_on,due_on,status,farmer_note,completed_at").single();
  setBusy(false);
  if(error){setNotice("ثبت وضعیت انجام نشد: "+error.message);return;}
  onUpdated(data as Recommendation);
  setNote("");
  setNotice(status==="completed"?"اتمام کار ثبت شد و گزارش برای متخصص ارسال شد.":status==="needs_review"?"درخواست بازبینی برای متخصص ارسال شد.":"شروع انجام کار ثبت شد.");
 }
 return <section className="farm-task-cycle" aria-label="اقدامات تخصصی برنامه هفتگی">
  <div className="farm-task-cycle-heading">
   <div><b>اقدامات تخصصی و پیگیری اجرا</b><small>هر اقدام به محدوده ثبت‌شده مزرعه متصل است؛ محل نامشخص به‌صورت ساختگی روی نقشه قرار نمی‌گیرد.</small></div>
   <span>{rows.length.toLocaleString("fa-IR")} اقدام</span>
  </div>
  <div className="farm-task-priority-legend">
   <span><i className="green"/> اهمیت عادی</span><span><i className="yellow"/> مهم</span><span><i className="orange"/> فوری یا عقب‌افتاده</span>
  </div>
  {rows.length===0?<div className="farm-task-empty">هنوز توصیه تخصصی تأییدشده‌ای برای این مزرعه ثبت نشده است.</div>:
   <div className="farm-task-list">{rows.map(r=>{
    const tone=priorityTone(r),selected=r.id===activeId,overdue=!!r.due_on&&r.due_on<today&&["approved","in_progress"].includes(r.status);
    return <button type="button" key={r.id} className={"farm-task-row"+(selected?" selected":"")} onClick={()=>{setActiveId(r.id);setNote("");onSelect(r);}}>
     <i className={"farm-task-priority "+tone}/><span className="farm-task-row-copy"><b>{r.title}</b><small>{dateLabel(r.due_on)} · {r.field_id?"متصل به قطعه مزرعه":"کل مزرعه / محل دقیق ثبت نشده"}</small></span>
     <span className={"farm-task-state "+(r.status==="completed"?"done":r.status==="needs_review"?"review":"")}>{overdue?"از موعد گذشته":statusLabel(r.status)}</span>
    </button>;
   })}</div>
  }
  {active&&<div className="farm-task-detail">
   <div className="farm-task-detail-top"><div><b>{active.title}</b><small>اولویت: {priorityLabel(active.priority)} · شروع: {dateLabel(active.starts_on)} · مهلت: {dateLabel(active.due_on)}</small></div><span className={"farm-task-priority "+priorityTone(active)}/></div>
   <p>{active.instructions}</p>
   {active.status==="completed"&&<div className="farm-task-result"><CheckCircle2 size={16}/> اتمام کار توسط کشاورز در {active.completed_at?new Date(active.completed_at).toLocaleString("fa-IR"):"زمان ثبت‌شده"} اعلام شده است.</div>}
   {active.status==="needs_review"&&<div className="farm-task-result"><AlertCircle size={16}/> درخواست بازبینی برای متخصص ارسال شده است.</div>}
   {active.status!=="completed"&&active.status!=="needs_review"&&<>
    <label>گزارش کوتاه از اجرا یا نتیجه (اختیاری)<textarea rows={2} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="مثلاً کار انجام شد؛ وضعیت قبل و بعد یا مشکلی که دیدی را بنویس..."/></label>
    <div className="farm-task-actions">
     {active.status==="approved"&&<button type="button" disabled={busy} onClick={()=>void updateStatus("in_progress")}><Play size={15}/> شروع کار</button>}
     <button type="button" className="complete" disabled={busy} onClick={()=>void updateStatus("completed")}><CheckCircle2 size={15}/> اتمام کار</button>
     <button type="button" className="review" disabled={busy} onClick={()=>void updateStatus("needs_review")}><Send size={15}/> درخواست راهنمایی متخصص</button>
    </div>
   </>}
   {active.farmer_note&&!note&&<small className="farm-task-previous-note">آخرین گزارش کشاورز: {active.farmer_note}</small>}
   {notice&&<p className="farm-task-notice" role="status">{notice}</p>}
  </div>}
 </section>;
}
