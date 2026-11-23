import {useCallback,useEffect,useMemo,useState} from "react";
import {Activity,AlertCircle,CheckCircle2,Clock3,ClipboardCheck,RefreshCw,ShieldCheck} from "lucide-react";
import {supabase} from "../lib/supabase";

const db=supabase as any;
type Assignment={
 id:string;request_id:string;assignment_status:string;offered_at:string;responded_at:string|null;
 expert_requests:{id:string;priority:string;status:string;created_at:string}|null;
};
type Recommendation={
 id:string;request_id:string;status:string;approved_at:string;completed_at:string|null;
 due_on:string|null;farmer_note:string|null;evidence:unknown[]|null;updated_at:string;
};
type Review={recommendation_id:string;outcome_status:string;reviewed_at:string};
type Props={profileId:string;verified:boolean};
const localDay=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)};
const pct=(n:number,d:number)=>d?Math.round(n/d*100):null;
const number=(n:number)=>n.toLocaleString("fa-IR");
function duration(hours:number|null){if(hours===null)return "داده کافی نیست";if(hours<1)return "کمتر از یک ساعت";if(hours<24)return Math.round(hours)+" ساعت";const days=Math.floor(hours/24),rest=Math.round(hours%24);return days.toLocaleString("fa-IR")+" روز"+(rest?" و "+rest.toLocaleString("fa-IR")+" ساعت":"");}
function Metric({label,value,detail,icon:Icon,attention=false}:{label:string;value:string;detail:string;icon:any;attention?:boolean}){
 return <article className={attention?"expert-performance-metric attention":"expert-performance-metric"}><span><Icon size={19}/></span><small>{label}</small><strong>{value}</strong><p>{detail}</p></article>;
}
export default function ExpertPerformanceDashboard({profileId,verified}:Props){
 const [assignments,setAssignments]=useState<Assignment[]>([]);
 const [recommendations,setRecommendations]=useState<Recommendation[]>([]);
 const [reviews,setReviews]=useState<Review[]>([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState(""),[updatedAt,setUpdatedAt]=useState<string|null>(null);
 const refresh=useCallback(async()=>{
  if(!supabase||!verified){setAssignments([]);setRecommendations([]);setReviews([]);setLoading(false);return;}
  setLoading(true);setError("");
  const [a,r,v]=await Promise.all([
   db.from("expert_request_assignments").select("id,request_id,assignment_status,offered_at,responded_at,expert_requests!inner(id,priority,status,created_at)").eq("expert_profile_id",profileId).order("offered_at",{ascending:false}).limit(500),
   db.from("expert_recommendation_actions").select("id,request_id,status,approved_at,completed_at,due_on,farmer_note,evidence,updated_at").eq("expert_profile_id",profileId).order("updated_at",{ascending:false}).limit(500),
   db.from("expert_recommendation_reviews").select("recommendation_id,outcome_status,reviewed_at").order("reviewed_at",{ascending:false}).limit(500)
  ]);
  const failures=[a.error,r.error,v.error].filter(Boolean);
  if(failures.length){setError("بخشی از شاخص‌ها به‌دلیل محدودیت دسترسی یا خطای دریافت بارگذاری نشد. لطفاً دوباره تلاش کنید.");}
  setAssignments(a.error?[]:(a.data||[]) as Assignment[]);
  setRecommendations(r.error?[]:(r.data||[]) as Recommendation[]);
  setReviews(v.error?[]:(v.data||[]) as Review[]);
  setUpdatedAt(new Date().toISOString());setLoading(false);
 },[profileId,verified]);
 useEffect(()=>{void refresh();},[refresh]);
 const metrics=useMemo(()=>{
  const responded=assignments.filter(x=>!!x.responded_at);
  const accepted=assignments.filter(x=>x.assignment_status==="accepted");
  const declined=assignments.filter(x=>x.assignment_status==="declined");
  const durations=responded.map(x=>(new Date(x.responded_at!).getTime()-new Date(x.offered_at).getTime())/3600000).filter(x=>Number.isFinite(x)&&x>=0);
  const average=durations.length?durations.reduce((sum,x)=>sum+x,0)/durations.length:null;
  const active=assignments.filter(x=>x.assignment_status==="accepted"&&!["resolved","closed","cancelled","completed"].includes(x.expert_requests?.status||""));
  const urgent=active.filter(x=>x.expert_requests?.priority==="urgent");
  const completed=recommendations.filter(x=>x.status==="completed");
  const overdue=recommendations.filter(x=>["approved","in_progress"].includes(x.status)&&!!x.due_on&&x.due_on<localDay());
  const needsReview=recommendations.filter(x=>x.status==="needs_review");
  const verifiedReviews=reviews.filter(x=>x.outcome_status==="verified");
  const evidenceReported=recommendations.filter(x=>!!x.farmer_note||(Array.isArray(x.evidence)&&x.evidence.length>0));
  return {total:assignments.length,responded:responded.length,accepted:accepted.length,declined:declined.length,average,active:active.length,urgent:urgent.length,completed:completed.length,totalRecommendations:recommendations.length,overdue:overdue.length,needsReview:needsReview.length,verifiedReviews:verifiedReviews.length,totalReviews:reviews.length,evidenceReported:evidenceReported.length};
 },[assignments,recommendations,reviews]);
 if(!verified)return <section className="expert-panel"><b>شاخص‌های عملکرد پس از تأیید صلاحیت متخصص فعال می‌شوند.</b></section>;
 return <section className="expert-performance-workspace" dir="rtl">
  <div className="expert-section-title"><span>گزارش شفاف عملکرد</span><h2>عملکرد و بهره‌وری تخصصی</h2><p>شاخص‌ها فقط از پرونده‌ها، زمان‌های ثبت‌شده، توصیه‌ها و بازبینی‌های قابل مشاهده برای حساب شما محاسبه می‌شوند؛ هیچ اثر کشاورزی بدون شواهد به توصیه شما نسبت داده نمی‌شود.</p></div>
  {error&&<div className="expert-alert" role="status">{error}</div>}
  <div className="expert-operations-toolbar"><div><b>نمای کلی عملکرد</b><small>مبتنی بر سوابق ثبت‌شده در SARINA</small></div><button className="expert-link" type="button" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={15}/> {loading?"در حال دریافت...":"به‌روزرسانی"}</button></div>
  {loading?<div className="expert-empty">در حال محاسبه شاخص‌های عملکرد...</div>:<>
   <div className="expert-stats expert-performance-grid">
    <Metric label="پرونده‌های ارجاع‌شده" value={number(metrics.total)} detail={number(metrics.active)+" پرونده پذیرفته‌شده و فعال"} icon={Activity}/>
    <Metric label="پرونده‌های بحرانی فعال" value={number(metrics.urgent)} detail="اولویت بحرانی ثبت‌شده در پرونده" icon={AlertCircle} attention={metrics.urgent>0}/>
    <Metric label="نرخ پاسخ‌گویی به ارجاع‌ها" value={pct(metrics.responded,metrics.total)===null?"—":number(pct(metrics.responded,metrics.total)!)+"٪"} detail={number(metrics.responded)+" پاسخ از "+number(metrics.total)+" ارجاع" } icon={CheckCircle2}/>
    <Metric label="میانگین زمان پاسخ" value={duration(metrics.average)} detail="از زمان ارجاع تا ثبت پاسخ متخصص" icon={Clock3}/>
    <Metric label="نرخ پذیرش ارجاع‌ها" value={pct(metrics.accepted,metrics.responded)===null?"—":number(pct(metrics.accepted,metrics.responded)!)+"٪"} detail={number(metrics.accepted)+" پذیرفته · "+number(metrics.declined)+" ردشده" } icon={ClipboardCheck}/>
    <Metric label="توصیه‌های تکمیل‌شده" value={number(metrics.completed)} detail={metrics.totalRecommendations?number(pct(metrics.completed,metrics.totalRecommendations)!)+"٪ از "+number(metrics.totalRecommendations)+" توصیه":"هنوز توصیه‌ای ثبت نشده"} icon={CheckCircle2}/>
    <Metric label="نتایج تأییدشده با شواهد" value={number(metrics.verifiedReviews)} detail={number(metrics.totalReviews)+" بازبینی ثبت‌شده" } icon={ShieldCheck}/>
    <Metric label="گزارش یا مدرک اجرایی کشاورز" value={number(metrics.evidenceReported)} detail={number(metrics.totalRecommendations)+" توصیه در مجموع" } icon={ClipboardCheck}/>
    <Metric label="توصیه‌های نیازمند بازبینی" value={number(metrics.needsReview)} detail="درخواست بازبینی ثبت‌شده از سوی کشاورز" icon={AlertCircle} attention={metrics.needsReview>0}/>
    <Metric label="توصیه‌های از موعد گذشته" value={number(metrics.overdue)} detail="توصیه‌های باز با موعد سپری‌شده" icon={Clock3} attention={metrics.overdue>0}/>
   </div>
   {metrics.total===0&&metrics.totalRecommendations===0&&<div className="expert-empty">هنوز داده عملیاتی کافی برای محاسبه عملکرد این حساب وجود ندارد. پس از ارجاع پرونده و ثبت پاسخ یا توصیه، شاخص‌ها به‌صورت خودکار تکمیل می‌شوند.</div>}
   <section className="expert-panel expert-performance-integrity"><h3><ShieldCheck size={18}/> اصول محاسبه و اعتبار داده</h3><ul><li>زمان پاسخ از اختلاف «زمان ارجاع» و «زمان ثبت پاسخ» محاسبه می‌شود؛ فقط موارد دارای هر دو زمان معتبر وارد میانگین می‌شوند.</li><li>نرخ پذیرش از تعداد ارجاع‌های پذیرفته‌شده نسبت به ارجاع‌های پاسخ‌داده‌شده محاسبه می‌شود.</li><li>تکمیل توصیه، ابتدا اعلام وضعیت اجرایی است؛ تأیید نتیجه فقط با ثبت بازبینی متخصص و مبنای شواهد جداگانه گزارش می‌شود.</li><li>این شاخص‌ها عملکرد ثبت‌شده را نشان می‌دهند و به‌تنهایی اثبات‌کننده اثر علّی توصیه بر عملکرد مزرعه نیستند.</li></ul><small>آخرین محاسبه: {updatedAt?new Date(updatedAt).toLocaleString("fa-IR"):"—"} · دسترسی مطابق مجوزهای پرونده و RLS</small></section>
  </>}
 </section>;
}
