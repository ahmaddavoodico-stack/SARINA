import {useCallback,useEffect,useState} from "react";
import {Activity,AlertTriangle,CheckCircle2,Clock3,ExternalLink,FileText,RefreshCw,ShieldCheck,WifiOff} from "lucide-react";
import {supabase} from "../lib/supabase";

type Agent = {
  agent_instance_id:string; adapter_id:string; specialist_role:string; lifecycle_state:string;
  dispatch_enabled:boolean; last_heartbeat_at:string|null; last_capability_check_at:string|null;
  capabilities:string[]; active_task_count:number; capacity:number|null;
  runtime_state:string; health:string; reason_code:string; heartbeat_age_ms:number|null;
};
type Mission = {id:string;external_task_id:string;external_task_url:string;title:string;adapter_id:string;specialist_role:string;domain:string;status:string;draft_id:string|null;created_at:string;report_received_at:string|null};
type Draft = {id:string;title:string;market_scope:string;summary:string;findings:string[];sources:{title:string;url:string;publisher?:string;accessed_at?:string}[];recommendations:string[];status:string;submitted_by:string;external_mission_id:string|null;created_at:string};
type Snapshot = {ok:boolean;generated_at:string;fleet:Record<string,number>;agents:Agent[];missions:Mission[];drafts:Draft[];review_policy:{first_pilot_requires_owner_review:boolean;automatic_score_available:boolean;note:string}};

const faState:Record<string,string>={ready:"آماده‌به‌کار",busy:"مشغول",responding:"پاسخ‌گو",degraded:"دارای اختلال",offline:"آفلاین",unknown:"نامشخص",paused:"متوقف",disabled:"غیرفعال",deprecated:"منسوخ"};
const faHealth:Record<string,string>={healthy:"سالم",degraded:"نیازمند توجه",unavailable:"غیرقابل‌دسترس",unknown:"تأییدنشده"};
const faMission:Record<string,string>={submitted_external:"ارسال‌شده به سرویس بیرونی",awaiting_report:"در انتظار دریافت گزارش",draft_received:"گزارش دریافت‌شده",owner_review:"در انتظار ارزیابی مالک",accepted:"پذیرفته‌شده",rejected:"ردشده",failed:"ناموفق"};

function timeAgo(value:string|null){if(!value)return "هنوز heartbeat ثبت نشده";const age=Math.max(0,Date.now()-Date.parse(value));if(!Number.isFinite(age))return "زمان نامعتبر";if(age<60_000)return "کمتر از یک دقیقه پیش";if(age<3_600_000)return Math.floor(age/60_000)+" دقیقه پیش";return Math.floor(age/3_600_000)+" ساعت پیش";}

