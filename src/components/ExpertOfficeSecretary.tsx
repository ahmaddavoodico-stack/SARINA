import {useState} from "react";
import type {FormEvent} from "react";
import {ArrowUp,BriefcaseBusiness,CalendarClock,ChevronDown,ClipboardCheck,Inbox,MessageCircle,Paperclip,Send,Sparkles,X} from "lucide-react";

type Props={name:string;caseCount:number;unreadCount:number;onNavigate:(tab:string)=>void};
function SecretaryPortrait(){
 return <svg viewBox="0 0 120 120" role="img" aria-label="منشی سارینا" className="office-secretary-portrait">
  <defs><linearGradient id="office-hair" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#79533e"/><stop offset="1" stopColor="#3d3029"/></linearGradient><linearGradient id="office-jacket" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#568b69"/><stop offset="1" stopColor="#244f3a"/></linearGradient></defs>
  <circle cx="60" cy="60" r="58" fill="#eaf1e6"/>
  <path d="M17 113c4-27 19-39 43-39s39 12 43 39" fill="url(#office-jacket)"/>
  <path d="M35 51C28 24 43 8 62 8c22 0 34 17 26 47l-8 25H39z" fill="url(#office-hair)"/>
  <path d="M40 43c0-17 8-27 21-27 15 0 23 11 21 29l-3 20c-2 13-11 21-20 21S43 78 41 65z" fill="#efc5a5"/>
  <path d="M37 46c-4-20 5-36 22-40 17-4 31 8 32 26-10-3-16-10-19-17-7 10-18 16-35 18z" fill="url(#office-hair)"/>
  <ellipse cx="51" cy="54" rx="2.5" ry="3" fill="#44352f"/><ellipse cx="70" cy="54" rx="2.5" ry="3" fill="#44352f"/>
  <path d="M54 67q7 6 14 0" fill="none" stroke="#b66e63" strokeWidth="2.5" strokeLinecap="round"/>
  <path d="M43 85q17 10 34 0l8 28H35z" fill="#f7f5eb"/>
  <path d="M56 89q4-5 8 0l-4 8z" fill="#c4a46a"/>
  <path d="M78 25q12-11 19-1-10 2-15 10-3-4-4-9" fill="#8eb77a"/>
 </svg>;
}
export default function ExpertOfficeSecretary({name,caseCount,unreadCount,onNavigate}:Props){
 const[open,setOpen]=useState(false),[draft,setDraft]=useState(""),[sent,setSent]=useState(false);
 function submit(e:FormEvent){e.preventDefault();if(!draft.trim())return;setSent(true);setDraft("");}
 return <div className="office-secretary" dir="rtl">
  {open&&<section className="office-secretary-panel">
   <header className="office-secretary-head"><SecretaryPortrait/><div><b>سارینا · منشی دفتر شما</b><span><i/> آماده همراهی در کارهای امروز</span></div><button onClick={()=>setOpen(false)} aria-label="بستن"><X size={17}/></button></header>
   <div className="office-secretary-content">
    <div className="office-secretary-greeting"><Sparkles size={15}/><div><b>سلام {name} عزیز، خوش آمدید.</b><p>من کنار میز کارتان هستم تا پرونده‌ها و کارهای روزانه را منظم نگه داریم.</p></div></div>
    <div className="office-secretary-summary"><div><Inbox/><b>{caseCount.toLocaleString("fa-IR")}</b><span>پرونده ارجاع‌شده</span></div><div><MessageCircle/><b>{unreadCount.toLocaleString("fa-IR")}</b><span>اعلان خوانده‌نشده</span></div></div>
    <b className="office-secretary-label">می‌خواهید کجا برویم؟</b>
    <button className="office-secretary-action" onClick={()=>{onNavigate("cases");setOpen(false)}}><span><BriefcaseBusiness/></span><div><b>رسیدگی به پرونده‌ها</b><small>مشاهده ارجاع‌ها و گفتگوهای کشاورزان</small></div><ChevronDown/></button>
    <button className="office-secretary-action" onClick={()=>{onNavigate("case-operations");setOpen(false)}}><span><ClipboardCheck/></span><div><b>میز عملیات پرونده‌ها</b><small>بررسی و مدیریت جریان کار تخصصی</small></div><ChevronDown/></button>
    <button className="office-secretary-action" onClick={()=>{onNavigate("signals");setOpen(false)}}><span><CalendarClock/></span><div><b>اعلان‌ها و پیگیری‌ها</b><small>مواردی که نیازمند توجه شما هستند</small></div><ChevronDown/></button>
    {sent&&<p className="office-secretary-note">پیام شما در این پیش‌نمایش ثبت شد. اتصال گفت‌وگوی هوشمند در مرحله یکپارچه‌سازی فعال می‌شود.</p>}
   </div>
   <form className="office-secretary-compose" onSubmit={submit}><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="برای سارینا یادداشت یا درخواست بنویسید..." aria-label="پیام به منشی سارینا"/><button disabled={!draft.trim()} aria-label="ارسال"><ArrowUp/></button></form>
   <footer className="office-secretary-foot">منشی دیجیتال دفتر تخصصی شما · SARINA</footer>
  </section>}
  <div className="office-secretary-launcher">
   <button className="office-secretary-invite" onClick={()=>setOpen(v=>!v)} aria-expanded={open}><b>{open?"در خدمتم، دکتر":"سلام دکتر، کاری دارید؟"}</b><span>منشی سارینا اینجاست</span></button>
   <button className="office-secretary-avatar" onClick={()=>setOpen(v=>!v)} aria-label="باز کردن منشی سارینا"><SecretaryPortrait/><span/></button>
  </div>
 </div>;
}
