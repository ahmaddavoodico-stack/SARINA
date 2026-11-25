import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import type {ReactNode} from "react";
import {ArrowDown,ArrowRight,CheckCheck,FileText,LoaderCircle,MessageCircle,Mic,Paperclip,RefreshCw,Search,Send,Square} from "lucide-react";
import {supabase} from "../lib/supabase";

type Props={userId:string;mode:"farmer"|"expert";profileId?:string;verified?:boolean;compact?:boolean;afterComposer?:ReactNode};
type Thread={id:string;requestId:string;subject:string;status:string;createdAt:string;consultationStatus:string;otherParty:string;assignmentStatus:string;unread:number};
type ChatMessage={id:string;sender_user_id:string;message_text:string|null;content_parts:any;created_at:string};
type SarinaMessage={id:string;message_text:string;status:string;created_at:string};
type CaseFact={id:string;fact_text:string;fact_kind:string;created_at:string};
type ExpertRecommendation={id:string;title:string;instructions:string;priority:string;starts_on:string;due_on:string|null;status:string;approved_at:string;created_at:string;farmer_note:string|null};
const db=supabase as any;
const stamp=(value:string)=>new Date(value).toLocaleString("fa-IR",{dateStyle:"short",timeStyle:"short"});
const dayStamp=(value:string)=>new Date(value+"T00:00:00").toLocaleDateString("fa-IR");
const recommendationStatus=(value:string)=>({approved:"تأییدشده و آماده اجرا",in_progress:"در حال اجرا",completed:"تکمیل‌شده",needs_review:"در انتظار بازبینی متخصص"} as Record<string,string>)[value]||"وضعیت نامشخص";
const recommendationPriority=(value:string)=>({urgent:"فوری",high:"بالا",normal:"عادی",low:"کم"} as Record<string,string>)[value]||"ثبت‌شده";

