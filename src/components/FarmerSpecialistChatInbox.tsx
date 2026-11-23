import {useCallback,useEffect,useMemo,useState} from "react";
import {ArrowDown,ArrowRight,CheckCheck,LoaderCircle,MessageCircle,RefreshCw,Search,Send} from "lucide-react";
import {supabase} from "../lib/supabase";

type Props={userId:string;mode:"farmer"|"expert";profileId?:string;verified?:boolean};
type Thread={id:string;requestId:string;subject:string;status:string;createdAt:string;consultationStatus:string;otherParty:string;assignmentStatus:string;unread:number};
type ChatMessage={id:string;sender_user_id:string;message_text:string|null;content_parts:any;created_at:string};
type SarinaMessage={id:string;message_text:string;status:string;created_at:string};
type CaseFact={id:string;fact_text:string;fact_kind:string;created_at:string};
const db=supabase as any;
const stamp=(value:string)=>new Date(value).toLocaleString("fa-IR",{dateStyle:"short",timeStyle:"short"});

export default function FarmerSpecialistChatInbox({userId,mode,profileId,verified=true}:Props){
 const [threads,setThreads]=useState<Thread[]>([]);
 const [notifications,setNotifications]=useState<any[]>([]);
 const [active,setActive]=useState<string|null>(null);
 const [messages,setMessages]=useState<ChatMessage[]>([]);
 const [sarinaMessages,setSarinaMessages]=useState<SarinaMessage[]>([]);
 const [askingSarina,setAskingSarina]=useState(false);
 const [caseFacts,setCaseFacts]=useState<CaseFact[]>([]);
 const [savingFactId,setSavingFactId]=useState<string|null>(null);
 const [planTitle,setPlanTitle]=useState("");
 const [planDescription,setPlanDescription]=useState("");
 const [creatingPlan,setCreatingPlan]=useState(false);
 const [draft,setDraft]=useState("");
 const [search,setSearch]=useState("");
 const [filter,setFilter]=useState<"all"|"unread">("all");
 const [loading,setLoading]=useState(true);
 const [loadingMessages,setLoadingMessages]=useState(false);
 const [loadingOlder,setLoadingOlder]=useState(false);
 const [sending,setSending]=useState(false);
 const [hasOlder,setHasOlder]=useState(false);
 const [notice,setNotice]=useState("");

 const refresh=useCallback(async()=>{
  if(!supabase||!userId)return;
  setLoading(true);
  try{
   const n=await db.from("expert_case_notifications").select("id,event_type,preview,created_at,read_at,request_id,consultation_id").eq("recipient_user_id",userId).eq("event_type","new_message").is("read_at",null).order("created_at",{ascending:false}).limit(1000);
   if(n.error)throw n.error;
   setNotifications(n.data||[]);
   let rows:any[]=[];
   if(mode==="farmer"){
    const r=await db.from("expert_requests").select("id,subject,status,created_at,expert_consultations(id,status,created_at),expert_request_assignments(assignment_status,expert_profiles(public_name))").eq("requester_user_id",userId).order("created_at",{ascending:false}).limit(100);
    if(r.error)throw r.error;
    rows=r.data||[];
   }else{
    if(!verified||!profileId){setThreads([]);setLoading(false);return;}
    const r=await db.from("expert_request_assignments").select("id,request_id,assignment_status,offered_at,expert_requests!inner(id,subject,status,created_at,expert_consultations(id,status,created_at))").eq("expert_profile_id",profileId).in("assignment_status",["offered","accepted"]).order("offered_at",{ascending:false}).limit(100);
    if(r.error)throw r.error;
    rows=r.data||[];
   }
   const mapped:Thread[]=[];
   for(const row of rows){
    const request=mode==="farmer"?row:row.expert_requests;
    if(!request)continue;
    const consultation=Array.isArray(request.expert_consultations)?request.expert_consultations[0]:request.expert_consultations;
    if(!consultation?.id)continue;
    const assignment=mode==="farmer"?(Array.isArray(request.expert_request_assignments)?request.expert_request_assignments[0]:request.expert_request_assignments):row;
    const expertName=assignment?.expert_profiles?.public_name||"متخصص SARINA";
    const unread=(n.data||[]).filter((item:any)=>item.consultation_id===consultation.id&&item.event_type==="new_message"&&!item.read_at).length;
    mapped.push({id:consultation.id,requestId:request.id,subject:request.subject||"گفت‌وگوی مشاوره",status:request.status||"active",createdAt:request.created_at||consultation.created_at,consultationStatus:consultation.status||"active",otherParty:mode==="farmer"?expertName:"کشاورز",assignmentStatus:assignment?.assignment_status||"accepted",unread});
   }
   mapped.sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
   setThreads(mapped);
  }catch(error){
   setNotice(error instanceof Error?error.message:"دریافت فهرست مکالمات انجام نشد.");
  }finally{setLoading(false);}
 },[userId,mode,profileId,verified]);

 useEffect(()=>{void refresh();},[refresh]);
 useEffect(()=>{
  const client=supabase;
  if(!client)return;
  const channel=client.channel("chat-inbox-notifications-"+mode+"-"+userId)
   .on("postgres_changes",{event:"*",schema:"public",table:"expert_case_notifications",filter:"recipient_user_id=eq."+userId},()=>{void refresh();})
   .subscribe();
  return()=>{void client.removeChannel(channel);};
 },[userId,mode,refresh]);

 const activeThread=threads.find(thread=>thread.id===active)||null;
 const visible=useMemo(()=>threads.filter(thread=>{
  const matches=(thread.subject+" "+thread.otherParty).toLowerCase().includes(search.toLowerCase());
  return matches&&(filter==="all"||thread.unread>0);
 }),[threads,search,filter]);
 const unreadTotal=threads.reduce((sum,thread)=>sum+thread.unread,0);

 const markConversationRead=useCallback(async(consultationId:string)=>{
  const unreadIds=notifications.filter(n=>n.consultation_id===consultationId&&n.event_type==="new_message"&&!n.read_at).map(n=>n.id);
  const now=new Date().toISOString();
  const {error}=await db.from("expert_case_notifications").update({read_at:now}).eq("recipient_user_id",userId).eq("consultation_id",consultationId).eq("event_type","new_message").is("read_at",null);
  if(error){setNotice("وضعیت خوانده‌شدن پیام‌ها ثبت نشد: "+error.message);return;}
  setNotifications(old=>old.map(n=>unreadIds.includes(n.id)?{...n,read_at:now}:n));
  setThreads(old=>old.map(t=>t.id===consultationId?{...t,unread:0}:t));
 },[notifications,userId]);

 const loadConversation=useCallback(async(consultationId:string)=>{
  if(!supabase)return;
  setActive(consultationId);setMessages([]);setSarinaMessages([]);setCaseFacts([]);setLoadingMessages(true);setNotice("");
  const {data,error}=await db.from("expert_consultation_messages").select("id,sender_user_id,message_text,content_parts,created_at").eq("consultation_id",consultationId).order("created_at",{ascending:false}).limit(50);
  setLoadingMessages(false);
  if(error){setNotice("دریافت پیام‌ها مجاز نبود یا با خطا روبه‌رو شد: "+error.message);return;}
  const chronological=(data||[]).reverse();
  setMessages(chronological);setHasOlder((data||[]).length===50);
  const ai=await db.from("expert_consultation_ai_messages").select("id,message_text,status,created_at").eq("consultation_id",consultationId).order("created_at",{ascending:true}).limit(100);
  if(ai.error)setNotice("پیام‌های سارینا بارگذاری نشد: "+ai.error.message);else setSarinaMessages(ai.data||[]);
  const factResult=await db.from("expert_case_conversation_facts").select("id,fact_text,fact_kind,created_at").eq("request_id",threads.find(t=>t.id===consultationId)?.requestId||"").eq("status","approved").order("created_at",{ascending:false}).limit(30);
  if(!factResult.error)setCaseFacts(factResult.data||[]);
  await markConversationRead(consultationId);
 },[markConversationRead,threads]);

 useEffect(()=>{
  const client=supabase;
  if(!client||!active)return;
  const channel=client.channel("chat-thread-"+active)
   .on("postgres_changes",{event:"INSERT",schema:"public",table:"expert_consultation_ai_messages",filter:"consultation_id=eq."+active},payload=>{
    const incoming=payload.new as SarinaMessage;
    setSarinaMessages(old=>old.some(item=>item.id===incoming.id)?old:[...old,incoming]);
   })
   .on("postgres_changes",{event:"INSERT",schema:"public",table:"expert_consultation_messages",filter:"consultation_id=eq."+active},payload=>{
    const incoming=payload.new as ChatMessage;
    setMessages(old=>old.some(item=>item.id===incoming.id)?old:[...old,incoming]);
    if(incoming.sender_user_id!==userId){void markConversationRead(active);void refresh();}
   }).subscribe();
  return()=>{void client.removeChannel(channel);};
 },[active,userId,markConversationRead,refresh]);

 async function saveCaseFact(message:ChatMessage){
  if(!active||!activeThread||mode!=="expert"||activeThread.assignmentStatus!=="accepted"||!verified||!message.message_text||savingFactId)return;
  setSavingFactId(message.id);setNotice("");
  const kind=message.sender_user_id===userId?"specialist_finding":"farmer_report";
  const {data,error}=await db.from("expert_case_conversation_facts").insert({
   request_id:activeThread.requestId,consultation_id:active,source_message_id:message.id,
   fact_text:message.message_text,fact_kind:kind,status:"approved",created_by:userId,
   reviewed_by:userId,reviewed_at:new Date().toISOString()
  }).select("id,fact_text,fact_kind,created_at").single();
  setSavingFactId(null);
  if(error){setNotice(error.code==="23505"?"این پیام قبلاً به‌عنوان واقعیت پرونده ثبت شده است.":"ثبت در پرونده انجام نشد: "+error.message);return;}
  setCaseFacts(old=>[data,...old]);setNotice("این پیام با تأیید شما به اطلاعات پرونده کشاورز افزوده شد.");
 }
 async function createImprovementPlan(event:React.FormEvent){
  event.preventDefault();
  if(!activeThread||mode!=="expert"||activeThread.assignmentStatus!=="accepted"||!verified||!planTitle.trim()||!planDescription.trim()||creatingPlan||!supabase)return;
  setCreatingPlan(true);setNotice("");
  const {data:request,error:requestError}=await db.from("expert_requests").select("farm_id,field_id").eq("id",activeThread.requestId).maybeSingle();
  if(requestError||!request?.farm_id){setCreatingPlan(false);setNotice("برای این پرونده مزرعهٔ متصل و قابل دسترسی پیدا نشد؛ برنامه ایجاد نشد.");return;}
  const {error}=await db.from("farm_improvement_plans").insert({
   farm_id:request.farm_id,field_id:request.field_id||null,title:planTitle.trim(),
   description:planDescription.trim(),priority:"normal",status:"active",origin:"expert",
   target_metrics:[],requires_expert_review:false,created_by:userId,
   source_request_id:activeThread.requestId,source_consultation_id:active
  });
  setCreatingPlan(false);
  if(error){setNotice("برنامه در برنامه‌ریز مزرعه ثبت نشد: "+error.message);return;}
  setPlanTitle("");setPlanDescription("");setNotice("برنامهٔ اجراییِ تأییدشده به برنامه‌های بهبود مزرعه متصل شد.");
 }
 async function loadOlder(){
  if(!active||!messages.length||loadingOlder)return;
  setLoadingOlder(true);
  const oldest=messages[0].created_at;
  const {data,error}=await db.from("expert_consultation_messages").select("id,sender_user_id,message_text,content_parts,created_at").eq("consultation_id",active).lt("created_at",oldest).order("created_at",{ascending:false}).limit(50);
  setLoadingOlder(false);
  if(error){setNotice("بارگذاری پیام‌های قدیمی‌تر انجام نشد: "+error.message);return;}
  const batch:ChatMessage[]=(data||[]).reverse() as ChatMessage[];
  setMessages(old=>[...batch,...old.filter(item=>!batch.some((next:ChatMessage)=>next.id===item.id))]);
  setHasOlder((data||[]).length===50);
 }

 async function sendMessage(event:React.FormEvent){
  event.preventDefault();
  const text=draft.trim();
  if(!active||!text||text.length>6000||sending||!supabase)return;
  setSending(true);setNotice("");
  const {error}=await db.from("expert_consultation_messages").insert({consultation_id:active,sender_user_id:userId,message_text:text,content_parts:[]});
  setSending(false);
  if(error){setNotice("پیام ارسال نشد؛ متن در کادر باقی مانده است. "+error.message);return;}
  setDraft("");
  setAskingSarina(true);
  const assistant=await supabase.functions.invoke("sarina-case-chat",{body:{consultation_id:active}});
  setAskingSarina(false);
  if(assistant.data?.message){setSarinaMessages(old=>old.some(item=>item.id===assistant.data.message.id)?old:[...old,assistant.data.message]);}
  else if(assistant.error||assistant.data?.ok===false){setNotice("پیام شما ارسال شد؛ اما سارینا نتوانست در این نوبت پاسخ دهد. گفت‌وگوی کشاورز و متخصص برقرار است.");}
  await refresh();
 }

 if(mode==="expert"&&!verified)return <section className="chat-inbox" dir="rtl"><div className="chat-empty"><MessageCircle size={28}/><b>دسترسی مکالمات پس از تأیید صلاحیت فعال می‌شود.</b><p>برای حفاظت از اطلاعات کشاورزان، حساب‌های تأییدنشده به محتوای مکالمات دسترسی ندارند.</p></div></section>;

 return <section className="chat-inbox" dir="rtl">
  <header className="chat-inbox-heading"><div><span className="eyebrow">{mode==="farmer"?"ارتباط انسانی با متخصصان":"ارتباط مستقیم با کشاورزان"}</span><h2>{mode==="farmer"?"گفت‌وگو با متخصصان":"مکالمات کشاورزان"}</h2><p>یک گفت‌وگوی مشترک میان کشاورز، متخصص پرونده و سارینا؛ همه پیام‌ها و پاسخ‌ها در همین پنجره و به‌ترتیب زمان نمایش داده می‌شوند.</p></div><div className="chat-inbox-count"><b>{unreadTotal.toLocaleString("fa-IR")}</b><small>پیام خوانده‌نشده</small></div></header>
  {notice&&<div className="notice">{notice}</div>}
  <div className="chat-inbox-layout">
   <aside className={"chat-thread-list"+(active?" mobile-hidden":"")}>
    <div className="chat-inbox-tools"><label><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="جست‌وجوی مکالمه..."/></label><button type="button" onClick={()=>void refresh()} aria-label="تازه‌سازی"><RefreshCw size={16}/></button></div>
    <div className="chat-filter-row"><button className={filter==="all"?"active":""} onClick={()=>setFilter("all")}>همه</button><button className={filter==="unread"?"active":""} onClick={()=>setFilter("unread")}>خوانده‌نشده‌ها</button></div>
    {loading?<div className="chat-empty"><LoaderCircle className="spin" size={22}/>در حال دریافت مکالمات...</div>:visible.length===0?<div className="chat-empty"><MessageCircle size={24}/><b>{filter==="unread"?"پیام خوانده‌نشده‌ای ندارید.":"هنوز مکالمه فعالی وجود ندارد."}</b><p>{mode==="farmer"?"برای آغاز ارتباط، از بخش مشاوره متخصصان درخواست ثبت کنید.":"با پذیرش پرونده و فعال‌شدن مشاوره، مکالمه اینجا نمایش داده می‌شود."}</p></div>:visible.map(thread=><button type="button" key={thread.id} className={"chat-thread"+(active===thread.id?" selected":"")} onClick={()=>void loadConversation(thread.id)}><span className="chat-thread-avatar"><UserIcon/></span><span className="chat-thread-copy"><b>{thread.otherParty}</b><strong>{thread.subject}</strong><small>{stamp(thread.createdAt)}</small></span>{thread.unread>0&&<i>{thread.unread.toLocaleString("fa-IR")}</i>}</button>)}
   </aside>
   <div className={"chat-conversation"+(!active?" mobile-hidden":"")}>
    {!activeThread?<div className="chat-empty chat-select-prompt"><MessageCircle size={34}/><b>یک مکالمه را انتخاب کنید</b><p>سوابق پیام و پاسخ متخصص در این بخش نمایش داده می‌شود.</p></div>:<>
     <header className="chat-conversation-head"><button className="chat-back" onClick={()=>setActive(null)}><ArrowRight size={17}/> مکالمات</button><div><b>{activeThread.otherParty}</b><small>{activeThread.subject} · پرونده مرتبط</small></div><span className="chat-secure-label"><CheckCheck size={14}/> کشاورز · متخصص · سارینا</span></header>
     <div className="chat-message-history">
      {caseFacts.length>0&&<section className="chat-case-facts"><b>اطلاعات تأییدشدهٔ پرونده</b>{caseFacts.map(fact=><article key={fact.id}><span>{fact.fact_kind==="specialist_finding"?"یافته متخصص":fact.fact_kind==="decision"?"تصمیم تأییدشده":fact.fact_kind==="follow_up"?"پیگیری":"گزارش کشاورز"}</span><p>{fact.fact_text}</p><small>{stamp(fact.created_at)}</small></article>)}</section>}
      {hasOlder&&<button className="chat-load-older" onClick={()=>void loadOlder()} disabled={loadingOlder}>{loadingOlder?<LoaderCircle size={14}/>:<ArrowDown size={14}/>} پیام‌های قدیمی‌تر</button>}
      {loadingMessages?<div className="chat-empty"><LoaderCircle className="spin"/>در حال دریافت پیام‌ها...</div>:messages.length===0&&sarinaMessages.length===0?<div className="chat-empty"><MessageCircle size={24}/><b>هنوز پیامی ارسال نشده است</b><p>می‌توانید گفت‌وگو را با یک پیام کوتاه آغاز کنید.</p></div>:<>{[...messages.map(message=>({...message,kind:"human" as const,sortAt:message.created_at})),...sarinaMessages.map(message=>({...message,kind:"sarina" as const,sortAt:message.created_at}))].sort((a,b)=>new Date(a.sortAt).getTime()-new Date(b.sortAt).getTime()).map(message=>message.kind==="sarina"?<article key={"sarina-"+message.id} className="chat-message chat-message-sarina"><b>سارینا <span>همراه هوشمند</span></b><p>{message.message_text}</p><small>{stamp(message.created_at)}{message.status==="unavailable"?" · اتصال هوش مصنوعی فعال نیست":" · پاسخ هوشمند؛ نیازمند تأیید متخصص برای تصمیم تخصصی"}</small></article>:<article key={message.id} className={"chat-message"+(message.sender_user_id===userId?" mine":"")}><b>{message.sender_user_id===userId?(mode==="farmer"?"شما · کشاورز":"شما · متخصص"):mode==="farmer"?"متخصص پرونده":"کشاورز"}</b><p>{message.message_text||"این پیام دارای محتوای پیوست‌شده است که در این نسخه نمایش داده نمی‌شود."}</p><small>{stamp(message.created_at)}</small>{mode==="expert"&&activeThread.assignmentStatus==="accepted"&&message.message_text&&<button type="button" className="chat-fact-save" disabled={savingFactId===message.id} onClick={()=>void saveCaseFact(message)}>{savingFactId===message.id?"در حال ثبت...":"ثبت پیام به‌عنوان اطلاعات پرونده"}</button>}</article>)}{askingSarina&&<article className="chat-message chat-message-sarina"><b>سارینا</b><p>در حال بررسی پیام‌های گفت‌وگو…</p></article>}</>}
     </div>
     {mode==="expert"&&activeThread.assignmentStatus==="accepted"&&<form className="chat-plan-create" onSubmit={createImprovementPlan}><b>ثبت برنامه اجرایی تأییدشده</b><input value={planTitle} onChange={e=>setPlanTitle(e.target.value)} placeholder="عنوان برنامه مزرعه" maxLength={160}/><textarea value={planDescription} onChange={e=>setPlanDescription(e.target.value)} placeholder="اقدام‌ها و زمان‌بندی تأییدشده توسط متخصص را بنویسید..." rows={2} maxLength={5000}/><button type="submit" disabled={creatingPlan||!planTitle.trim()||!planDescription.trim()}>{creatingPlan?"در حال ثبت...":"افزودن به برنامه بهبود مزرعه"}</button><small>فقط برنامه‌ای که متخصص مسئول تأیید کرده باشد در این بخش ثبت می‌شود.</small></form>}
     <form className="chat-compose" onSubmit={sendMessage}><textarea value={draft} onChange={e=>setDraft(e.target.value)} maxLength={6000} rows={2} placeholder="پیام خود را بنویسید..." disabled={sending}/><div><small>{draft.length.toLocaleString("fa-IR")}/۶۰۰۰ · ارسال متن</small><button type="submit" disabled={sending||!draft.trim()||draft.trim().length>6000}><Send size={16}/>{sending?"در حال ارسال...":"ارسال پیام"}</button></div></form>
    </>}
   </div>
  </div>
 </section>;
}

function UserIcon(){return <MessageCircle size={18}/>;}
