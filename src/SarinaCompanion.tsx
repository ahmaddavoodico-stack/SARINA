import {useEffect,useRef,useState} from "react";
import type {FormEvent} from "react";
import {ArrowUp,ChevronDown,ChevronLeft,CircleHelp,ClipboardList,Leaf,MessageCircle,PlayCircle,Sparkles,UserRound,X,PanelRightClose,PanelRightOpen} from "lucide-react";
import {supabase} from "./lib/supabase";
import SarinaCharacter from "./components/SarinaCharacter";
import PwaInstall from "./PwaInstall";
import VoiceMessageControls from "./components/VoiceMessageControls";
import "./components/sarina-communication-center.css";

type ChatMessage={id:number;role:"farmer"|"sarina";text:string;internalText?:string;audioUrl?:string};
type NavTarget="learning"|"experts"|"expert-chat";
type SarinaRole="admin"|"expert"|"farmer"|"organization"|"livestock_keeper";
type SarinaCompanionProps={isAdmin?:boolean;role?:SarinaRole;onNavigate?:(destination:NavTarget)=>void};
type VoicePayload={audio:Blob;mimeType:string};

const guideItems=[
 {title:"فیلم معرفی SARINA",description:"آشنایی کوتاه با امکانات سامانه",icon:PlayCircle,target:"learning" as NavTarget},
 {title:"راهنمای ثبت مزرعه",description:"شروع کار و ثبت اطلاعات مزرعه",icon:ClipboardList,target:"learning" as NavTarget},
 {title:"پرسش‌های متداول",description:"پاسخ به سؤال‌های رایج کاربران",icon:CircleHelp,target:"learning" as NavTarget}
];

