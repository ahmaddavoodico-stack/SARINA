import {useMemo,useState} from "react";
import {AlertCircle,ArrowLeft,BriefcaseBusiness,CheckCircle2,Clock3,Inbox,MessageCircle,Search,ShieldCheck} from "lucide-react";

type Assignment={
 id:string;request_id:string;assignment_status:string;offered_at:string;responded_at:string|null;
 expert_requests:{id:string;subject:string;problem_description:string;request_type:string;priority:string;status:string;created_at:string;farm_id?:string|null;updated_at?:string}
};
type CaseNotification={id:string;event_type:string;preview:string;created_at:string;read_at:string|null;request_id:string|null;consultation_id:string|null};
type Props={
 assignments:Assignment[];notifications:CaseNotification[];loading:boolean;busy:boolean;verified:boolean;
 onOpenCase:(assignment:Assignment)=>void;
 onRespond:(assignment:Assignment,status:"accepted"|"declined")=>void;
 onMarkRead:(id:string)=>void;
};
type FilterKey="all"|"decision"|"active"|"unread";
const faDate=(value:string)=>new Date(value).toLocaleDateString("fa-IR",{day:"numeric",month:"short",year:"numeric"});
const relativeWait=(value:string)=>{
 const hours=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/3600000));
 if(hours<1)return "کمتر از یک ساعت";
 if(hours<24)return hours.toLocaleString("fa-IR")+" ساعت انتظار";
 const days=Math.floor(hours/24);
 return days.toLocaleString("fa-IR")+" روز انتظار";
};
const priority=(value:string)=>({
 urgent:{label:"فوری",rank:0,tone:"urgent"},
 high:{label:"زیاد",rank:1,tone:"high"},
 normal:{label:"عادی",rank:2,tone:"normal"},
 low:{label:"کم",rank:3,tone:"low"}
} as Record<string,{label:string;rank:number;tone:string}>)[value]||{label:value||"تعیین‌نشده",rank:4,tone:"normal"};
const statusLabel=(value:string)=>({
 offered:"در انتظار تصمیم متخصص",accepted:"پذیرفته‌شده",declined:"ردشده",submitted:"ثبت‌شده",assigned:"ارجاع‌شده",
 in_progress:"در حال بررسی",waiting_farmer:"منتظر پاسخ کشاورز",waiting_expert:"منتظر پاسخ متخصص",
 needs_information:"نیازمند اطلاعات",resolved:"حل‌شده",closed:"بسته‌شده"
} as Record<string,string>)[value]||value||"وضعیت ثبت نشده";
const typeLabel=(value:string)=>({
 diagnosis:"تشخیص و بررسی",consultation:"مشاوره",field_visit:"بازدید مزرعه",soil_test:"آزمایش خاک",
 water_test:"آزمایش آب",crop_management:"مدیریت محصول",other:"سایر درخواست‌ها"
} as Record<string,string>)[value]||value||"درخواست مشاوره";

