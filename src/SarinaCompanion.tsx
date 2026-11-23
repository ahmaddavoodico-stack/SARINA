import {useState} from "react";
import type {FormEvent} from "react";
import {ArrowUp,ChevronDown,Leaf,MessageCircle,Sparkles,X} from "lucide-react";
import {supabase} from "./lib/supabase";
import SarinaCharacter from "./components/SarinaCharacter";

type ChatMessage={id:number;role:"farmer"|"sarina";text:string};
type SarinaCompanionProps={isAdmin?:boolean};

export default function SarinaCompanion({isAdmin=false}:SarinaCompanionProps){
 const[open,setOpen]=useState(false);
 const[draft,setDraft]=useState("");
 const[messages,setMessages]=useState<ChatMessage[]>([]);
 const[showNotice,setShowNotice]=useState(false);
 const[busy,setBusy]=useState(false);
 const[status,setStatus]=useState("");

 async function send(e:FormEvent){
  e.preventDefault();
  const text=draft.trim();
  if(!text||busy)return;
  const farmerMessage:ChatMessage={id:Date.now(),role:"farmer",text};
  const nextMessages=[...messages,farmerMessage].slice(-10);
  setMessages(nextMessages);
  setDraft("");
  if(!isAdmin){
   setShowNotice(true);
   return;
  }
  if(!supabase){
   setStatus("اتصال به سرویس سارینا پیکربندی نشده است.");
   return;
  }
  setBusy(true);
  setStatus("در حال دریافت پاسخ آزمایشی از Groq...");
  try{
   const{data,error}=await supabase.functions.invoke("sarina-admin-chat",{
    body:{
     mode:"admin_chat",
     messages:nextMessages.map(message=>({
      role:message.role==="farmer"?"user":"assistant",
      content:message.text,
     })),
    },
   });
   if(error||!data?.ok||typeof data.answer!=="string"){
    const code=typeof data?.code==="string"?data.code:"ADMIN_CHAT_REQUEST_FAILED";
    throw new Error(code);
   }
   setMessages(current=>[...current,{id:Date.now()+1,role:"sarina",text:data.answer}]);
   setStatus(`پاسخ آزمایشی از Groq · ${data.model||"مدل تأییدشده"}`);
  }catch(error){
   const code=error instanceof Error?error.message:"ADMIN_CHAT_REQUEST_FAILED";
   const message=code.includes("ADMIN_ACCESS_REQUIRED")?"این قابلیت فقط برای مدیر تأییدشده فعال است."
    :code.includes("GROQ_CHAT_KEY_MISSING")?"کلید Groq در محیط تابع سرور در دسترس نیست."
    :code.includes("GROQ_CHAT_HTTP_401")?"سرویس Groq کلید را نپذیرفت؛ اعتبار کلید باید بررسی شود."
    :code.includes("GROQ_CHAT_HTTP_429")?"سهمیه یا محدودیت درخواست Groq مانع پاسخ شد."
    :"ارتباط با پاسخ‌گوی آزمایشی برقرار نشد. وضعیت تابع سرور و گزارش خطا را بررسی کنید.";
   setStatus(message);
  }finally{
   setBusy(false);
  }
 }

 return <div className="sarina-companion" dir="rtl">
  {open&&<section className="sarina-chat-panel" aria-label="گفت‌وگو با سارینا">
   <header className="sarina-chat-header">
    <SarinaCharacter className="sarina-avatar"/>
    <div className="sarina-chat-identity"><strong>سارینا</strong><span><i/>{isAdmin?"دستیار آزمایشی مدیر":"همراه کشاورزی شما"}</span></div>
    <button type="button" className="sarina-chat-close" onClick={()=>setOpen(false)} aria-label="بستن گفتگو"><X size={18}/></button>
   </header>
   <div className="sarina-chat-body">
    <div className="sarina-welcome-message"><span className="sarina-sparkle"><Sparkles size={15}/></span><strong>سلام! من سارینا هستم 🌱</strong><p>{isAdmin?"برای آزمودن اتصال هوش مصنوعی، پیام آزمایشی خود را بنویس.":"از مزرعه‌ات برام بگو؛ چه چیزی ذهنت رو مشغول کرده؟"}</p></div>
    {messages.map(message=><div key={message.id} className={"sarina-message "+(message.role==="farmer"?"from-farmer":"from-sarina")}>{message.text}</div>)}
    {showNotice&&<div className="sarina-prototype-note">پیامت در این پیش‌نمایش ثبت شد. اتصال پاسخ‌گوی هوشمند برای این نقش هنوز فعال نشده است.</div>}
    {status&&<div className="sarina-prototype-note" role="status">{status}</div>}
   </div>
   <form className="sarina-chat-compose" onSubmit={send}>
    <input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="اینجا برای سارینا بنویس..." aria-label="پیام شما به سارینا" maxLength={2000} disabled={busy}/>
    <button type="submit" disabled={!draft.trim()||busy} aria-label="ارسال پیام">{busy?<span className="sarina-chat-spinner"/>:<ArrowUp size={18}/>}</button>
   </form>
   <div className="sarina-chat-foot">{isAdmin?"آزمایش محدود Groq · پیام‌ها به سرویس Groq ارسال می‌شوند": "همراه شما در مسیر کشاورزی"} <Leaf size={12}/></div>
  </section>}
  <div className="sarina-launcher-wrap">
   <button type="button" className="sarina-launcher-copy" onClick={()=>setOpen(value=>!value)} aria-expanded={open}>
    <span className="sarina-launcher-title">من اینجام، چه خبر؟</span>
    <span className="sarina-launcher-subtitle">با سارینا صحبت کن</span>
   </button>
   <button type="button" className={"sarina-launcher-avatar"+(open?" is-open":"")} onClick={()=>setOpen(value=>!value)} aria-label={open?"بستن گفت‌وگو با سارینا":"گفت‌وگو با سارینا"} aria-expanded={open}>
    <SarinaCharacter className="sarina-avatar" large/>
    <span className="sarina-online-dot"/>
   </button>
   <span className="sarina-launcher-chevron">{open?<ChevronDown size={15}/>:<MessageCircle size={15}/>}</span>
  </div>
 </div>;
}
