import {useState} from "react";
import type {FormEvent} from "react";
import {ArrowUp,BriefcaseBusiness,CalendarClock,ChevronDown,ClipboardCheck,Inbox,MessageCircle,Sparkles,X} from "lucide-react";
import SarinaCharacter from "./SarinaCharacter";

type Props={name:string;caseCount:number;unreadCount:number;onNavigate:(tab:string)=>void};
export default function ExpertOfficeSecretary({name,caseCount,unreadCount,onNavigate}:Props){
 const[open,setOpen]=useState(false),[draft,setDraft]=useState(""),[sent,setSent]=useState(false);
 function submit(e:FormEvent){e.preventDefault();if(!draft.trim())return;setSent(true);setDraft("");}
 return <div className="office-secretary" dir="rtl">
  {open&&<section className="office-secretary-panel">
   <header className="office-secretary-head"><SarinaCharacter className="office-secretary-portrait"/><div><b>سارینا · منشی دفتر شما</b><span><i/> آماده همراهی در کارهای امروز</span></div><button onClick={()=>setOpen(false)} aria-label="بستن"><X size={17}/></button></header>
   <div className="office-secretary-content">
    <div className="office-secretary-greeting"><Sparkles size={15}/><div><b>سلام {name} عزیز، خوش آمدید.</b><p>من کنار میز کارتان هستم تا پرونده‌ها و کارهای روزانه را منظم نگه داریم.</p></div></div>
    <div className="office-secretary-summary"><div><Inbox/><b>{caseCount.toLocaleString("fa-IR")}</b><span>پرونده ارجاع‌شده</span></div><div><MessageCircle/><b>{unreadCount.toLocaleString("fa-IR")}</b><span>اعلان خوانده‌نشده</span></div></div>
    <b className="office-secretary-label">می‌خواهید کجا برویم؟</b>
    <button className="office-secretary-action" onClick={()=>{onNavigate("cases");setOpen(false)}}><span><BriefcaseBusiness/></span><div><b>رسیدگی به پرونده‌ها</b><small>مشاهده ارجاع‌ها و گفتگوهای کشاورزان</small></div><ChevronDown/></button>
    <button className="office-secretary-action" onClick={()=>{onNavigate("case-operations");setOpen(false)}}><span><ClipboardCheck/></span><div><b>میز عملیات پرونده‌ها</b><small>بررسی و مدیریت جریان کار تخصصی</small></div><ChevronDown/></button>
    <button className="office-secretary-action" onClick={()=>{onNavigate("recommendation-followup");setOpen(false)}}><span><CalendarClock/></span><div><b>پیگیری نتیجه توصیه‌ها</b><small>مشاهده گزارش اجرا و ارزیابی شواهد کشاورز</small></div><ChevronDown/></button>
    <button className="office-secretary-action" onClick={()=>{onNavigate("signals");setOpen(false)}}><span><CalendarClock/></span><div><b>اعلان‌ها و پیگیری‌ها</b><small>مواردی که نیازمند توجه شما هستند</small></div><ChevronDown/></button>
    {sent&&<p className="office-secretary-note">پیام شما در این پیش‌نمایش ثبت شد. اتصال گفت‌وگوی هوشمند در مرحله یکپارچه‌سازی فعال می‌شود.</p>}
   </div>
   <form className="office-secretary-compose" onSubmit={submit}><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="برای سارینا یادداشت یا درخواست بنویسید..." aria-label="پیام به منشی سارینا"/><button disabled={!draft.trim()} aria-label="ارسال"><ArrowUp/></button></form>
   <footer className="office-secretary-foot">منشی دیجیتال دفتر تخصصی شما · SARINA</footer>
  </section>}
  <div className="office-secretary-launcher">
   <button className="office-secretary-invite" onClick={()=>setOpen(v=>!v)} aria-expanded={open}><b>{open?"در خدمتم، دکتر":"سلام دکتر، کاری دارید؟"}</b><span>منشی سارینا اینجاست</span></button>
   <button className="office-secretary-avatar" onClick={()=>setOpen(v=>!v)} aria-label="باز کردن منشی سارینا"><SarinaCharacter className="office-secretary-portrait"/><span/></button>
  </div>
 </div>;
}