export default function SpecialistCaseInbox({assignments,notifications,loading,busy,verified,onOpenCase,onRespond,onMarkRead}:Props){
 const [query,setQuery]=useState("");
 const [filter,setFilter]=useState<FilterKey>("all");
 const unreadByRequest=useMemo(()=>{
  const map=new Map<string,CaseNotification[]>();
  for(const n of notifications){if(!n.read_at&&n.request_id){const rows=map.get(n.request_id)||[];rows.push(n);map.set(n.request_id,rows);}}
  return map;
 },[notifications]);
 const counts=useMemo(()=>({
  all:assignments.length,
  decision:assignments.filter(a=>a.assignment_status==="offered").length,
  active:assignments.filter(a=>a.assignment_status==="accepted"&&!["resolved","closed"].includes(a.expert_requests?.status||"")).length,
  unread:assignments.filter(a=>(unreadByRequest.get(a.request_id)||[]).length>0).length
 }),[assignments,unreadByRequest]);
 const visible=useMemo(()=>{
  const q=query.trim().toLocaleLowerCase();
  return assignments.filter(a=>{
   const request=a.expert_requests;
   const unread=(unreadByRequest.get(a.request_id)||[]).length>0;
   const matches=!q||(request.subject+" "+request.problem_description+" "+typeLabel(request.request_type)).toLocaleLowerCase().includes(q);
   const passes=filter==="all"||(filter==="decision"&&a.assignment_status==="offered")||(filter==="active"&&a.assignment_status==="accepted"&&!["resolved","closed"].includes(request.status))||(filter==="unread"&&unread);
   return matches&&passes;
  }).sort((a,b)=>{
   const ap=priority(a.expert_requests?.priority||"normal").rank,bp=priority(b.expert_requests?.priority||"normal").rank;
   if(ap!==bp)return ap-bp;
   const at=a.assignment_status==="offered"?0:1,bt=b.assignment_status==="offered"?0:1;
   if(at!==bt)return at-bt;
   return new Date(a.offered_at).getTime()-new Date(b.offered_at).getTime();
  });
 },[assignments,filter,query,unreadByRequest]);
 const filters:[FilterKey,string][]=[["all","همه پرونده‌ها"],["decision","نیازمند تصمیم"],["active","پرونده‌های فعال"],["unread","دارای اعلان خوانده‌نشده"]];
 return <section className="specialist-case-inbox" dir="rtl">
  <div className="specialist-case-intro">
   <div><span className="eyebrow">میز کار پرونده‌ها</span><h2>صندوق ورودی کارشناسی</h2><p>درخواست‌ها بر اساس فوریت، زمان انتظار و وضعیت ارجاع مرتب شده‌اند. جزئیات پرونده و مکالمه از مسیرهای موجود باز می‌شود.</p></div>
   <div className="specialist-inbox-total"><Inbox size={18}/><strong>{assignments.length.toLocaleString("fa-IR")}</strong><small>ارجاع ثبت‌شده</small></div>
  </div>
  <div className="specialist-case-metrics">
   <article><small>در انتظار تصمیم شما</small><strong>{counts.decision.toLocaleString("fa-IR")}</strong></article>
   <article><small>پرونده فعال پذیرفته‌شده</small><strong>{counts.active.toLocaleString("fa-IR")}</strong></article>
   <article><small>پرونده دارای اعلان جدید</small><strong>{counts.unread.toLocaleString("fa-IR")}</strong></article>
  </div>
  <div className="specialist-case-toolbar">
   <label><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="جست‌وجو در عنوان و شرح درخواست..."/></label>
   <div className="specialist-case-filters" role="group" aria-label="فیلتر پرونده‌ها">{filters.map(([key,title])=><button type="button" key={key} className={filter===key?"active":""} onClick={()=>setFilter(key)}>{title}<span>{counts[key].toLocaleString("fa-IR")}</span></button>)}</div>
  </div>
  {loading?<div className="specialist-case-empty"><span className="spin">◌</span><b>در حال دریافت پرونده‌ها...</b></div>:
   visible.length===0?<div className="specialist-case-empty"><BriefcaseBusiness size={28}/><b>{query||filter!=="all"?"پرونده‌ای با این فیلتر پیدا نشد.":"هنوز پرونده‌ای به این حساب ارجاع نشده است."}</b><p>با دریافت ارجاع جدید، پرونده در همین صندوق نمایش داده می‌شود.</p></div>:
   <div className="specialist-case-list">{visible.map(a=>{
    const request=a.expert_requests;
    const p=priority(request.priority);
    const linkedUnread=unreadByRequest.get(a.request_id)||[];
    const offered=a.assignment_status==="offered";
    const closed=["resolved","closed"].includes(request.status);
    return <article className="specialist-case-card" key={a.id}>
     <div className="specialist-case-card-top">
      <span className={"specialist-priority "+p.tone}><AlertCircle size={14}/>{p.label}</span>
      <span className={"specialist-assignment-state "+(offered?"waiting":closed?"done":"active")}>{statusLabel(offered?a.assignment_status:request.status||a.assignment_status)}</span>
      {linkedUnread.length>0&&<span className="specialist-case-unread"><MessageCircle size={13}/>{linkedUnread.length.toLocaleString("fa-IR")} اعلان جدید</span>}
     </div>
     <h3>{request.subject||"درخواست مشاوره"}</h3>
     <p className="specialist-case-description">{request.problem_description||"شرحی برای درخواست ثبت نشده است."}</p>
     <div className="specialist-case-meta"><span>{typeLabel(request.request_type)}</span><span><Clock3 size={13}/>{relativeWait(a.offered_at)}</span><span>ارجاع: {faDate(a.offered_at)}</span></div>
     <div className="specialist-case-card-bottom">
      <div className="specialist-case-evidence">{linkedUnread.slice(0,2).map(n=><div key={n.id}><small>{n.preview||"به‌روزرسانی پرونده"} · {faDate(n.created_at)}</small><button type="button" onClick={()=>onMarkRead(n.id)}>خواندم</button></div>)}</div>
      <div className="specialist-case-actions">
       <button type="button" className="specialist-case-open" onClick={()=>onOpenCase(a)}>بازکردن پرونده <ArrowLeft size={15}/></button>
       {offered&&verified&&<><button type="button" className="specialist-case-accept" disabled={busy} onClick={()=>onRespond(a,"accepted")}><CheckCircle2 size={14}/>پذیرش</button><button type="button" className="specialist-case-decline" disabled={busy} onClick={()=>onRespond(a,"declined")}>رد ارجاع</button></>}
       {!verified&&offered&&<span className="specialist-case-locked"><ShieldCheck size={14}/>پذیرش پس از تأیید صلاحیت</span>}
      </div>
     </div>
    </article>;
   })}</div>}
 </section>;
}