export default function FarmerSpecialistChatInbox({userId,mode,profileId,verified=true,compact=false,afterComposer}:Props){
 const [threads,setThreads]=useState<Thread[]>([]);
 const [notifications,setNotifications]=useState<any[]>([]);
 const [active,setActive]=useState<string|null>(null);
 const [messages,setMessages]=useState<ChatMessage[]>([]);
 const [sarinaMessages,setSarinaMessages]=useState<SarinaMessage[]>([]);
 const [askingSarina,setAskingSarina]=useState(false);
 const [caseFacts,setCaseFacts]=useState<CaseFact[]>([]);
 const [recommendations,setRecommendations]=useState<ExpertRecommendation[]>([]);
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
 const [historyOpen,setHistoryOpen]=useState(false);
 const [attachmentUrls,setAttachmentUrls]=useState<Record<string,string>>({});
 const [uploading,setUploading]=useState(false);
 const [recording,setRecording]=useState(false);
 const fileInputRef=useRef<HTMLInputElement|null>(null);
 const mediaRecorderRef=useRef<MediaRecorder|null>(null);
 const mediaStreamRef=useRef<MediaStream|null>(null);

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
  setActive(consultationId);setMessages([]);setSarinaMessages([]);setCaseFacts([]);setRecommendations([]);setLoadingMessages(true);setNotice("");
  const {data,error}=await db.from("expert_consultation_messages").select("id,sender_user_id,message_text,content_parts,created_at").eq("consultation_id",consultationId).order("created_at",{ascending:false}).limit(50);
  setLoadingMessages(false);
  if(error){setNotice("دریافت پیام‌ها مجاز نبود یا با خطا روبه‌رو شد: "+error.message);return;}
  const chronological=(data||[]).reverse();
  setMessages(chronological);setHasOlder((data||[]).length===50);
  const parts=chronological.flatMap((message:ChatMessage)=>Array.isArray(message.content_parts)?message.content_parts:[]);
  const signed=await Promise.all(parts.filter((part:any)=>part?.storage_bucket&&part?.storage_path).map(async(part:any)=>{
   const {data}=await db.storage.from(part.storage_bucket).createSignedUrl(part.storage_path,3600);
   return data?.signedUrl?[[part.storage_path,data.signedUrl] as const]:[];
  }));
  setAttachmentUrls(current=>({...current,...Object.fromEntries(signed.flat())}));
  const ai=await db.from("expert_consultation_ai_messages").select("id,message_text,status,created_at").eq("consultation_id",consultationId).order("created_at",{ascending:true}).limit(100);
  if(ai.error)setNotice("پیام‌های سارینا بارگذاری نشد: "+ai.error.message);else setSarinaMessages(ai.data||[]);
  const requestId=threads.find(t=>t.id===consultationId)?.requestId||"";
  const factResult=await db.from("expert_case_conversation_facts").select("id,fact_text,fact_kind,created_at").eq("request_id",requestId).eq("status","approved").order("created_at",{ascending:false}).limit(30);
  if(!factResult.error)setCaseFacts(factResult.data||[]);
  const recommendationResult=await db.from("expert_recommendation_actions").select("id,title,instructions,priority,starts_on,due_on,status,approved_at,created_at,farmer_note").eq("request_id",requestId).order("approved_at",{ascending:false}).limit(50);
  if(!recommendationResult.error)setRecommendations(recommendationResult.data||[]);
  await markConversationRead(consultationId);
 },[markConversationRead,threads]);

 useEffect(()=>{if(compact&&mode==="farmer"&&!active&&threads.length>0){void loadConversation(threads[0].id);}},[compact,mode,active,threads,loadConversation]);

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
   })
   .on("postgres_changes",{event:"*",schema:"public",table:"expert_recommendation_actions",filter:"request_id=eq."+(activeThread?.requestId||"")},()=>{
    if(activeThread?.requestId)void db.from("expert_recommendation_actions").select("id,title,instructions,priority,starts_on,due_on,status,approved_at,created_at,farmer_note").eq("request_id",activeThread.requestId).order("approved_at",{ascending:false}).limit(50).then(({data,error}:any)=>{if(!error)setRecommendations(data||[]);});
   }).subscribe();
  return()=>{void client.removeChannel(channel);};
 },[active,activeThread?.requestId,userId,markConversationRead,refresh]);

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
  const {error}=await db.from("farm_improvement_plans").upsert({
   farm_id:request.farm_id,field_id:request.field_id||null,title:planTitle.trim(),
   description:planDescription.trim(),priority:"normal",status:"active",origin:"expert",
   target_metrics:[],requires_expert_review:false,created_by:userId,
   source_request_id:activeThread.requestId,source_consultation_id:active
  },{onConflict:"source_request_id"});
  setCreatingPlan(false);
  if(error){setNotice("برنامه در برنامه‌ریز مزرعه ثبت نشد: "+error.message);return;}
  setPlanTitle("");setPlanDescription("");setNotice("برنامهٔ اجراییِ تأییدشده ایجاد یا به‌روزرسانی شد.");
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

 async function runSarinaReply(){
  if(!active||!supabase)return;
  setAskingSarina(true);
  const assistant=await supabase.functions.invoke("sarina-case-chat",{body:{consultation_id:active}});
  setAskingSarina(false);
  if(assistant.data?.message)setSarinaMessages(old=>old.some(item=>item.id===assistant.data.message.id)?old:[...old,assistant.data.message]);
  else if(assistant.error||assistant.data?.ok===false)setNotice("پیام ارسال شد؛ اما سارینا نتوانست در این نوبت پاسخ دهد.");
  await refresh();
 }
 async function uploadAndSend(file:File|Blob,kind:"image"|"document"|"audio"){
  if(!active||!supabase||uploading)return;
  const mime=(file.type||"application/octet-stream").split(";")[0];
  const allowed=kind==="image"?["image/jpeg","image/png","image/webp"]:kind==="document"?["application/pdf"]:["audio/webm","audio/ogg","audio/mp4","audio/mpeg","audio/wav","audio/x-wav","audio/aac","audio/3gpp","audio/3gpp2","audio/flac"];
  const max=kind==="audio"?20*1024*1024:10*1024*1024;
  if(!allowed.includes(mime)){setNotice("قالب این فایل پشتیبانی نمی‌شود.");return;}
  if(file.size<1||file.size>max){setNotice("حجم فایل از حد مجاز بیشتر است.");return;}
  setUploading(true);setNotice("");
  const ext=mime==="image/jpeg"?"jpg":mime==="image/png"?"png":mime==="image/webp"?"webp":mime==="application/pdf"?"pdf":mime==="audio/webm"?"webm":mime==="audio/ogg"?"ogg":mime==="audio/mp4"?"m4a":mime==="audio/mpeg"?"mp3":mime==="audio/wav"||mime==="audio/x-wav"?"wav":mime==="audio/aac"?"aac":mime==="audio/3gpp"?"3gp":mime==="audio/3gpp2"?"3g2":"flac";
  const bucket=kind==="audio"?"expert-voice-notes":"expert-chat-attachments";
  const path=active+"/"+userId+"/"+Date.now()+"-"+Math.random().toString(36).slice(2,9)+"."+ext;
  const {error:uploadError}=await db.storage.from(bucket).upload(path,file,{contentType:mime,upsert:false});
  if(uploadError){setUploading(false);setNotice("بارگذاری فایل انجام نشد: "+uploadError.message);return;}
  const contentPart={type:kind,storage_bucket:bucket,storage_path:path,mime_type:mime,size_bytes:file.size,file_name:kind==="audio"?"پیام صوتی."+ext:(file instanceof File?file.name:"تصویر."+ext)};
  const caption=draft.trim()||null;
  const {error}=await db.from("expert_consultation_messages").insert({consultation_id:active,sender_user_id:userId,message_text:caption,content_parts:[contentPart]});
  setUploading(false);
  if(error){await db.storage.from(bucket).remove([path]);setNotice("فایل بارگذاری شد اما ثبت پیام انجام نشد: "+error.message);return;}
  setDraft("");
  await loadConversation(active);
  await runSarinaReply();
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
  await runSarinaReply();
 }
 async function startVoiceRecording(){
  if(!active||recording||uploading)return;
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==="undefined"){setNotice("ضبط صدا در این مرورگر پشتیبانی نمی‌شود.");return;}
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:true});
   mediaStreamRef.current=stream;
   const candidates=["audio/webm","audio/ogg","audio/mp4"];
   const mimeType=candidates.find(type=>MediaRecorder.isTypeSupported(type));
   const recorder=new MediaRecorder(stream,mimeType?{mimeType}:undefined);
   const chunks:BlobPart[]=[];
   recorder.ondataavailable=event=>{if(event.data.size>0)chunks.push(event.data);};
   recorder.onerror=()=>setNotice("ضبط صدا با خطا روبه‌رو شد.");
   recorder.onstop=()=>{
    const blob=new Blob(chunks,{type:recorder.mimeType||"audio/webm"});
    stream.getTracks().forEach(track=>track.stop());mediaStreamRef.current=null;mediaRecorderRef.current=null;setRecording(false);
    if(blob.size>0)void uploadAndSend(blob,"audio");
   };
   mediaRecorderRef.current=recorder;recorder.start();setRecording(true);setNotice("در حال ضبط پیام صوتی؛ برای پایان، دکمه توقف را بزنید.");
  }catch(error){setNotice(error instanceof Error?error.message:"اجازه دسترسی به میکروفن داده نشد.");}
 }
 function stopVoiceRecording(){mediaRecorderRef.current?.stop();}

 if(mode==="farmer"&&compact){
  const rendered=[...messages.map(message=>({...message,kind:"human" as const,sortAt:message.created_at})),...sarinaMessages.map(message=>({...message,kind:"sarina" as const,sortAt:message.created_at}))].sort((a,b)=>new Date(a.sortAt).getTime()-new Date(b.sortAt).getTime());
  const currentThread=activeThread;
  return <section className="chat-inbox chat-inbox-embedded" dir="rtl">
   {notice&&<div className="notice">{notice}</div>}
   <div className="chat-embedded-stream">
    {currentThread?<><div className="chat-embedded-topic"><span><MessageCircle size={15}/></span><div><b>{currentThread.subject}</b><small>{currentThread.otherParty} · گفت‌وگوی پرونده</small></div><span className="chat-secure-label"><CheckCheck size={13}/> امن</span></div>
     <div className="chat-message-history chat-embedded-history">
      {caseFacts.length>0&&<section className="chat-case-facts"><b>اطلاعات تأییدشده پرونده</b>{caseFacts.map(fact=><article key={fact.id}><span>{fact.fact_kind==="specialist_finding"?"یافته متخصص":fact.fact_kind==="decision"?"تصمیم تأییدشده":fact.fact_kind==="follow_up"?"پیگیری":"گزارش کشاورز"}</span><p>{fact.fact_text}</p><small>{stamp(fact.created_at)}</small></article>)}</section>}{mode==="farmer"&&recommendations.length>0&&<section className="chat-case-facts chat-approved-recommendations"><b>توصیه‌های تأییدشده متخصص</b>{recommendations.map(item=><article key={item.id}><span>اولویت {recommendationPriority(item.priority)} · {recommendationStatus(item.status)}</span><strong>{item.title}</strong><p>{item.instructions}</p><small>شروع اجرا: {dayStamp(item.starts_on)}{item.due_on?" · مهلت: "+dayStamp(item.due_on):""} · تأیید: {stamp(item.approved_at)}</small>{item.farmer_note&&<small>یادداشت کشاورز: {item.farmer_note}</small>}</article>)}</section>}
      {hasOlder&&<button className="chat-load-older" onClick={()=>void loadOlder()} disabled={loadingOlder}>{loadingOlder?<LoaderCircle size={14}/>:<ArrowDown size={14}/>} پیام‌های قدیمی‌تر</button>}
      {loadingMessages?<div className="chat-empty"><LoaderCircle className="spin"/>در حال دریافت پیام‌ها...</div>:rendered.length===0?<div className="chat-empty"><MessageCircle size={22}/><b>هنوز پیامی در این پرونده نیست</b><p>پیام خود را در کادر پایین بنویسید.</p></div>:rendered.map(message=>{
       if(message.kind==="sarina")return <article key={"sarina-"+message.id} className="chat-message chat-message-sarina"><b>سارینا <span>همراه هوشمند</span></b><p>{message.message_text}</p><small>{stamp(message.created_at)}{message.status==="unavailable"?" · پاسخ هوشمند در دسترس نیست":""}</small></article>;
       const parts=Array.isArray(message.content_parts)?message.content_parts:[];
       return <article key={message.id} className={"chat-message"+(message.sender_user_id===userId?" mine":"")}><b>{message.sender_user_id===userId?"شما": "متخصص پرونده"}</b>{message.message_text&&<p>{message.message_text}</p>}{parts.map((part:any,index:number)=><div className="chat-attachment" key={message.id+"-"+index}>{part.type==="image"&&attachmentUrls[part.storage_path]?<a href={attachmentUrls[part.storage_path]} target="_blank" rel="noreferrer"><img src={attachmentUrls[part.storage_path]} alt={part.file_name||"تصویر پیوست"} /></a>:part.type==="audio"&&attachmentUrls[part.storage_path]?<audio controls preload="none" src={attachmentUrls[part.storage_path]}/>:<a href={attachmentUrls[part.storage_path]||"#"} target="_blank" rel="noreferrer"><FileText size={17}/>{part.file_name||"فایل پیوست"}</a>}</div>)}<small>{stamp(message.created_at)}</small></article>;
      })}
      {askingSarina&&<article className="chat-message chat-message-sarina"><b>سارینا</b><p>در حال بررسی پیام‌ها…</p></article>}
     </div>
    </>:<div className="chat-embedded-empty"><MessageCircle size={24}/><b>{loading?"در حال بررسی مکالمات…":"هنوز گفت‌وگوی فعالی ندارید"}</b><small>برای شروع گفت‌وگوی پرونده‌ای، می‌توانید متخصص اضافه کنید.</small></div>}
    <form className="chat-compose chat-compose-embedded" onSubmit={sendMessage}>
     <textarea value={draft} onChange={e=>setDraft(e.target.value)} maxLength={6000} rows={2} placeholder={currentThread?"پیام خود را برای سارینا و متخصص بنویسید…":"پس از ایجاد پرونده، اینجا پیام بنویسید…"} disabled={!currentThread||sending||uploading}/>
     <div className="chat-compose-toolbar">
      <div className="chat-compose-tools">
       <button type="button" title="افزودن تصویر یا PDF" aria-label="افزودن تصویر یا PDF" disabled={!currentThread||uploading} onClick={()=>fileInputRef.current?.click()}><Paperclip size={17}/></button>
       <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden onChange={e=>{const file=e.target.files?.[0];if(file)void uploadAndSend(file,file.type==="application/pdf"?"document":"image");e.currentTarget.value="";}}/>
       {recording?<button type="button" className="recording" onClick={stopVoiceRecording} title="پایان ضبط"><Square size={15}/></button>:<button type="button" title="ضبط پیام صوتی" aria-label="ضبط پیام صوتی" disabled={!currentThread||uploading} onClick={()=>void startVoiceRecording()}><Mic size={17}/></button>}
       <small>{recording?"در حال ضبط":uploading?"در حال بارگذاری…":"تصویر، PDF یا پیام صوتی"}</small>
      </div>
      <button type="submit" disabled={!currentThread||sending||uploading||!draft.trim()}><Send size={16}/>{sending?"در حال ارسال…":"ارسال"}</button>
     </div>
     {draft.trim()&&<small className="chat-compose-count">{draft.length.toLocaleString("fa-IR")}/۶۰۰۰</small>}
    </form>
   </div>
   {afterComposer}
   <details className="chat-history-dashboard" open={historyOpen} onToggle={event=>setHistoryOpen((event.currentTarget as HTMLDetailsElement).open)}>
    <summary><span><MessageCircle size={16}/><b>سوابق مکالمات</b><small>{threads.length.toLocaleString("fa-IR")} پرونده</small></span><span className="chat-history-summary-end">{unreadTotal>0&&<i>{unreadTotal.toLocaleString("fa-IR")} خوانده‌نشده</i>}<ArrowDown size={15}/></span></summary>
    <div className="chat-history-content">
     <div className="chat-inbox-tools"><label><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="جست‌وجوی سوابق…"/></label><button type="button" onClick={()=>void refresh()} aria-label="تازه‌سازی"><RefreshCw size={15}/></button></div>
     {loading?<div className="chat-empty"><LoaderCircle className="spin"/>در حال دریافت سوابق…</div>:visible.length===0?<div className="chat-empty"><b>مکالمه‌ای برای نمایش نیست</b></div>:visible.map(thread=><button type="button" key={thread.id} className={"chat-history-item"+(active===thread.id?" selected":"")} onClick={()=>void loadConversation(thread.id)}><span className="chat-thread-avatar"><MessageCircle size={16}/></span><span><b>{thread.subject}</b><small>{thread.otherParty} · {stamp(thread.createdAt)}</small></span>{thread.unread>0&&<i>{thread.unread.toLocaleString("fa-IR")}</i>}</button>)}
    </div>
   </details>
  </section>;
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
      {caseFacts.length>0&&<section className="chat-case-facts"><b>اطلاعات تأییدشدهٔ پرونده</b>{caseFacts.map(fact=><article key={fact.id}><span>{fact.fact_kind==="specialist_finding"?"یافته متخصص":fact.fact_kind==="decision"?"تصمیم تأییدشده":fact.fact_kind==="follow_up"?"پیگیری":"گزارش کشاورز"}</span><p>{fact.fact_text}</p><small>{stamp(fact.created_at)}</small></article>)}</section>}{mode==="farmer"&&recommendations.length>0&&<section className="chat-case-facts chat-approved-recommendations"><b>توصیه‌های تأییدشده متخصص</b>{recommendations.map(item=><article key={item.id}><span>اولویت {recommendationPriority(item.priority)} · {recommendationStatus(item.status)}</span><strong>{item.title}</strong><p>{item.instructions}</p><small>شروع اجرا: {dayStamp(item.starts_on)}{item.due_on?" · مهلت: "+dayStamp(item.due_on):""} · تأیید: {stamp(item.approved_at)}</small>{item.farmer_note&&<small>یادداشت کشاورز: {item.farmer_note}</small>}</article>)}</section>}
      {hasOlder&&<button className="chat-load-older" onClick={()=>void loadOlder()} disabled={loadingOlder}>{loadingOlder?<LoaderCircle size={14}/>:<ArrowDown size={14}/>} پیام‌های قدیمی‌تر</button>}
      {loadingMessages?<div className="chat-empty"><LoaderCircle className="spin"/>در حال دریافت پیام‌ها...</div>:messages.length===0&&sarinaMessages.length===0?<div className="chat-empty"><MessageCircle size={24}/><b>هنوز پیامی ارسال نشده است</b><p>می‌توانید گفت‌وگو را با یک پیام کوتاه آغاز کنید.</p></div>:<>{[...messages.map(message=>({...message,kind:"human" as const,sortAt:message.created_at})),...sarinaMessages.map(message=>({...message,kind:"sarina" as const,sortAt:message.created_at}))].sort((a,b)=>new Date(a.sortAt).getTime()-new Date(b.sortAt).getTime()).map(message=>message.kind==="sarina"?<article key={"sarina-"+message.id} className="chat-message chat-message-sarina"><b>سارینا <span>همراه هوشمند</span></b><p>{message.message_text}</p><small>{stamp(message.created_at)}{message.status==="unavailable"?" · اتصال هوش مصنوعی فعال نیست":" · پاسخ هوشمند؛ نیازمند تأیید متخصص برای تصمیم تخصصی"}</small></article>:<article key={message.id} className={"chat-message"+(message.sender_user_id===userId?" mine":"")}><b>{message.sender_user_id===userId?(mode==="farmer"?"شما · کشاورز":"شما · متخصص"):mode==="farmer"?activeThread.otherParty+" · متخصص":"کشاورز"}</b>{message.message_text&&<p>{message.message_text}</p>}{(Array.isArray(message.content_parts)?message.content_parts:[]).map((part:any,index:number)=><div className="chat-attachment" key={message.id+"-part-"+index}>{part.type==="audio"&&attachmentUrls[part.storage_path]?<audio controls preload="metadata" src={attachmentUrls[part.storage_path]} aria-label={"پیام صوتی از "+(message.sender_user_id===userId?(mode==="farmer"?"شما":"شما، متخصص"):mode==="farmer"?activeThread.otherParty+"، متخصص":"کشاورز")}/>:part.type==="image"&&attachmentUrls[part.storage_path]?<a href={attachmentUrls[part.storage_path]} target="_blank" rel="noreferrer"><img src={attachmentUrls[part.storage_path]} alt={part.file_name||"تصویر پیوست"}/></a>:<a href={attachmentUrls[part.storage_path]||"#"} target="_blank" rel="noreferrer"><FileText size={17}/>{part.file_name||"فایل پیوست"}</a>}</div>)}<small>{stamp(message.created_at)}</small>{mode==="expert"&&activeThread.assignmentStatus==="accepted"&&message.message_text&&<button type="button" className="chat-fact-save" disabled={savingFactId===message.id} onClick={()=>void saveCaseFact(message)}>{savingFactId===message.id?"در حال ثبت...":"ثبت پیام به‌عنوان اطلاعات پرونده"}</button>}</article>)}{askingSarina&&<article className="chat-message chat-message-sarina"><b>سارینا</b><p>در حال بررسی پیام‌های گفت‌وگو…</p></article>}</>}
     </div>
     {mode==="expert"&&activeThread.assignmentStatus==="accepted"&&<form className="chat-plan-create" onSubmit={createImprovementPlan}><b>ثبت برنامه اجرایی تأییدشده</b><input value={planTitle} onChange={e=>setPlanTitle(e.target.value)} placeholder="عنوان برنامه مزرعه" maxLength={160}/><textarea value={planDescription} onChange={e=>setPlanDescription(e.target.value)} placeholder="اقدام‌ها و زمان‌بندی تأییدشده توسط متخصص را بنویسید..." rows={2} maxLength={5000}/><button type="submit" disabled={creatingPlan||!planTitle.trim()||!planDescription.trim()}>{creatingPlan?"در حال ثبت...":"افزودن به برنامه بهبود مزرعه"}</button><small>فقط برنامه‌ای که متخصص مسئول تأیید کرده باشد در این بخش ثبت می‌شود.</small></form>}
     <form className="chat-compose" onSubmit={sendMessage}><textarea value={draft} onChange={e=>setDraft(e.target.value)} maxLength={6000} rows={2} placeholder="پیام خود را بنویسید..." disabled={sending}/><div><small>{draft.length.toLocaleString("fa-IR")}/۶۰۰۰ · ارسال متن</small><button type="submit" disabled={sending||!draft.trim()||draft.trim().length>6000}><Send size={16}/>{sending?"در حال ارسال...":"ارسال پیام"}</button></div></form>
    </>}
   </div>
  </div>
 </section>;
}

function UserIcon(){return <MessageCircle size={18}/>;}
