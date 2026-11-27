import {useCallback,useEffect,useMemo,useState} from "react";
import {AlertCircle,CheckCircle2,ClipboardCheck,RefreshCw,ShieldCheck} from "lucide-react";
import {supabase} from "../lib/supabase";
const db=supabase as any;

type Recommendation={
 id:string;request_id:string;farm_id:string;field_id:string|null;title:string;instructions:string;priority:string;
 starts_on:string;due_on:string|null;status:string;approved_at:string;completed_at:string|null;
 farmer_note:string|null;evidence:unknown[];updated_at:string;
 expert_requests?:{subject:string;requester_user_id:string}|null;
};
type Review={id:string;recommendation_id:string;reviewer_user_id:string;outcome_status:"acknowledged"|"verified"|"needs_followup";outcome_summary:string;evidence_assessment:string|null;reviewed_at:string;updated_at:string};
type Props={profileId:string;sarinaUserId:string;verified:boolean};
const localDate=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)};
const fmt=(v:string|null|undefined)=>v?new Date(v+"T12:00:00").toLocaleDateString("fa-IR"):"تعیین نشده";
const outcomeLabel:Record<string,string>={acknowledged:"بررسی شد؛ هنوز تأیید نتیجه نشده",verified:"نتیجه با شواهد تأیید شد",needs_followup:"نیازمند پیگیری بیشتر"};
export default function ExpertRecommendationFollowUp({profileId,sarinaUserId,verified}:Props){
 const [rows,setRows]=useState<Recommendation[]>([]),[reviews,setReviews]=useState<Record<string,Review>>({});
 const [drafts,setDrafts]=useState<Record<string,{status:string;summary:string;evidence:string}>>({});
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(""),[notice,setNotice]=useState("");
 const refresh=useCallback(async()=>{
  if(!supabase||!verified){setRows([]);setReviews({});setLoading(false);return;}
  setLoading(true);setNotice("");
  const [actions,reviewRows]=await Promise.all([
   db.from("expert_recommendation_actions").select("id,request_id,farm_id,field_id,title,instructions,priority,starts_on,due_on,status,approved_at,completed_at,farmer_note,evidence,updated_at,expert_requests!inner(subject,requester_user_id)").eq("expert_profile_id",profileId).order("updated_at",{ascending:false}).limit(200),
   db.from("expert_recommendation_reviews").select("id,recommendation_id,reviewer_user_id,outcome_status,outcome_summary,evidence_assessment,reviewed_at,updated_at")
  ]);
  if(actions.error){setNotice("دریافت توصیه‌ها انجام نشد: "+actions.error.message);setRows([]);setLoading(false);return;}
  if(reviewRows.error){setNotice("دریافت سوابق بازبینی انجام نشد: "+reviewRows.error.message);setRows(actions.data||[]);setLoading(false);return;}
  const nextRows=(actions.data||[]) as Recommendation[];
  const map:Record<string,Review>={};(reviewRows.data||[]).forEach((r:Review)=>map[r.recommendation_id]=r);
  setRows(nextRows);setReviews(map);
  setDrafts(old=>{const next={...old};nextRows.forEach(r=>{if(!next[r.id]){const v=map[r.id];next[r.id]={status:v?.outcome_status||"acknowledged",summary:v?.outcome_summary||"",evidence:v?.evidence_assessment||""};}});return next;});
  setLoading(false);
 },[profileId,verified]);
 useEffect(()=>{void refresh();},[refresh]);
 useEffect(()=>{
  if(!supabase||!verified)return;
  const channel=supabase.channel("expert-recommendation-actions-"+profileId)
   .on("postgres_changes",{event:"*",schema:"public",table:"expert_recommendation_actions",filter:"expert_profile_id=eq."+profileId},()=>{void refresh();})
   .subscribe();
  return()=>{void supabase.removeChannel(channel);};
 },[profileId,verified,refresh]);
 const today=localDate();
 const counts=useMemo(()=>({
  total:rows.length,
  approved:rows.filter(r=>r.status==="approved"&&(!r.due_on||r.due_on>=today)).length,
  inProgress:rows.filter(r=>r.status==="in_progress").length,
  completed:rows.filter(r=>r.status==="completed").length,
  overdue:rows.filter(r=>["approved","in_progress"].includes(r.status)&&!!r.due_on&&r.due_on<today).length,
  needsReview:rows.filter(r=>r.status==="needs_review").length,
  noFeedback:rows.filter(r=>["in_progress","completed","needs_review"].includes(r.status)&&!r.farmer_note&&(!Array.isArray(r.evidence)||r.evidence.length===0)).length
 }),[rows,today]);
 const grouped=useMemo(()=>rows.reduce<Record<string,Recommendation[]>>((acc,r)=>{const key=r.request_id; (acc[key] ||= []).push(r);return acc;},{}),[rows]);
 async function saveReview(r:Recommendation){
  if(!supabase||!sarinaUserId)return;const d=drafts[r.id];if(!d?.summary.trim()){setNotice("برای ثبت ارزیابی، خلاصه بررسی متخصص را بنویسید.");return;}
  if(d.status==="verified"&&d.evidence.trim().length<10){setNotice("برای تأیید نتیجه، مبنای شواهد را با حداقل ۱۰ نویسه توضیح دهید؛ بدون ثبت مبنای شواهد فقط می‌توانید گزارش را بررسی‌شده یا نیازمند پیگیری ثبت کنید.");return;}
  setBusy(r.id);setNotice("");
  const payload={reviewer_user_id:sarinaUserId,outcome_status:d.status,outcome_summary:d.summary.trim(),evidence_assessment:d.evidence.trim()||null,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  const query=reviews[r.id]
   ? db.from("expert_recommendation_reviews").update(payload).eq("recommendation_id",r.id)
   : db.from("expert_recommendation_reviews").insert({...payload,recommendation_id:r.id,created_by_user_id:sarinaUserId});
  const {data,error}=await query.select("id,recommendation_id,reviewer_user_id,outcome_status,outcome_summary,evidence_assessment,reviewed_at,updated_at").single();
  setBusy("");if(error){setNotice("ثبت ارزیابی انجام نشد: "+error.message);return;}
  setReviews(old=>({...old,[r.id]:data as Review}));setNotice("بازبینی تخصصی ثبت شد؛ گزارش کشاورز و ارزیابی شما جداگانه نگهداری می‌شوند.");
 }
 if(!verified)return <section className="expert-panel"><b>پیگیری توصیه‌ها پس از تأیید صلاحیت متخصص فعال می‌شود.</b></section>;
 return <section className="expert-recommendation-followup" dir="rtl">
  <div className="expert-section-title"><span>حلقه اجرای توصیه تا ارزیابی نتیجه</span><h2>پیگیری توصیه‌های تخصصی</h2><p>خلاصه خودکار بر پایه وضعیت ثبت‌شده، موعدها و گزارش کشاورز است؛ این نسخه از مدل زبانی برای تحلیل یا تشخیص استفاده نمی‌کند.</p></div>
  {notice&&<div className="expert-alert" role="status">{notice}</div>}
  <div className="expert-operations-toolbar"><div><b>نمای کلی توصیه‌ها</b><small>فقط توصیه‌های پرونده‌هایی که اکنون به شما ارجاع شده‌اند</small></div><button className="expert-link" onClick={()=>void refresh()}><RefreshCw size={15}/> تازه‌سازی</button></div>
  <div className="expert-recommendation-metrics">
   <article><small>کل توصیه‌ها</small><strong>{counts.total.toLocaleString("fa-IR")}</strong></article>
   <article><small>تأییدشده و در انتظار اجرا</small><strong>{counts.approved.toLocaleString("fa-IR")}</strong></article>
   <article><small>در حال اجرا</small><strong>{counts.inProgress.toLocaleString("fa-IR")}</strong></article>
   <article><small>اعلام تکمیل کشاورز</small><strong>{counts.completed.toLocaleString("fa-IR")}</strong></article>
   <article className={counts.overdue?"attention":""}><small>از موعد گذشته</small><strong>{counts.overdue.toLocaleString("fa-IR")}</strong></article>
   <article className={counts.needsReview?"attention":""}><small>درخواست بازبینی کشاورز</small><strong>{counts.needsReview.toLocaleString("fa-IR")}</strong></article>
  </div>
  <div className="expert-recommendation-summary">
   <b><ClipboardCheck size={17}/> جمع‌بندی منشی پیگیری</b>
   <p>{counts.total===0?"هنوز توصیه تأییدشده‌ای برای پرونده‌های شما ثبت نشده است.":`در مجموع ${counts.total} توصیه ثبت شده؛ ${counts.completed} مورد را کشاورزان تکمیل‌شده اعلام کرده‌اند، ${counts.inProgress} مورد در حال اجراست و ${counts.overdue} مورد از موعد گذشته است.`}</p>
   {counts.noFeedback>0&&<p className="attention-text"><AlertCircle size={15}/> برای ${counts.noFeedback} توصیه هنوز گزارش اجرایی یا مدرک ثبت نشده است.</p>}
   <small>منبع: expert_recommendation_actions و expert_recommendation_reviews · آخرین محاسبه: {new Date().toLocaleString("fa-IR")}</small>
  </div>
  {loading?<div className="expert-empty">در حال دریافت سوابق توصیه‌ها...</div>:rows.length===0?<div className="expert-empty">هنوز توصیه‌ای برای پرونده‌های شما ثبت نشده است. پس از تأیید توصیه توسط متخصص و ثبت آن در برنامه کشاورز، اینجا ظاهر می‌شود.</div>:Object.entries(grouped).map(([requestId,items])=><section className="expert-panel expert-recommendation-case" key={requestId}>
   <header><div><b>{items[0].expert_requests?.subject||"پرونده کشاورز"}</b><small>شناسه پرونده: {requestId.slice(0,8)} · مزرعه: {items[0].farm_id.slice(0,8)} · {items.length.toLocaleString("fa-IR")} توصیه</small></div><ShieldCheck size={18}/></header>
   {items.map(r=>{const d=drafts[r.id]||{status:"acknowledged",summary:"",evidence:""};const review=reviews[r.id];const overdue=!!r.due_on&&r.due_on<today&&["approved","in_progress"].includes(r.status);const hasEvidence=Array.isArray(r.evidence)&&r.evidence.length>0;const suggestion=r.status==="needs_review"?"درخواست بازبینی کشاورز را بررسی کنید و در صورت نیاز اطلاعات تکمیلی بخواهید.":overdue?"موعد گذشته است؛ علت تأخیر و امکان اجرای توصیه را از کشاورز پیگیری کنید.":r.status==="completed"&&!r.farmer_note&&!hasEvidence?"تکمیل فقط اعلام شده است؛ پیش از تأیید نتیجه، گزارش اجرایی یا شواهد بخواهید.":r.status==="completed"&&!hasEvidence?"گزارش متنی ثبت شده؛ کفایت آن برای تأیید نتیجه را بررسی کنید.":r.status==="in_progress"&&!r.farmer_note?"از کشاورز بخواهید پیشرفت کار را با یادداشت یا مدرک ثبت کند.":r.status==="approved"?"وضعیت شروع اجرا را تا نزدیک شدن موعد زیر نظر داشته باشید.":"";return <article className="expert-recommendation-followup-item" key={r.id}>
    <div className="expert-recommendation-followup-top"><div><b>{r.title}</b><small>شروع: {fmt(r.starts_on)} · مهلت: {fmt(r.due_on)} · محدوده: {r.field_id?"قطعه متصل به نقشه":"کل مزرعه"}</small></div><span className={overdue?"expert-tag warning":"expert-tag"}>{overdue?"از موعد گذشته":r.status==="completed"?"کشاورز تکمیل را اعلام کرده":r.status==="needs_review"?"درخواست بازبینی":r.status==="in_progress"?"در حال اجرا":"تأییدشده / در انتظار اجرا"}</span></div>
    <p className="recommendation-instructions">{r.instructions}</p>
    <div className="expert-recommendation-farmer-report"><b>گزارش کشاورز</b><p>{r.farmer_note||"هنوز یادداشت اجرایی ثبت نشده است."}</p><small>مدارک ساختاریافته ثبت‌شده: {Array.isArray(r.evidence)?r.evidence.length.toLocaleString("fa-IR"):"۰"} · ثبت تکمیل: {r.completed_at?new Date(r.completed_at).toLocaleString("fa-IR"):"ندارد"}</small></div>
<div className="expert-recommendation-next-step"><b>پیشنهاد پیگیری مبتنی بر قواعد</b><p>{suggestion||"در حال حاضر اقدام پیگیری مشخصی از روی وضعیت ثبت‌شده پیشنهاد نمی‌شود."}</p></div>
    <div className="expert-recommendation-review-form">
     <div><b>ارزیابی مستقل متخصص</b>{review&&<small>آخرین بازبینی: {new Date(review.reviewed_at).toLocaleString("fa-IR")}</small>}</div>
     <label>نتیجه بررسی<select value={d.status} onChange={e=>setDrafts(old=>({...old,[r.id]:{...d,status:e.target.value}}))}><option value="acknowledged">گزارش بررسی شد؛ تأیید نتیجه نشده</option><option value="verified" disabled={d.evidence.trim().length<10&&review?.outcome_status!=="verified"}>نتیجه با شواهد تأیید شد</option><option value="needs_followup">نیازمند پیگیری بیشتر</option></select></label>
     <label>خلاصه ارزیابی متخصص<textarea rows={2} maxLength={2000} value={d.summary} onChange={e=>setDrafts(old=>({...old,[r.id]:{...d,summary:e.target.value}}))} placeholder="آنچه از گزارش و شواهد قابل نتیجه‌گیری است را بنویسید..."/></label>
     <label>ارزیابی کفایت شواهد (اختیاری)<textarea rows={2} maxLength={2000} value={d.evidence} onChange={e=>setDrafts(old=>({...old,[r.id]:{...d,evidence:e.target.value}}))} placeholder="مبنای ارزیابی را بنویسید؛ مثلاً بازدید میدانی در تاریخ ... یا بررسی عکس‌های قبل و بعد."/></label>
     <button className="expert-primary" disabled={busy===r.id||!d.summary.trim()} onClick={()=>void saveReview(r)}>{busy===r.id?"در حال ثبت...":"ثبت بازبینی تخصصی"} <CheckCircle2 size={15}/></button>
     {d.status==="verified"&&d.evidence.trim().length<10&&<small className="review-state">برای تأیید نتیجه، ابتدا مبنای شواهد را توضیح دهید.</small>}{review&&<small className="review-state">وضعیت کارشناسی: {outcomeLabel[review.outcome_status]||review.outcome_status}</small>}
    </div>
   </article>;})}
  </section>)}
  <p className="expert-recommendation-integrity"><ShieldCheck size={15}/> «کشاورز اعلام کرده انجام داده» با «متخصص نتیجه را با شواهد تأیید کرده» یکسان نیست. ثبت بازبینی فقط برای متخصص تأییدشده و مسئول فعلی پرونده مجاز است.</p>
 </section>;
}
