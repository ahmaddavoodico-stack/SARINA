import {useEffect,useMemo,useState} from "react";
import {ArrowLeft,CheckCircle2,MessageCircle,RefreshCw,Search,ShieldCheck,UserRound} from "lucide-react";
import {supabase} from "../lib/supabase";

type Expert={id:string;public_name:string;biography:string|null;years_experience:number|null;languages:any;country_id:string|null;availability?:{availability_status:string;pause_new_cases:boolean;status_note:string|null;vacation_start:string|null;vacation_end:string|null}};
type Farm={id:string;farm_name:string|null};
type Props={sarinaUserId:string};
const db=supabase as any;
export default function FarmerExpertWorkspace({sarinaUserId}:Props){
 const [experts,setExperts]=useState<Expert[]>([]),[farms,setFarms]=useState<Farm[]>([]),[specialties,setSpecialties]=useState<any[]>([]);
 const [selected,setSelected]=useState(""),[farmId,setFarmId]=useState(""),[subject,setSubject]=useState(""),[problem,setProblem]=useState(""),[category,setCategory]=useState(""),[filter,setFilter]=useState("");
 const [requests,setRequests]=useState<any[]>([]),[notifications,setNotifications]=useState<any[]>([]),[handovers,setHandovers]=useState<any[]>([]),[activeConsultation,setActiveConsultation]=useState<string|null>(null),[messages,setMessages]=useState<any[]>([]),[messageText,setMessageText]=useState(""),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[loading,setLoading]=useState(true);
 async function refresh(){
  if(!supabase)return;setLoading(true);
  const [e,f,c,r,n]=await Promise.all([
   db.from("expert_profiles").select("id,public_name,biography,years_experience,languages,country_id").eq("verification_status","verified").in("profile_visibility",["directory","public"]).order("public_name").limit(100),
   db.from("farms").select("id,farm_name").eq("owner_user_id",sarinaUserId).limit(100),
   db.from("expertise_categories").select("id,category_code,display_name").eq("is_active",true).order("display_name"),
   db.from("expert_requests").select("id,subject,problem_description,status,created_at,expert_consultations(id,status),expert_request_assignments(assignment_status,expert_profiles(public_name))").eq("requester_user_id",sarinaUserId).order("created_at",{ascending:false}).limit(30),
   db.from("expert_case_notifications").select("id,event_type,preview,created_at,read_at,request_id").eq("recipient_user_id",sarinaUserId).order("created_at",{ascending:false}).limit(30)
  ]);
  const errors=[e,f,c,r,n].filter(x=>x.error);
  if(errors.length)setNotice("برخی اطلاعات در دسترس نیستند: "+errors.map(x=>x.error.message).join(" · "));
  const availabilityRows=e.data?.length?await db.from("expert_availability").select("expert_profile_id,availability_status,pause_new_cases,status_note,vacation_start,vacation_end").in("expert_profile_id",e.data.map((x:Expert)=>x.id)):({data:[],error:null} as any);
  const availabilityMap=new Map((availabilityRows.data||[]).map((x:any)=>[x.expert_profile_id,x]));
  setExperts((e.data||[]).map((x:Expert)=>({...x,availability:availabilityMap.get(x.id)})));setFarms(f.data||[]);setSpecialties(c.data||[]);setRequests(r.data||[]);setNotifications(n.data||[]);
  const h=await db.from("expert_case_handovers").select("id,request_id,status,reason,initiated_at,from_expert_profile_id,to_expert_profile_id,from_expert:expert_profiles!expert_case_handovers_from_expert_profile_id_fkey(public_name),to_expert:expert_profiles!expert_case_handovers_to_expert_profile_id_fkey(public_name)").eq("requester_user_id",sarinaUserId).eq("status","awaiting_farmer_consent").order("initiated_at",{ascending:false});
  if(h.error)setNotice(old=>old||"درخواست‌های تغییر متخصص در دسترس نیست: "+h.error.message);setHandovers(h.data||[]);
  if(!farmId&&f.data?.[0])setFarmId(f.data[0].id);
  setLoading(false);
 }
 useEffect(()=>{void refresh();},[sarinaUserId]);
 useEffect(()=>{const client=supabase;if(!client||!activeConsultation)return;const channel=client.channel("farmer-consultation-"+activeConsultation).on("postgres_changes",{event:"INSERT",schema:"public",table:"expert_consultation_messages",filter:"consultation_id=eq."+activeConsultation},payload=>setMessages(old=>old.some(m=>m.id===(payload.new as any).id)?old:[...old,payload.new])).subscribe();return()=>{void client.removeChannel(channel);};},[activeConsultation]);
 useEffect(()=>{
  const client=supabase;if(!client)return;
  const channel=client.channel("farmer-expert-notifications-"+sarinaUserId)
   .on("postgres_changes",{event:"*",schema:"public",table:"expert_case_notifications",filter:"recipient_user_id=eq."+sarinaUserId},()=>{void refresh();})
   .subscribe();
  return()=>{void client.removeChannel(channel);};
 },[sarinaUserId]);
 const visible=useMemo(()=>experts.filter(e=>{
  const s=[e.public_name,e.biography||"",...(e.languages||[])].join(" ").toLowerCase();
  return s.includes(filter.toLowerCase());
 }),[experts,filter]);
 const unread=notifications.filter(n=>!n.read_at).length;
 const selectedExpert=experts.find(e=>e.id===selected);
 const expertUnavailable=(e?:Expert)=>{if(!e?.availability)return false;const now=Date.now();const vacationActive=!!e.availability.vacation_start&&now>=new Date(e.availability.vacation_start).getTime()&&(!e.availability.vacation_end||now<=new Date(e.availability.vacation_end).getTime());const awayWithoutExpiry=e.availability.availability_status==="away"&&!e.availability.vacation_end;return e.availability.pause_new_cases||vacationActive||awayWithoutExpiry;};
 async function submit(e:React.FormEvent){
  e.preventDefault();if(!selected||!farmId||!subject.trim()||!problem.trim()||!supabase)return;
  setBusy(true);setNotice("");
  try{
   const {data:req,error}=await db.from("expert_requests").insert({
    requester_user_id:sarinaUserId,farm_id:farmId,assigned_expert_profile_id:selected,
    subject:subject.trim(),problem_description:problem.trim(),request_type:category||"general",
    priority:"normal",status:"submitted",preferred_language:document.documentElement.lang||"fa",
    requested_mode:"in_app_message",consent_at:new Date().toISOString(),
    consent_scope:{farm_context:true,problem_description:true,expert_consultation:true,attachments:false},
    consented_context_snapshot:{source:"farmer_expert_directory",captured_at:new Date().toISOString()}
   }).select("id").single();
   if(error)throw error;
   const {error:assignmentError}=await db.from("expert_request_assignments").insert({request_id:req.id,expert_profile_id:selected,assignment_status:"offered"});
   if(assignmentError)throw assignmentError;
   const {error:consultationError}=await db.from("expert_consultations").insert({request_id:req.id,consultation_mode:"in_app_message",status:"scheduled"});
   if(consultationError)throw consultationError;
   setNotice("درخواست مشاوره ثبت شد و برای کارشناس ارسال گردید. پس از پاسخ او، گفت‌وگو در پرونده فعال می‌شود.");
   setSubject("");setProblem("");setSelected("");await refresh();
  }catch(err){setNotice(err instanceof Error?err.message:"ثبت درخواست مشاوره انجام نشد.");}
  finally{setBusy(false);}
 }
 async function openConversation(requestId:string){if(!supabase)return;const {data,error}=await db.from("expert_consultations").select("id").eq("request_id",requestId).order("created_at",{ascending:false}).limit(1).maybeSingle();if(error){setNotice(error.message);return;}if(!data?.id){setNotice("گفت‌وگوی این پرونده هنوز ایجاد نشده است.");return;}const {data:items,error:messageError}=await db.from("expert_consultation_messages").select("id,sender_user_id,message_text,created_at").eq("consultation_id",data.id).order("created_at",{ascending:true}).limit(100);if(messageError){setNotice(messageError.message);return;}setActiveConsultation(data.id);setMessages(items||[]);}
 async function sendFarmerMessage(e:React.FormEvent){e.preventDefault();if(!supabase||!activeConsultation||!messageText.trim())return;const {error}=await db.from("expert_consultation_messages").insert({consultation_id:activeConsultation,sender_user_id:sarinaUserId,message_text:messageText.trim(),content_parts:[]});if(error){setNotice(error.message);return;}setMessageText("");}
 async function markRead(id:string){const {error}=await db.from("expert_case_notifications").update({read_at:new Date().toISOString()}).eq("id",id);if(error)setNotice(error.message);else setNotifications(old=>old.map(n=>n.id===id?{...n,read_at:new Date().toISOString()}:n));}
 async function respondHandover(id:string,accept:boolean){if(!supabase)return;setBusy(true);setNotice("");const {error}=await db.rpc("respond_to_expert_case_handover",{p_handover_id:id,p_accept:accept});setBusy(false);if(error){setNotice(error.message);return;}setNotice(accept?"رضایت شما ثبت شد؛ اکنون متخصص جایگزین باید ارجاع را بپذیرد.":"درخواست جایگزینی رد شد و پرونده نزد متخصص فعلی باقی می‌ماند.");await refresh();}
 return <section className="farmer-expert-workspace" dir="rtl">
  <div className="page-heading"><span className="eyebrow">شبکه متخصصان تأییدشده</span><h1>مشاوره تخصصی کشاورزی</h1><p>متخصص موردنیازتان را پیدا کنید، درخواست بفرستید و مسیر پرونده را در SARINA پیگیری کنید.</p></div>
  {notice&&<div className="notice">{notice}</div>}
  <div className="expert-directory-layout">
   <div className="expert-directory-main">
    <div className="search-box"><Search size={18}/><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="جست‌وجوی نام، حوزه فعالیت یا زبان کارشناس..."/></div>
    {loading?<div className="empty-state">در حال دریافت فهرست متخصصان...</div>:visible.length===0?<div className="empty-state"><UserRound/><strong>متخصص تأییدشده‌ای برای نمایش پیدا نشد</strong><p>با تکمیل و تأیید پروفایل متخصصان، فهرست این بخش فعال می‌شود.</p></div>:<div className="service-grid">{visible.map(ex=><article className="service-card" key={ex.id}>
      <div className="service-top"><UserRound size={20}/><span className="verified"><ShieldCheck size={14}/> تأیید صلاحیت</span></div>
      <h3>{ex.public_name}</h3><p>{ex.biography||"معرفی تخصصی هنوز تکمیل نشده است."}</p>
      <div className="service-meta"><span>{ex.years_experience??"—"} سال سابقه</span><span>{(ex.languages||[]).join("، ")||"زبان اعلام‌نشده"}</span></div>
      <button className="expert-primary" onClick={()=>setSelected(ex.id)}>انتخاب برای مشاوره <ArrowLeft size={15}/></button>
    </article>)}</div>}
   </div>
   <aside className="expert-request-panel"><h2>ثبت درخواست مشاوره</h2><p>اطلاعات مزرعه و شرح مسئله فقط برای پرونده مشاوره انتخاب‌شده به اشتراک گذاشته می‌شود.</p>
    <form onSubmit={submit}>
     <label>کارشناس منتخب<select required value={selected} onChange={e=>setSelected(e.target.value)}><option value="">انتخاب کارشناس</option>{experts.map(e=><option key={e.id} value={e.id}>{e.public_name}</option>)}</select></label>
     <label>مزرعه مرتبط<select required value={farmId} onChange={e=>setFarmId(e.target.value)}><option value="">انتخاب مزرعه</option>{farms.map(f=><option key={f.id} value={f.id}>{f.farm_name||"مزرعه بدون نام"}</option>)}</select></label>
     <label>حوزه درخواست<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">عمومی</option>{specialties.map(s=><option key={s.id} value={s.category_code}>{s.display_name}</option>)}</select></label>
     <label>موضوع<input required minLength={4} maxLength={160} value={subject} onChange={e=>setSubject(e.target.value)} placeholder="مثلاً بررسی زردی برگ‌های نخل"/></label>
     <label>شرح مسئله<textarea required minLength={10} maxLength={6000} rows={5} value={problem} onChange={e=>setProblem(e.target.value)} placeholder="علائم، زمان شروع و اقدام‌هایی که انجام داده‌اید..."/></label>
     <div className="secure-note"><CheckCircle2 size={15}/> با ارسال درخواست، رضایت شما برای اشتراک همین اطلاعات با کارشناس منتخب ثبت می‌شود.</div>
     <button className="expert-primary" disabled={busy||!farms.length||expertUnavailable(selectedExpert)}>{busy?"در حال ارسال...":expertUnavailable(selectedExpert)?"متخصص فعلاً پرونده نمی‌پذیرد":"ارسال درخواست مشاوره"} <ArrowLeft size={16}/></button>
     {!farms.length&&<small>برای ثبت درخواست ابتدا یک مزرعه در بخش «مزارع من» ثبت کنید.</small>}
    </form>
   </aside>
  </div>
  <div className="section-title"><div><span className="eyebrow">پیگیری پرونده‌ها</span><h2>درخواست‌های من</h2></div><button className="expert-link" onClick={()=>void refresh()}><RefreshCw size={15}/> تازه‌سازی</button></div>
  <div className="request-list">{requests.length===0?<div className="empty-state">هنوز درخواست مشاوره‌ای ثبت نشده است.</div>:requests.map(r=><article className="request-row" key={r.id}><MessageCircle size={20}/><div><strong>{r.subject}</strong><small>{new Date(r.created_at).toLocaleDateString("fa-IR")}</small></div><span>{r.status==="submitted"?"ارسال‌شده":r.status==="assigned"?"ارجاع‌شده":r.status}</span><small>{r.expert_request_assignments?.[0]?.expert_profiles?.public_name||"کارشناس منتخب"}</small><button onClick={()=>void openConversation(r.id)}>گفت‌وگو</button></article>)}</div>
  {activeConsultation&&<section className="expert-request-panel farmer-chat-panel"><h2>گفت‌وگوی پرونده</h2><div className="farmer-chat-messages">{messages.map(m=><article key={m.id} className={m.sender_user_id===sarinaUserId?"mine":"theirs"}><p>{m.message_text||"پیام پیوست‌دار"}</p><small>{new Date(m.created_at).toLocaleString("fa-IR")}</small></article>)}</div><form onSubmit={sendFarmerMessage}><textarea rows={2} value={messageText} onChange={e=>setMessageText(e.target.value)} placeholder="پیام خود را بنویسید..." required/><button className="expert-primary" disabled={busy||!messageText.trim()}>ارسال پیام</button></form></section>}
  <div className="section-title"><div><span className="eyebrow">اعلان‌های پرونده</span><h2>پیام‌ها و تغییر وضعیت‌ها {unread>0&&<span className="live-dot">{unread} جدید</span>}</h2></div></div>
  <div className="request-list">{notifications.length===0?<div className="empty-state">اعلانی ندارید.</div>:notifications.map(n=><article className="request-row" key={n.id}><BellIcon/><div><strong>{n.preview||"به‌روزرسانی پرونده"}</strong><small>{new Date(n.created_at).toLocaleString("fa-IR")}</small></div>{!n.read_at&&<button onClick={()=>void markRead(n.id)}>خواندم</button>}</article>)}</div>
  {handovers.length>0&&<section className="expert-request-panel farmer-handover-panel"><h2>درخواست تأیید جایگزینی متخصص</h2><p>متخصص فعلی درخواست کرده پرونده شما به متخصص تأییدشده دیگری واگذار شود. انتقال فقط با رضایت شما و پذیرش متخصص جدید انجام می‌شود.</p>{handovers.map(h=><article className="request-row" key={h.id}><div><strong>{requests.find(r=>r.id===h.request_id)?.subject||"پرونده مشاوره"}</strong><small>متخصص فعلی: {h.from_expert?.public_name||"متخصص فعلی"} · جایگزین پیشنهادی: {h.to_expert?.public_name||"متخصص تأییدشده"}</small><small>{h.reason||"دلیل دیگری ثبت نشده است"}</small></div><div className="farmer-handover-actions"><button className="expert-primary" disabled={busy} onClick={()=>void respondHandover(h.id,true)}>تأیید جایگزینی</button><button className="expert-link" disabled={busy} onClick={()=>void respondHandover(h.id,false)}>رد درخواست</button></div></article>)}</section>}
 </section>;
}
function BellIcon(){return <MessageCircle size={19}/>;}
