import {useState} from "react";
import type {FormEvent} from "react";
import {ArrowUp,ChevronDown,Leaf,MessageCircle, Sparkles, X} from "lucide-react";

type ChatMessage={id:number;role:"farmer"|"sarina";text:string};

function SarinaAvatar({large=false}:{large?:boolean}){
 return <svg className={large?"sarina-avatar sarina-avatar-large":"sarina-avatar"} viewBox="0 0 120 120" role="img" aria-label="شخصیت همراه سارینا">
  <defs>
   <linearGradient id="sarina-hair" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#76513d"/><stop offset="1" stopColor="#3e3029"/></linearGradient>
   <linearGradient id="sarina-dress" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4e9368"/><stop offset="1" stopColor="#216044"/></linearGradient>
  </defs>
  <circle cx="60" cy="60" r="58" fill="#e8f2e5"/>
  <path d="M19 111c3-25 19-37 41-37s38 12 41 37" fill="url(#sarina-dress)"/>
  <path d="M34 52c-7-25 7-43 27-43 23 0 34 17 27 44l-7 22H40z" fill="url(#sarina-hair)"/>
  <path d="M39 46c0-18 8-28 22-28 15 0 23 11 21 29l-3 20c-2 13-11 21-20 21S42 80 40 67z" fill="#f1c6a5"/>
  <path d="M36 47c-3-18 5-35 22-39 17-4 31 8 32 26-9-3-16-10-19-17-6 10-17 16-35 18z" fill="url(#sarina-hair)"/>
  <path d="M41 46c-4 8-8 8-10 2-3-8 2-13 8-10M81 44c4 8 8 8 10 2 3-8-2-13-8-10" fill="#f1c6a5"/>
  <ellipse cx="51" cy="55" rx="2.5" ry="3" fill="#44352f"/><ellipse cx="70" cy="55" rx="2.5" ry="3" fill="#44352f"/>
  <path d="M54 68q7 6 14 0" fill="none" stroke="#b66e63" strokeWidth="2.5" strokeLinecap="round"/>
  <path d="M45 84q15 11 30 0l7 27H38z" fill="#f6f4e8"/>
  <path d="M57 88q3-5 6 0l-3 8z" fill="#d5b56c"/>
  <path d="M78 25q12-11 19-1-10 2-15 10-3-4-4-9" fill="#8dbb72"/>
  <path d="M81 27q8-5 13-3" fill="none" stroke="#477d4c" strokeWidth="1.5" strokeLinecap="round"/>
 </svg>;
}

export default function SarinaCompanion(){
 const[open,setOpen]=useState(false);
 const[draft,setDraft]=useState("");
 const[messages,setMessages]=useState<ChatMessage[]>([]);
 const[showNotice,setShowNotice]=useState(false);
 function send(e:FormEvent){
  e.preventDefault();
  const text=draft.trim();
  if(!text)return;
  setMessages(current=>[...current,{id:Date.now(),role:"farmer",text}]);
  setDraft("");
  setShowNotice(true);
 }
 return <div className="sarina-companion" dir="rtl">
  {open&&<section className="sarina-chat-panel" aria-label="گفت‌وگو با سارینا">
   <header className="sarina-chat-header">
    <SarinaAvatar/>
    <div className="sarina-chat-identity"><strong>سارینا</strong><span><i/> همراه کشاورزی شما</span></div>
    <button type="button" className="sarina-chat-close" onClick={()=>setOpen(false)} aria-label="بستن گفتگو"><X size={18}/></button>
   </header>
   <div className="sarina-chat-body">
    <div className="sarina-welcome-message"><span className="sarina-sparkle"><Sparkles size={15}/></span><strong>سلام! من سارینا هستم 🌱</strong><p>از مزرعه‌ات برام بگو؛ چه چیزی ذهنت رو مشغول کرده؟</p></div>
    {messages.map(message=><div key={message.id} className={"sarina-message "+(message.role==="farmer"?"from-farmer":"from-sarina")}>{message.text}</div>)}
    {showNotice&&<div className="sarina-prototype-note">پیامت در این پیش‌نمایش ثبت شد. اتصال به پاسخ‌گوی هوشمند و پرونده مزرعه در مرحله بعدی فعال می‌شود.</div>}
   </div>
   <form className="sarina-chat-compose" onSubmit={send}>
    <input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="اینجا برای سارینا بنویس..." aria-label="پیام شما به سارینا" maxLength={2000}/>
    <button type="submit" disabled={!draft.trim()} aria-label="ثبت پیام"><ArrowUp size={18}/></button>
   </form>
   <div className="sarina-chat-foot">همراه شما در مسیر کشاورزی <Leaf size={12}/></div>
  </section>}
  <div className="sarina-launcher-wrap">
   <button type="button" className="sarina-launcher-copy" onClick={()=>setOpen(value=>!value)} aria-expanded={open}>
    <span className="sarina-launcher-title">من اینجام، چه خبر؟</span>
    <span className="sarina-launcher-subtitle">با سارینا صحبت کن</span>
   </button>
   <button type="button" className={"sarina-launcher-avatar"+(open?" is-open":"")} onClick={()=>setOpen(value=>!value)} aria-label={open?"بستن گفت‌وگو با سارینا":"گفت‌وگو با سارینا"} aria-expanded={open}>
    <SarinaAvatar large/>
    <span className="sarina-online-dot"/>
   </button>
   <span className="sarina-launcher-chevron">{open?<ChevronDown size={15}/>:<MessageCircle size={15}/>}</span>
  </div>
 </div>;
}
