import {useState} from "react";
import {CalendarDays,CheckCircle2,Plus} from "lucide-react";
import {supabase} from "../lib/supabase";
const db=supabase as any;

export default function ExpertRecommendationComposer({requestId,farmId,profileId}:{requestId:string;farmId:string|null;profileId:string}){
 const[title,setTitle]=useState(""),[instructions,setInstructions]=useState(""),[startsOn,setStartsOn]=useState(new Date().toISOString().slice(0,10)),[dueOn,setDueOn]=useState(""),[priority,setPriority]=useState("normal"),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function submit(e:React.FormEvent){
  e.preventDefault();if(!supabase||!farmId||!title.trim()||!instructions.trim())return;
  setBusy(true);setMessage("");
  try{
   const{data:{user},error:userError}=await supabase.auth.getUser();if(userError||!user)throw userError||new Error("نشست کاربری معتبر نیست.");
   const{data:person,error:personError}=await db.from("users").select("id").eq("auth_user_id",user.id).single();if(personError)throw personError;
   const{data:consultation,error:consultationError}=await db.from("expert_consultations").select("id").eq("request_id",requestId).maybeSingle();if(consultationError)throw consultationError;if(!consultation)throw new Error("پرونده هنوز جلسه مشاوره ثبت‌شده ندارد.");
   const{error}=await db.from("expert_recommendation_actions").insert({request_id:requestId,consultation_id:consultation.id,farm_id:farmId,expert_profile_id:profileId,author_user_id:person.id,title:title.trim(),instructions:instructions.trim(),priority,starts_on:startsOn,due_on:dueOn||null,status:"approved",approved_at:new Date().toISOString()});
   if(error)throw error;
   setTitle("");setInstructions("");setDueOn("");setMessage("توصیه نهایی تأیید و در برنامه هفتگی کشاورز ثبت شد.");
  }catch(error){setMessage(error instanceof Error?error.message:"ثبت توصیه انجام نشد.");}
  finally{setBusy(false);}
 }
 return <form className="expert-recommendation-form" onSubmit={submit}>
  <div className="expert-recommendation-heading"><span><CalendarDays size={16}/> توصیه تخصصی برای برنامه هفتگی</span><small>با ثبت این فرم، توصیه به‌صورت نهایی و تأییدشده برای کشاورز ارسال می‌شود.</small></div>
  <label>عنوان اقدام<input value={title} onChange={e=>setTitle(e.target.value)} required maxLength={180} placeholder="مثلاً بررسی شوری آب آبیاری"/></label>
  <label>شرح و دستور اجرای توصیه<textarea value={instructions} onChange={e=>setInstructions(e.target.value)} required maxLength={4000} rows={3} placeholder="مراحل اجرا، مقدار یا شرایط لازم و نکات احتیاطی را بنویسید..."/></label>
  <div className="expert-recommendation-fields">
   <label>شروع اجرا<input type="date" value={startsOn} onChange={e=>setStartsOn(e.target.value)} required/></label>
   <label>مهلت انجام<input type="date" min={startsOn} value={dueOn} onChange={e=>setDueOn(e.target.value)}/></label>
   <label>اولویت<select value={priority} onChange={e=>setPriority(e.target.value)}><option value="normal">عادی</option><option value="low">کم</option><option value="high">بالا</option><option value="urgent">فوری</option></select></label>
  </div>
  {message&&<p className="expert-recommendation-message" role="status">{message}</p>}
  <button className="expert-primary" disabled={busy||!farmId||!title.trim()||!instructions.trim()}><CheckCircle2 size={15}/>{busy?"در حال ثبت...":"تأیید نهایی و ارسال به برنامه کشاورز"} <Plus size={14}/></button>
 </form>;
}
