import {useEffect,useState} from "react";
import {CalendarDays,CheckCircle2,Plus} from "lucide-react";
import {supabase} from "../lib/supabase";
const db=supabase as any;

type FieldOption={id:string;field_name:string};
export default function ExpertRecommendationComposer({requestId,farmId,profileId}:{requestId:string;farmId:string|null;profileId:string}){
 const[title,setTitle]=useState(""),[instructions,setInstructions]=useState(""),[startsOn,setStartsOn]=useState(new Date().toISOString().slice(0,10)),[dueOn,setDueOn]=useState(""),[priority,setPriority]=useState("normal"),[fieldId,setFieldId]=useState(""),[fields,setFields]=useState<FieldOption[]>([]),[fieldError,setFieldError]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{let active=true;async function loadFields(){if(!farmId){setFields([]);setFieldId("");return;}const{data,error}=await db.from("farm_fields").select("id,field_name").eq("farm_id",farmId).order("created_at",{ascending:true});if(!active)return;if(error){setFieldError("فهرست قطعات در دسترس نیست: "+error.message);setFields([]);return;}setFieldError("");setFields(data||[]);}void loadFields();return()=>{active=false;};},[farmId]);
 async function submit(e:React.FormEvent){
  e.preventDefault();if(!supabase||!farmId||!title.trim()||!instructions.trim())return;
  setBusy(true);setMessage("");
  try{
   const{data:{user},error:userError}=await supabase.auth.getUser();if(userError||!user)throw userError||new Error("نشست کاربری معتبر نیست.");
   const{data:person,error:personError}=await db.from("users").select("id").eq("auth_user_id",user.id).single();if(personError)throw personError;
   const{data:consultation,error:consultationError}=await db.from("expert_consultations").select("id").eq("request_id",requestId).maybeSingle();if(consultationError)throw consultationError;if(!consultation)throw new Error("پرونده هنوز جلسه مشاوره ثبت‌شده ندارد.");
   const{error}=await db.from("expert_recommendation_actions").insert({request_id:requestId,consultation_id:consultation.id,farm_id:farmId,field_id:fieldId||null,expert_profile_id:profileId,author_user_id:person.id,title:title.trim(),instructions:instructions.trim(),priority,starts_on:startsOn,due_on:dueOn||null,status:"approved",approved_at:new Date().toISOString()});
   if(error)throw error;
   setTitle("");setInstructions("");setDueOn("");setMessage("توصیه با تأیید شما ثبت شد؛ به‌صورت خودکار به برنامه اجرایی مزرعه افزوده و در گفت‌وگوی پرونده برای کشاورز نمایش داده می‌شود.");
  }catch(error){setMessage(error instanceof Error?error.message:"ثبت توصیه انجام نشد.");}
  finally{setBusy(false);}
 }
 return <form className="expert-recommendation-form" onSubmit={submit}>
  <div className="expert-recommendation-heading"><span><CalendarDays size={16}/> توصیه تخصصی برای برنامه هفتگی</span><small>با فشردن دکمه ثبت، شما توصیه را نهایی می‌کنید؛ SARINA آن را به برنامه اجرایی مزرعه متصل و در گفت‌وگوی پرونده نمایش می‌دهد.</small></div>
  <label>عنوان اقدام<input value={title} onChange={e=>setTitle(e.target.value)} required maxLength={180} placeholder="مثلاً بررسی شوری آب آبیاری"/></label>
  <label>شرح و دستور اجرای توصیه<textarea value={instructions} onChange={e=>setInstructions(e.target.value)} required maxLength={4000} rows={3} placeholder="مراحل اجرا، مقدار یا شرایط لازم و نکات احتیاطی را بنویسید..."/></label>
  <div className="expert-recommendation-fields">
   <label>محدوده اجرای توصیه<select value={fieldId} onChange={e=>setFieldId(e.target.value)}><option value="">کل مزرعه</option>{fields.map(f=><option key={f.id} value={f.id}>{f.field_name}</option>)}</select><small>با انتخاب قطعه، نشانگر این اقدام روی همان بخش نقشه نمایش داده می‌شود.</small></label>
   <label>شروع اجرا<input type="date" value={startsOn} onChange={e=>setStartsOn(e.target.value)} required/></label>
   <label>مهلت انجام<input type="date" min={startsOn} value={dueOn} onChange={e=>setDueOn(e.target.value)}/></label>
   <label>اولویت<select value={priority} onChange={e=>setPriority(e.target.value)}><option value="normal">عادی</option><option value="low">کم</option><option value="high">بالا</option><option value="urgent">فوری</option></select></label>
  </div>
  {fieldError&&<p className="expert-recommendation-message" role="alert">{fieldError}</p>}
  {message&&<p className="expert-recommendation-message" role="status">{message}</p>}
  <button className="expert-primary" disabled={busy||!farmId||!title.trim()||!instructions.trim()}><CheckCircle2 size={15}/>{busy?"در حال ثبت...":"تأیید نهایی و ثبت در برنامه کشاورز"} <Plus size={14}/></button>
 </form>;
}