export default function SarinaCompanion({isAdmin=false,role="farmer",onNavigate}:SarinaCompanionProps){
 const[open,setOpen]=useState(false);
 const[drawerOpen,setDrawerOpen]=useState(true);
 const[draft,setDraft]=useState("");
 const[messages,setMessages]=useState<ChatMessage[]>([]);
 const showNotice=false;
 const[busy,setBusy]=useState(false);
 const[status,setStatus]=useState("");
 const messagesRef=useRef<ChatMessage[]>([]);
 const pendingVoiceIdRef=useRef<number|null>(null);

 function commitMessages(next:ChatMessage[]){messagesRef.current=next;setMessages(next);}
 useEffect(()=>()=>{for(const message of messagesRef.current){if(message.audioUrl)URL.revokeObjectURL(message.audioUrl);}},[]);
 function closePanel(){setOpen(false);}
 function go(target:NavTarget){closePanel();onNavigate?.(target);}

 async function requestSarinaReply(nextMessages:ChatMessage[]){
  if(!supabase)return;
  setBusy(true);setStatus("سارینا در حال آماده‌کردن پاسخ شماست…");
  try{
   const{data,error}=await supabase.functions.invoke("sarina-central-intelligence",{body:{
    mode:"conversation",
    messages:nextMessages.map(message=>({role:message.role==="farmer"?"user":"assistant",content:message.internalText||message.text})).filter(message=>message.content.trim()).slice(-8)
   }});
   if(error||!data?.ok||typeof data.answer!=="string")throw new Error(typeof data?.code==="string"?data.code:"SARINA_CHAT_REQUEST_FAILED");
   commitMessages([...messagesRef.current,{id:Date.now()+1,role:"sarina" as const,text:data.answer}].slice(-12));
   setStatus("پاسخ سارینا · گفت‌وگوی امن و ثبت مصرف");
  }catch(error){
   const code=error instanceof Error?error.message:"SARINA_CHAT_REQUEST_FAILED";
   setStatus(code.includes("AI_MONTHLY_BUDGET_EXHAUSTED")?"سقف بودجه ماهانه هوش مصنوعی تکمیل شده است؛ پاسخ‌گویی پس از دوره بعدی دوباره فعال می‌شود.":code.includes("RATE_LIMITED")?"برای حفظ کیفیت و کنترل هزینه، کمی بعد دوباره پیام بدهید.":code.includes("ACTIVE_ACCOUNT_REQUIRED")?"برای گفتگو با سارینا، حساب کاربری باید فعال باشد.": "فعلاً ارتباط با پاسخ‌گوی سارینا برقرار نشد. لطفاً کمی بعد دوباره تلاش کنید.");
  }finally{setBusy(false);}
 }

 async function sendText(text:string){
  const normalized=text.trim();
  if(!normalized||busy)return;
  const next=[...messagesRef.current,{id:Date.now(),role:"farmer" as const,text:normalized}].slice(-12);
  commitMessages(next);setDraft("");
  await requestSarinaReply(next);
 }
 async function send(e:FormEvent){e.preventDefault();await sendText(draft);}

 function receiveVoiceMessage(payload:VoicePayload){
  const id=Date.now();
  const audioUrl=URL.createObjectURL(payload.audio);
  const next=[...messagesRef.current,{id,role:"farmer" as const,text:"پیام صوتی · در حال تبدیل گفتار به متن…",audioUrl}].slice(-12);
  commitMessages(next);
  pendingVoiceIdRef.current=id;
  setStatus("پیام صوتی ضبط شد؛ در حال تبدیل محلی گفتار به متن در سرویس SARINA...");
 }
 function receiveVoiceReplyAudio(payload:VoicePayload){
  const latest=[...messagesRef.current].reverse().find(message=>message.role==="sarina");
  if(!latest)return;
  const audioUrl=URL.createObjectURL(payload.audio);
  const next=messagesRef.current.map(message=>message.id===latest.id?{...message,audioUrl}:message);
  commitMessages(next);
 }
 function receiveTranscription(text:string){
  const id=pendingVoiceIdRef.current;
  // Keep the recognized transcript internal: the farmer sees their audio message, not a text dump.
  const next=messagesRef.current.map(message=>message.id===id?{...message,text:"پیام صوتی",internalText:text}:message);
  pendingVoiceIdRef.current=null;
  commitMessages(next);
  setStatus("سارینا در حال آماده‌کردن پاسخ پیام صوتی شماست…");void requestSarinaReply(next);
 }

 const latestSarinaReplyMessage=[...messages].reverse().find(message=>message.role==="sarina");
 const latestSarinaReply=latestSarinaReplyMessage?.text;
 return <div className="sarina-companion" dir="rtl">
  {open&&<section className={"sarina-chat-panel"+(!isAdmin?" farmer-mode":"")} aria-label="مرکز ارتباط و راهنمایی سارینا">
   {!isAdmin&&drawerOpen&&<aside className="sarina-guide-drawer">
    <header><div><strong>راهنمای سریع SARINA</strong><span>برای شروع، یکی را انتخاب کنید</span></div><button type="button" onClick={()=>setDrawerOpen(false)} aria-label="جمع‌کردن راهنما"><PanelRightClose size={18}/></button></header>
    <div className="sarina-guide-highlight"><span className="sarina-guide-leaf"><Leaf size={22}/></span><b>به SARINA خوش آمدید</b><p>با چند راهنمای کوتاه، بدون نیاز به پرسش‌های پیچیده شروع کنید.</p></div>
    <div className="sarina-guide-list">{guideItems.map(item=><button key={item.title} type="button" onClick={()=>go(item.target)}><item.icon size={19}/><span><b>{item.title}</b><small>{item.description}</small></span><ChevronLeft size={15}/></button>)}</div>
    <div className="sarina-guide-contact"><span>راه‌های ارتباطی</span><button type="button" onClick={()=>setDrawerOpen(false)}><Leaf size={18}/><span><b>گفت‌وگو با سارینا</b><small>راهنمایی اولیه و پرسش‌های شما</small></span></button><button type="button" onClick={()=>go("experts")}><UserRound size={18}/><span><b>ارتباط با متخصص</b><small>مشاوره تخصصی و انسانی</small></span><ChevronLeft size={15}/></button></div>
    <PwaInstall/>
    <button className="sarina-guide-collapse" type="button" onClick={()=>setDrawerOpen(false)}><ChevronDown size={15}/> بستن پنل راهنما</button>
   </aside>}
   <div className="sarina-chat-main">
    <header className="sarina-chat-header">
     {!isAdmin&&!drawerOpen&&<button type="button" className="sarina-guide-open" onClick={()=>setDrawerOpen(true)} aria-label="بازکردن راهنمای سریع"><PanelRightOpen size={18}/></button>}
     <SarinaCharacter className="sarina-avatar"/>
     <div className="sarina-chat-identity"><strong>سارینا</strong><span><i/>{isAdmin?"دستیار مدیر":role==="expert"?"ارتباطات متخصص":role==="organization"?"ارتباطات سازمانی":role==="livestock_keeper"?"ارتباطات دامدار":"همراه کشاورزی شما"}</span></div>
     <button type="button" className="sarina-chat-close" onClick={closePanel} aria-label="بستن گفتگو"><X size={18}/></button>
    </header>
    <div className="sarina-chat-body">
     <div className="sarina-welcome-message"><span className="sarina-sparkle"><Sparkles size={15}/></span><strong>سلام! به SARINA خوش آمدید 🌱</strong><p>{isAdmin?"من نقش مدیر مرکزی شما را می‌شناسم. می‌توانم درباره کاربران، نقش‌ها، درخواست‌ها و وضعیت سامانه کمک کنم؛ لازم نیست اطلاعات مزرعه شخصی‌تان را وارد کنید.":role==="expert"?"می‌توانی درباره مسائل تخصصی و همکاری حرفه‌ای گفتگو کنی. اطلاعات پرونده‌ها و کاربران فقط در محدوده ارجاع و مجوزت استفاده می‌شود.":role==="organization"?"می‌توانی درباره برنامه‌ها و خدمات سازمانی گفتگو کنی. اطلاعات فقط در محدوده دسترسی حساب سازمانی استفاده می‌شود.":role==="livestock_keeper"?"می‌توانی درباره دامداری، سلامت گله و مدیریت مزرعه پرسش کنی. برای راهنمایی دقیق‌تر، اطلاعات مرتبط را با من در میان بگذار.":"من همراه کشاورزی شما هستم. برای آشنایی بهتر با امکانات سارینا، می‌توانید از راهنمای سریع کنار گفتگو استفاده کنید. هیچ کشاورزی تنها نیست."}</p></div>
     {messages.map(message=><div key={message.id} className={"sarina-message "+(message.role==="farmer"?"from-farmer":"from-sarina")}><b className="sarina-message-sender">{message.role==="farmer"?"شما":"SARINA"}</b>{message.audioUrl&&<audio controls preload="metadata" src={message.audioUrl} aria-label={"پیام صوتی از "+(message.role==="farmer"?"شما":"SARINA")}/>}{message.text}</div>)}
     {showNotice&&<div className="sarina-prototype-note">{role==="farmer"?"پیامت در این پیش‌نمایش ثبت شد. اتصال پاسخ‌گوی هوشمند برای این نقش هنوز فعال نشده است.":"گفت‌وگوی عمومی این نقش هنوز به منبع پیام‌رسانی تأییدشده متصل نشده است؛ از نمایش یا ثبت پیام غیرواقعی خودداری می‌شود."}</div>}
     {status&&<div className="sarina-prototype-note" role="status">{status}</div>}
    </div>
    <form className={"sarina-chat-compose"+(isAdmin?" sarina-chat-compose-admin":"")} onSubmit={send}>
     <VoiceMessageControls onVoiceMessage={receiveVoiceMessage} onTranscription={receiveTranscription} textToSpeak={latestSarinaReplyMessage?.audioUrl?undefined:latestSarinaReply} speechRequestId={latestSarinaReplyMessage?.id} speechLanguage={localStorage.getItem("sarina-language")==="ar"?"ar":"fa"} autoGenerateAudio onVoiceReplyAudio={receiveVoiceReplyAudio} onAudioGenerationComplete={()=>{}} disabled={busy}/>
     <input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="اینجا برای سارینا بنویس..." aria-label="پیام شما به سارینا" maxLength={2000} disabled={busy}/>
     <button type="submit" disabled={!draft.trim()||busy} aria-label="ارسال پیام">{busy?<span className="sarina-chat-spinner"/>:<ArrowUp size={18}/>}</button>
    </form>
    <div className="sarina-chat-foot">{isAdmin?"گفت‌وگوی امن با هوش مرکزی SARINA":"گفت‌وگوی مستقیم با سارینا"} <Leaf size={12}/></div>
   </div>
  </section>}
  <div className="sarina-launcher-wrap">
   <button type="button" className="sarina-launcher-copy" onClick={()=>setOpen(value=>!value)} aria-expanded={open}><span className="sarina-launcher-title">SARINA Chat</span><span className="sarina-launcher-subtitle">{isAdmin?"دستیار مدیر":"ارتباط و راهنمایی"}</span></button>
   <button type="button" className={"sarina-launcher-avatar"+(open?" is-open":"")} onClick={()=>setOpen(value=>!value)} aria-label={open?"بستن مرکز ارتباط":"بازکردن مرکز ارتباط SARINA"} aria-expanded={open}><SarinaCharacter className="sarina-avatar" large/><span className="sarina-online-dot"/></button>
   <span className="sarina-launcher-chevron">{open?<ChevronDown size={15}/>:<MessageCircle size={15}/>}</span>
  </div>
 </div>;
}
