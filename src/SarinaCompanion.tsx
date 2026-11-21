import {useState} from "react";
import type {FormEvent} from "react";
import {ArrowUp,ChevronDown,Leaf,MessageCircle, Sparkles, X} from "lucide-react";
import SarinaCharacter from "./components/SarinaCharacter";

type ChatMessage={id:number;role:"farmer"|"sarina";text:string};

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
    <SarinaCharacter className="sarina-avatar"/>
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
    <SarinaCharacter className="sarina-avatar" large/>
    <span className="sarina-online-dot"/>
   </button>
   <span className="sarina-launcher-chevron">{open?<ChevronDown size={15}/>:<MessageCircle size={15}/>}</span>
  </div>
 </div>;
}