export default function AgentOperationsWorkspace(){
 const[data,setData]=useState<Snapshot|null>(null);
 const[loading,setLoading]=useState(true);
 const[busyDraft,setBusyDraft]=useState<string|null>(null);
 const[error,setError]=useState("");
 const[notice,setNotice]=useState("");
 const[expanded,setExpanded]=useState<string|null>(null);
 const load=useCallback(async()=>{
  if(!supabase){setError("اتصال پایگاه داده در دسترس نیست.");setLoading(false);return;}
  setLoading(true);setError("");
  const{data:result,error:invokeError}=await supabase.functions.invoke("sarina-agent-operations",{body:{action:"snapshot"}});
  if(invokeError||!result?.ok){setError(typeof result?.code==="string"?result.code:"دریافت وضعیت عملیات ایجنت‌ها ناموفق بود.");setLoading(false);return;}
  setData(result as Snapshot);setLoading(false);
 },[]);
 useEffect(()=>{void load();},[load]);
 async function linkDraft(draft:Draft,mission:Mission){
  if(!supabase)return;setBusyDraft(draft.id);setError("");setNotice("");
  const{data:result,error:linkError}=await supabase.functions.invoke("sarina-agent-operations",{body:{action:"link_draft",draft_id:draft.id,mission_id:mission.id}});
  setBusyDraft(null);
  if(linkError||!result?.ok){setError(typeof result?.code==="string"?result.code:"اتصال گزارش به مأموریت انجام نشد.");return;}
  setNotice("گزارش به مأموریت آزمایشی متصل شد و برای ارزیابی مالک آماده است.");await load();
 }
 const mission=data?.missions?.[0];
 const fleet=data?.fleet;
 return <section className="admin-panel" dir="rtl" style={{marginTop:20}}>
  <div className="admin-list-head">
   <div><span className="executive-kicker">SARINA CENTRAL INTELLIGENCE · SCI</span><h2>مرکز عملیات و سلامت ناوگان هوش‌ها</h2><small>نمایش فقط بر اساس سیگنال‌های واقعی؛ بدون وضعیت سبز ساختگی یا نمایش همه مکالمات.</small></div>
   <button className="admin-refresh" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/> به‌روزرسانی</button>
  </div>
  {error&&<div className="admin-alert error" role="alert">{error}</div>}
  {notice&&<div className="admin-alert success" role="status">{notice}</div>}
  {loading&&!data?<div className="admin-empty">در حال دریافت وضعیت واقعی ناوگان...</div>:<>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(115px,1fr))",gap:10,margin:"16px 0"}}>
    {[
      ["کل runtimeها",fleet?.total??0],["آماده‌به‌کار",fleet?.ready??0],["مشغول",fleet?.busy??0],
      ["پاسخ‌گو",fleet?.responding??0],["دارای اختلال",fleet?.degraded??0],["آفلاین",fleet?.offline??0],["نامشخص",fleet?.unknown??0]
    ].map(([label,value])=><div key={String(label)} style={{border:"1px solid var(--border,#dce5dc)",borderRadius:12,padding:12,background:"var(--surface,#fff)"}}><small style={{display:"block",color:"var(--muted,#64748b)"}}>{label}</small><strong style={{fontSize:23}}>{Number(value).toLocaleString("fa-IR")}</strong></div>)}
   </div>
   <div style={{display:"grid",gap:12}}>
    {data?.agents.length?data.agents.map(agent=><article key={agent.agent_instance_id} style={{border:"1px solid var(--border,#dce5dc)",borderRadius:14,padding:14}}>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
      <div><strong>{agent.adapter_id==="manus"?"Manus · هوشمندی بازار":agent.agent_instance_id}</strong><div><small>{agent.specialist_role} · چرخه: {agent.lifecycle_state==="enabled"?"مجاز از نظر چرخه":agent.lifecycle_state}</small></div></div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><span className="admin-status-chip">{faState[agent.runtime_state]??agent.runtime_state}</span><span className="admin-status-chip">{faHealth[agent.health]??agent.health}</span></div>
     </div>
     <div style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:12,fontSize:13}}>
      <span><Clock3 size={14} style={{verticalAlign:"middle"}}/> آخرین heartbeat: {timeAgo(agent.last_heartbeat_at)}</span>
      <span><Activity size={14} style={{verticalAlign:"middle"}}/> بار کاری: {agent.active_task_count}{agent.capacity===null?"":"/"+agent.capacity}</span>
      <span><ShieldCheck size={14} style={{verticalAlign:"middle"}}/> آزمون قابلیت: {agent.last_capability_check_at?timeAgo(agent.last_capability_check_at):"ثبت نشده"}</span>
     </div>
     <small style={{display:"block",marginTop:8,color:"var(--muted,#64748b)"}}>دلیل وضعیت: {agent.reason_code} · dispatch خودکار: {agent.dispatch_enabled?"مجاز":"غیرفعال"}</small><small style={{display:"block",marginTop:5,color:"var(--muted,#64748b)"}}>قابلیت‌های تأییدشده: {(agent.capabilities??[]).join("، ")||"هنوز ثبت نشده"}</small>
    </article>):<div className="admin-empty"><WifiOff size={22}/> هنوز هیچ runtimeای heartbeat معتبر در SARINA ثبت نکرده است. اتصال Manus در گذشته موفق بوده، اما تا ثبت سیگنال تازه «آماده‌به‌کار» محسوب نمی‌شود.</div>}
   </div>
   <div style={{marginTop:22}}>
    <div className="admin-list-head"><div><h3>مأموریت آزمایشی Manus</h3><small>مأموریت قبلی خرمای خوزستان به مقصد امارات؛ وضعیت سرویس بیرونی از اینجا poll نمی‌شود.</small></div></div>
    {mission?<article style={{border:"1px solid var(--border,#dce5dc)",borderRadius:14,padding:14}}>
     <strong>{mission.title}</strong><p style={{margin:"6px 0",fontSize:13}}>{faMission[mission.status]??mission.status} · {mission.specialist_role}</p>
     <a href={mission.external_task_url} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6}}><ExternalLink size={15}/> مشاهده مأموریت در Manus</a>
     <p style={{fontSize:12,color:"var(--muted,#64748b)"}}>شناسه: {mission.external_task_id} · این رکورد فقط پیوند SARINA است؛ نتیجه یا وضعیت فعلی Manus را حدس نمی‌زند.</p>
    </article>:<div className="admin-empty">مأموریت خارجی ثبت نشده است.</div>}
   </div>
   <div style={{marginTop:22}}>
    <div className="admin-list-head"><div><h3>گزارش‌های پژوهشی و ارزیابی</h3><small>گزارش‌های Manus به‌صورت پیش‌نویس خصوصی باقی می‌مانند.</small></div></div>
    {!data?.drafts.length?<div className="admin-empty"><FileText size={22}/> هنوز گزارشی در مخزن پیش‌نویس SARINA دریافت نشده است. پس از ذخیره گزارش توسط Manus، اینجا نمایش داده می‌شود.</div>:data.drafts.map(draft=><article key={draft.id} style={{border:"1px solid var(--border,#dce5dc)",borderRadius:14,padding:14,marginBottom:10}}>
     <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}><div><strong>{draft.title}</strong><div><small>{draft.market_scope} · {new Date(draft.created_at).toLocaleString("fa-IR")}</small></div></div><span className="admin-status-chip">{draft.status==="pending_review"?"پیش‌نویس؛ نیازمند بررسی":draft.status}</span></div>
     {mission&&!draft.external_mission_id&&<button style={{marginTop:10}} onClick={()=>void linkDraft(draft,mission)} disabled={busyDraft===draft.id}>{busyDraft===draft.id?"در حال اتصال...":"اتصال به مأموریت آزمایشی"}</button>}
     <button style={{marginTop:10,marginRight:8}} onClick={()=>setExpanded(expanded===draft.id?null:draft.id)}>{expanded===draft.id?"بستن گزارش":"مشاهده گزارش کامل"}</button>
     {expanded===draft.id&&<div style={{marginTop:14,lineHeight:1.9}}>
      <h4>خلاصه</h4><p style={{whiteSpace:"pre-wrap"}}>{draft.summary}</p>
      <h4>یافته‌ها</h4><ul>{(draft.findings??[]).map((item,i)=><li key={i}>{item}</li>)}</ul>
      <h4>منابع</h4><ul>{(draft.sources??[]).map((source,i)=><li key={i}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>{source.publisher?" · "+source.publisher:""}{source.accessed_at?" · "+source.accessed_at:""}</li>)}</ul>
      <h4>پیشنهادها</h4><ul>{(draft.recommendations??[]).map((item,i)=><li key={i}>{item}</li>)}</ul>
      <div className="admin-principle"><AlertTriangle size={17}/><p>امتیاز واقعی هنوز صادر نشده است. کیفیت منابع، صحت مقررات، پوشش و انضباط شواهد باید با متن و مستندات گزارش ارزیابی شود؛ صرف وجود گزارش به معنی تأیید آن نیست.</p></div>
     </div>}
    </article>)}
    <div className="admin-principle" style={{marginTop:12}}><CheckCircle2 size={17}/><p>گزارش اول برای ارزیابی مستقیم مالک نمایش داده می‌شود. پس از این پایلوت، فقط موارد استثنایی و تصمیم‌های پرریسک به انسان ارجاع خواهند شد؛ اما هیچ گزارش فاقد شواهد معتبر به دانش تأییدشده SAI تبدیل نمی‌شود.</p></div>
   </div>
   <small style={{display:"block",marginTop:14,color:"var(--muted,#64748b)"}}>آخرین snapshot: {data?.generated_at?new Date(data.generated_at).toLocaleString("fa-IR"):"—"}</small>
  </>}
 </section>;
}
