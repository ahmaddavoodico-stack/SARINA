import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {ArrowDown,ArrowRight,CheckCheck,FileText,Image as ImageIcon,LoaderCircle,MessageCircle,Mic,Paperclip,RefreshCw,Search,Send,Square,Trash2,X} from "lucide-react";
import {supabase} from "../lib/supabase";

type Props={userId:string;mode:"farmer"|"expert";profileId?:string;verified?:boolean};
type Thread={id:string;requestId:string;subject:string;status:string;createdAt:string;consultationStatus:string;otherParty:string;assignmentStatus:string;unread:number};
type ContentPart={type:"audio"|"image"|"document";storage_bucket:string;storage_path:string;mime_type:string;size_bytes:number;name?:string};
type ChatMessage={id:string;sender_user_id:string;message_text:string|null;content_parts:ContentPart[];created_at:string;first_human_viewed_at:string|null;deleted_at:string|null};
const db=supabase as any;
const stamp=(value:string)=>new Date(value).toLocaleString("fa-IR",{dateStyle:"short",timeStyle:"short"});
const MAX_AUDIO=20*1024*1024;
const MAX_FILE=10*1024*1024;

export default function FarmerSpecialistChatInbox({userId,mode,profileId,verified=true}:Props){
 const [threads,setThreads]=useState<Thread[]>([]);
 const [notifications,setNotifications]=useState<any[]>([]);
 const [active,setActive]=useState<string|null>(null);
 const [messages,setMessages]=useState<ChatMessage[]>([]);
 const [attachmentUrls,setAttachmentUrls]=useState<Record<string,string>>({});
 const [draft,setDraft]=useState("");
 const [search,setSearch]=useState("");
 const [filter,setFilter]=useState<"all"|"unread">("all");
 const [loading,setLoading]=useState(true);
 const [loadingMessages,setLoadingMessages]=useState(false);
 const [loadingOlder,setLoadingOlder]=useState(false);
 const [sending,setSending]=useState(false);
 const [recording,setRecording]=useState(false);
 const [hasOlder,setHasOlder]=useState(false);
 const [notice,setNotice]=useState("");
 const recorderRef=useRef<MediaRecorder|null>(null);
 const streamRef=useRef<MediaStream|null>(null);
 const chunksRef=useRef<BlobPart[]>([]);
 const discardRecordingRef=useRef(false);
 const imageInputRef=useRef<HTMLInputElement|null>(null);
 const documentInputRef=useRef<HTMLInputElement|null>(null);

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

 useEffect(()=>()=>{discardRecordingRef.current=true;recorderRef.current?.stop();streamRef.current?.getTracks().forEach(track=>track.stop());},[]);

 const activeThread=threads.find(thread=>thread.id===active)||null;
 const visible=useMemo(()=>threads.filter(thread=>{
  const matches=(thread.subject+" "+thread.otherParty).toLowerCase().includes(search.toLowerCase());
  return matches&&(filter==="all"||thread.unread>0);
 }),[threads,search,filter]);
 const unreadTotal=threads.reduce((sum,thread)=>sum+thread.unread,0);

 const markIncomingViewed=useCallback(async(items:ChatMessage[])=>{
  if(!supabase)return;
  const ids=items.filter(item=>item.sender_user_id!==userId&&!item.first_human_viewed_at&&!item.deleted_at).map(item=>item.id);
  if(!ids.length)return;
  const {error}=await db.rpc("mark_expert_consultation_messages_viewed",{p_message_ids:ids});
  if(error){setNotice("ثبت اولین مشاهده پیام انجام نشد: "+error.message);return;}
  const viewedAt=new Date().toISOString();
  setMessages(old=>old.map(item=>ids.includes(item.id)?{...item,first_human_viewed_at:item.first_human_viewed_at||viewedAt}:item));
 },[userId]);

 const markConversationRead=useCallback(async(consultationId:string)=>{
  const unreadIds=notifications.filter(n=>n.consultation_id===consultationId&&n.event_type==="new_message"&&!n.read_at).map(n=>n.id);
  const now=new Date().toISOString();
  const {error}=await db.from("expert_case_notifications").update({read_at:now}).eq("recipient_user_id",userId).eq("consultation_id",consultationId).eq("event_type","new_message").is("read_at",null);
  if(error){setNotice("وضعیت اعلان‌های خوانده‌شده ثبت نشد: "+error.message);return;}
  setNotifications(old=>old.map(n=>unreadIds.includes(n.id)?{...n,read_at:now}:n));
  setThreads(old=>old.map(t=>t.id===consultationId?{...t,unread:0}:t));
 },[notifications,userId]);

 const loadConversation=useCallback(async(consultationId:string)=>{
  if(!supabase)return;
  setActive(consultationId);setMessages([]);setAttachmentUrls({});setLoadingMessages(true);setNotice("");
  const {data,error}=await db.from("expert_consultation_messages").select("id,sender_user_id,message_text,content_parts,created_at,first_human_viewed_at,deleted_at").eq("consultation_id",consultationId).order("created_at",{ascending:false}).limit(50);
  setLoadingMessages(false);
  if(error){setNotice("دریافت پیام‌ها مجاز نبود یا با خطا روبه‌رو شد: "+error.message);return;}
  const chronological:ChatMessage[]=(data||[]).reverse();
  setMessages(chronological);setHasOlder((data||[]).length===50);
  await markIncomingViewed(chronological);
  await markConversationRead(consultationId);
 },[markIncomingViewed,markConversationRead]);

 useEffect(()=>{
  const client=supabase;
  if(!client||!active)return;
  const channel=client.channel("chat-thread-"+active)
   .on("postgres_changes",{event:"*",schema:"public",table:"expert_consultation_messages",filter:"consultation_id=eq."+active},payload=>{
    if(payload.eventType==="INSERT"){
     const incoming=payload.new as ChatMessage;
     setMessages(old=>old.some(item=>item.id===incoming.id)?old:[...old,incoming]);
     if(incoming.sender_user_id!==userId){void markIncomingViewed([incoming]);void markConversationRead(active);void refresh();}
    }else if(payload.eventType==="UPDATE"){
     const updated=payload.new as ChatMessage;
     setMessages(old=>old.map(item=>item.id===updated.id?{...item,...updated}:item));
    }
   }).subscribe();
  return()=>{void client.removeChannel(channel);};
 },[active,userId,markIncomingViewed,markConversationRead,refresh]);

 useEffect(()=>{
  const client=supabase;
  if(!client)return;
  let cancelled=false;
  async function resolveUrls(){
   const entries=await Promise.all(messages.map(async message=>{
    const part=message.content_parts?.[0];
    if(message.deleted_at||!part?.storage_bucket||!part?.storage_path)return null;
    const result=await client.storage.from(part.storage_bucket).createSignedUrl(part.storage_path,300);
    if(result.error||!result.data?.signedUrl)return null;
    return [message.id,result.data.signedUrl] as const;
   }));
   if(cancelled)return;
   const resolved:Record<string,string>={};
   for(const entry of entries)if(entry)resolved[entry[0]]=entry[1];
   setAttachmentUrls(old=>({...old,...resolved}));
  }
  void resolveUrls();
  return()=>{cancelled=true;};
 },[messages]);

 async function loadOlder(){
  if(!active||!messages.length||loadingOlder)return;
  setLoadingOlder(true);
  const oldest=messages[0].created_at;
  const {data,error}=await db.from("expert_consultation_messages").select("id,sender_user_id,message_text,content_parts,created_at,first_human_viewed_at,deleted_at").eq("consultation_id",active).lt("created_at",oldest).order("created_at",{ascending:false}).limit(50);
  setLoadingOlder(false);
  if(error){setNotice("بارگذاری پیام‌های قدیمی‌تر انجام نشد: "+error.message);return;}
  const batch:ChatMessage[]=(data||[]).reverse() as ChatMessage[];
  setMessages(old=>[...batch,...old.filter(item=>!batch.some(next=>next.id===item.id))]);
  setHasOlder((data||[]).length===50);
  await markIncomingViewed(batch);
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
  await refresh();
 }

 async function uploadAndSend(file:File,type:"audio"|"image"|"document"){
  if(!active||!supabase||sending)return;
  const max=type==="audio"?MAX_AUDIO:MAX_FILE;
  if(file.size<1||file.size>max){setNotice(type==="audio"?"حجم پیام صوتی باید حداکثر ۲۰ مگابایت باشد.":"حجم فایل باید حداکثر ۱۰ مگابایت باشد.");return;}
  const allowed=type==="audio"?["audio/webm","audio/ogg","audio/mp4","audio/mpeg","audio/wav","audio/x-wav","audio/aac","audio/3gpp","audio/3gpp2","audio/flac"]:type==="image"?["image/jpeg","image/png","image/webp"]:["application/pdf"];
  if(!allowed.includes(file.type)){setNotice("نوع این فایل در گفت‌وگو پشتیبانی نمی‌شود.");return;}
  const bucket=type==="audio"?"expert-voice-notes":"expert-chat-attachments";
  const ext=(file.name.split(".").pop()|| (type==="audio"?"webm":type==="image"?"jpg":"pdf")).toLowerCase().replace(/[^a-z0-9]/g,"")||"bin";
  const storagePath=active+"/"+userId+"/"+crypto.randomUUID()+"."+ext;
  setSending(true);setNotice("");
  const upload=await supabase.storage.from(bucket).upload(storagePath,file,{contentType:file.type,upsert:false});
  if(upload.error){setSending(false);setNotice("بارگذاری فایل انجام نشد: "+upload.error.message);return;}
  const part:ContentPart={type,storage_bucket:bucket,storage_path:storagePath,mime_type:file.type,size_bytes:file.size,name:file.name||("پیام "+type)};
  const {error}=await db.from("expert_consultation_messages").insert({consultation_id:active,sender_user_id:userId,message_text:null,content_parts:[part]});
  if(error){
   await supabase.storage.from(bucket).remove([storagePath]);
   setSending(false);setNotice("فایل بارگذاری شد اما پیام ثبت نشد؛ فایل موقت پاک‌سازی شد. "+error.message);return;
  }
  setSending(false);await refresh();
 }

 async function startRecording(){
  if(!active||!supabase||sending||recording)return;
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==="undefined"){setNotice("مرورگر این دستگاه امکان ضبط صدا را فراهم نمی‌کند.");return;}
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
   streamRef.current=stream;
   const mimeType=["audio/webm;codecs=opus","audio/ogg;codecs=opus","audio/webm"].find(type=>MediaRecorder.isTypeSupported(type));
   const recorder=new MediaRecorder(stream,mimeType?{mimeType}:undefined);
   chunksRef.current=[];discardRecordingRef.current=false;
   recorder.ondataavailable=event=>{if(event.data.size>0)chunksRef.current.push(event.data);};
   recorder.onstop=async()=>{
    const blob=new Blob(chunksRef.current,{type:recorder.mimeType||"audio/webm"});
    chunksRef.current=[];
    stream.getTracks().forEach(track=>track.stop());streamRef.current=null;recorderRef.current=null;setRecording(false);
    if(discardRecordingRef.current){discardRecordingRef.current=false;return;}
    if(blob.size===0){setNotice("صدایی ضبط نشد؛ دوباره تلاش کنید.");return;}
    const extension=blob.type.includes("ogg")?"ogg":blob.type.includes("mp4")?"m4a":"webm";
    const safeMime=(blob.type.split(";")[0]||"audio/webm").toLowerCase();const normalizedBlob=new Blob([blob],{type:safeMime});const file=new File([normalizedBlob],"voice-note."+extension,{type:safeMime});
    await uploadAndSend(file,"audio");
   };
   recorderRef.current=recorder;recorder.start(250);setRecording(true);setNotice("در حال ضبط پیام صوتی…");
  }catch(error){streamRef.current?.getTracks().forEach(track=>track.stop());streamRef.current=null;setNotice(error instanceof Error?error.message:"دسترسی به میکروفون ممکن نشد.");}
 }

 function stopAndSendRecording(){if(recorderRef.current?.state==="recording"){recorderRef.current.stop();setNotice("در حال آماده‌سازی پیام صوتی…");}}
 function cancelRecording(){discardRecordingRef.current=true;chunksRef.current=[];if(recorderRef.current?.state==="recording")recorderRef.current.stop();else{streamRef.current?.getTracks().forEach(track=>track.stop());streamRef.current=null;setRecording(false);}setNotice("ضبط لغو شد و هیچ پیامی ارسال نشد.");}

 async function deleteMessage(message:ChatMessage){
  if(!supabase||message.sender_user_id!==userId||message.first_human_viewed_at||message.deleted_at)return;
  const {data,error}=await db.rpc("delete_expert_consultation_message",{p_message_id:message.id});
  if(error){setNotice("حذف پیام انجام نشد: "+error.message);return;}
  if(!data?.deleted){
   setMessages(old=>old.map(item=>item.id===message.id?{...item,first_human_viewed_at:data?.reason==="already_viewed"?(item.first_human_viewed_at||new Date().toISOString()):item.first_human_viewed_at}:item));
   setNotice(data?.reason==="already_viewed"?"مخاطب پیش از درخواست حذف، پیام را مشاهده کرده است؛ امکان حذف وجود ندارد.":"این پیام دیگر قابل حذف نیست.");
   return;
  }
  const part=(data.content_parts||[])[0] as ContentPart|undefined;
  let cleanupFailed=false;
  if(part?.storage_bucket&&part?.storage_path){
   const removed=await supabase.storage.from(part.storage_bucket).remove([part.storage_path]);
   cleanupFailed=!!removed.error;
  }
  const deletedAt=new Date().toISOString();
  setMessages(old=>old.map(item=>item.id===message.id?{...item,message_text:null,content_parts:[],deleted_at:deletedAt}:item));
  setAttachmentUrls(old=>{const next={...old};delete next[message.id];return next;});
  setNotice(cleanupFailed?"پیام از دسترس خارج شد، اما پاک‌سازی فایل پیوست کامل نشد و نیازمند پاک‌سازی مجدد است.":"پیام و محتوای آن حذف شد.");
 }

 async function handleFile(event:React.ChangeEvent<HTMLInputElement>,type:"image"|"document"){
  const file=event.target.files?.[0];event.target.value="";
  if(file)await uploadAndSend(file,type);
 }

 if(mode==="expert"&&!verified)return <section className="chat-inbox" dir="rtl"><div className="chat-empty"><MessageCircle size={28}/><b>دسترسی مکالمات پس از تأیید صلاحیت فعال می‌شود.</b><p>برای حفاظت از اطلاعات کشاورزان، حساب‌های تأییدنشده به محتوای مکالمات دسترسی ندارند.</p></div></section>;

 return <section className="chat-inbox" dir="rtl">
  <header className="chat-inbox-heading"><div><span className="eyebrow">{mode==="farmer"?"ارتباط انسانی با متخصصان":"ارتباط مستقیم با کشاورزان"}</span><h2>{mode==="farmer"?"گفت‌وگو با متخصصان":"مکالمات کشاورزان"}</h2><p>این صندوق فقط پیام‌های انسانی پرونده‌های مشاوره را نمایش می‌دهد و از «صحبت با سارینا» مستقل است.</p></div><div className="chat-inbox-count"><b>{unreadTotal.toLocaleString("fa-IR")}</b><small>پیام خوانده‌نشده</small></div></header>
  {notice&&<div className="notice">{notice}</div>}
  <div className="chat-inbox-layout">
   <aside className={"chat-thread-list"+(active?" mobile-hidden":"")}>
    <div className="chat-inbox-tools"><label><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="جست‌وجوی مکالمه..."/></label><button type="button" onClick={()=>void refresh()} aria-label="تازه‌سازی"><RefreshCw size={16}/></button></div>
    <div className="chat-filter-row"><button className={filter==="all"?"active":""} onClick={()=>setFilter("all")}>همه</button><button className={filter==="unread"?"active":""} onClick={()=>setFilter("unread")}>خوانده‌نشده‌ها</button></div>
    {loading?<div className="chat-empty"><LoaderCircle className="spin" size={22}/>در حال دریافت مکالمات...</div>:visible.length===0?<div className="chat-empty"><MessageCircle size={24}/><b>{filter==="unread"?"پیام خوانده‌نشده‌ای ندارید.":"هنوز مکالمه فعالی وجود ندارد."}</b><p>{mode==="farmer"?"برای آغاز ارتباط، از بخش مشاوره متخصصان درخواست ثبت کنید.":"با پذیرش پرونده و فعال‌شدن مشاوره، مکالمه اینجا نمایش داده می‌شود."}</p></div>:visible.map(thread=><button type="button" key={thread.id} className={"chat-thread"+(active===thread.id?" selected":"")} onClick={()=>void loadConversation(thread.id)}><span className="chat-thread-avatar"><UserIcon/></span><span className="chat-thread-copy"><b>{thread.otherParty}</b><strong>{thread.subject}</strong><small>{stamp(thread.createdAt)}</small></span>{thread.unread>0&&<i>{thread.unread.toLocaleString("fa-IR")}</i>}</button>)}
   </aside>
   <div className={"chat-conversation"+(!active?" mobile-hidden":"")}>
    {!activeThread?<div className="chat-empty chat-select-prompt"><MessageCircle size={34}/><b>یک مکالمه را انتخاب کنید</b><p>سوابق پیام و پاسخ متخصص در این بخش نمایش داده می‌شود.</p></div>:<>
     <header className="chat-conversation-head"><button className="chat-back" onClick={()=>setActive(null)}><ArrowRight size={17}/> مکالمات</button><div><b>{activeThread.otherParty}</b><small>{activeThread.subject} · پرونده مرتبط</small></div><span className="chat-secure-label"><CheckCheck size={14}/> خصوصی</span></header>
     <div className="chat-message-history">
      {hasOlder&&<button className="chat-load-older" onClick={()=>void loadOlder()} disabled={loadingOlder}>{loadingOlder?<LoaderCircle size={14}/>:<ArrowDown size={14}/>} پیام‌های قدیمی‌تر</button>}
      {loadingMessages?<div className="chat-empty"><LoaderCircle className="spin"/>در حال دریافت پیام‌ها...</div>:messages.length===0?<div className="chat-empty"><MessageCircle size={24}/><b>هنوز پیامی ارسال نشده است</b><p>می‌توانید گفت‌وگو را با یک پیام کوتاه آغاز کنید.</p></div>:messages.map(message=>{
       const part=message.content_parts?.[0];
       const url=attachmentUrls[message.id];
       const deletable=message.sender_user_id===userId&&!message.first_human_viewed_at&&!message.deleted_at;
       return <article key={message.id} className={"chat-message"+(message.sender_user_id===userId?" mine":"")}>
        {message.deleted_at?<p className="chat-message-deleted">این پیام حذف شده است.</p>:<>
         {message.message_text&&<p>{message.message_text}</p>}
         {part?.type==="audio"&&<div className="chat-attachment-audio">{url?<audio controls preload="none" src={url}/>:<small>در حال آماده‌سازی پخش صدا…</small>}</div>}
         {part?.type==="image"&&<div className="chat-attachment-image">{url?<a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={part.name||"تصویر پیوست‌شده"}/></a>:<small>در حال آماده‌سازی تصویر…</small>}</div>}
         {part?.type==="document"&&<div className="chat-attachment-document">{url?<a href={url} target="_blank" rel="noopener noreferrer"><FileText size={18}/>{part.name||"مشاهده سند PDF"}</a>:<small>در حال آماده‌سازی سند…</small>}</div>}
        </>}
        <small>{stamp(message.created_at)} {message.sender_user_id===userId?"· ارسال‌شده":""}{message.first_human_viewed_at&&message.sender_user_id===userId?" · مشاهده‌شده":""}</small>
        {deletable&&<button type="button" className="chat-message-delete" onClick={()=>void deleteMessage(message)} title="حذف پیام تا پیش از مشاهده مخاطب"><Trash2 size={14}/> حذف پیام</button>}
       </article>;
      })}
     </div>
     <form className="chat-compose" onSubmit={sendMessage}>
      <textarea value={draft} onChange={e=>setDraft(e.target.value)} maxLength={6000} rows={2} placeholder="پیام خود را بنویسید..." disabled={sending||recording}/>
      <div><small>{draft.length.toLocaleString("fa-IR")}/۶۰۰۰ · ارسال متن</small><button type="submit" disabled={sending||recording||!draft.trim()||draft.trim().length>6000}><Send size={16}/>{sending?"در حال ارسال...":"ارسال پیام"}</button></div>
      <div className="chat-compose-attachments">
       <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e=>void handleFile(e,"image")}/>
       <input ref={documentInputRef} type="file" accept="application/pdf" hidden onChange={e=>void handleFile(e,"document")}/>
       <button type="button" disabled={sending||recording} onClick={()=>imageInputRef.current?.click()}><ImageIcon size={15}/> تصویر</button>
       <button type="button" disabled={sending||recording} onClick={()=>documentInputRef.current?.click()}><Paperclip size={15}/> PDF</button>
       {!recording?<button type="button" disabled={sending} onClick={()=>void startRecording()}><Mic size={15}/> ضبط صوت</button>:<>
        <button type="button" disabled={sending} onClick={stopAndSendRecording}><Square size={14}/> پایان و ارسال</button>
        <button type="button" disabled={sending} onClick={cancelRecording}><X size={15}/> لغو ضبط</button>
       </>}
      </div>
     </form>
    </>}
   </div>
  </div>
 </section>;
}

function UserIcon(){return <MessageCircle size={18}/>;}
