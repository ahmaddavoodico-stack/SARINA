import {useCallback,useEffect,useState} from "react";
import {CheckCircle2,Copy,Inbox,LoaderCircle,MessageCircle,RefreshCw,Send,ShieldCheck} from "lucide-react";
import {supabase} from "../lib/supabase";

type Props={userId:string;mode:"farmer"|"expert"};
type Thread={id:string;organization_id:string;organization_display_name:string|null;subject:string;status:string;created_at:string;updated_at:string;recipient_code:string};
type Message={id:string;thread_id:string;sender_user_id:string;message_text:string;created_at:string;read_at:string|null};
const db=supabase as any;
const stamp=(value:string)=>new Date(value).toLocaleString("fa-IR",{dateStyle:"short",timeStyle:"short"});

export default function InstitutionalMessageInbox({userId,mode}:Props){
 const [threads,setThreads]=useState<Thread[]>([]);
 const [active,setActive]=useState("");
 const [messages,setMessages]=useState<Message[]>([]);
 const [draft,setDraft]=useState("");
 const [loading,setLoading]=useState(true);
 const [sending,setSending]=useState(false);
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 const [expertProfileId,setExpertProfileId]=useState("");
 const [expertCode,setExpertCode]=useState("");
 const [consentActive,setConsentActive]=useState(false);
 const [consentBusy,setConsentBusy]=useState(false);

 const refresh=useCallback(async()=>{
  if(!supabase){setLoading(false);return;}
  setError("");
  try{
   if(mode==="expert"){
    const p=await db.from("expert_profiles").select("id,verification_status").eq("user_id",userId).maybeSingle();
    if(p.error)throw p.error;
    if(p.data?.verification_status==="verified"){
     setExpertProfileId(p.data.id);
     const [codeResult,consentResult]=await Promise.all([
      db.rpc("ensure_my_expert_public_identifier"),
      db.from("expert_authority_consents").select("id,status,expires_at").eq("expert_profile_id",p.data.id).is("organization_id",null).eq("status","active").order("created_at",{ascending:false}).limit(1)
     ]);
     if(codeResult.error)throw codeResult.error;
     setExpertCode(String(codeResult.data||""));
     const valid=(consentResult.data||[]).some((x:any)=>!x.expires_at||new Date(x.expires_at).getTime()>Date.now());
     setConsentActive(valid);
    }else{
     setExpertProfileId("");setExpertCode("");setConsentActive(false);
    }
   }
   const r=await db.from("institutional_message_threads")
    .select("id,organization_id,organization_display_name,subject,status,created_at,updated_at,recipient_code")
    .eq("recipient_user_id",userId).order("updated_at",{ascending:false}).limit(50);
   if(r.error)throw r.error;
   const next=(r.data||[]) as Thread[];
   setThreads(next);
   if(active&&!next.some(t=>t.id===active)){setActive("");setMessages([]);}
  }catch(e){setError(e instanceof Error?e.message:"دریافت پیام‌های سازمانی انجام نشد.");}
  finally{setLoading(false);}
 },[userId,mode,active]);

 useEffect(()=>{void refresh();},[refresh]);
 useEffect(()=>{
  if(!supabase)return;
  const channel=supabase.channel("institutional-inbox-"+mode+"-"+userId)
   .on("postgres_changes",{event:"*",schema:"public",table:"institutional_message_threads",filter:"recipient_user_id=eq."+userId},()=>{void refresh();})
   .subscribe();
  return()=>{void supabase!.removeChannel(channel);};
 },[userId,mode,refresh]);

 const loadThread=useCallback(async(id:string)=>{
  setActive(id);setMessages([]);setNotice("");
  const {data,error:readError}=await db.rpc("mark_institutional_thread_read",{p_thread_id:id});
  if(readError){setNotice("بازکردن پیام ممکن نشد: "+readError.message);return;}
  const result=await db.from("institutional_messages").select("id,thread_id,sender_user_id,message_text,created_at,read_at")
   .eq("thread_id",id).order("created_at",{ascending:true}).limit(200);
  if(result.error){setNotice("دریافت محتوای پیام انجام نشد: "+result.error.message);return;}
  setMessages((result.data||[]) as Message[]);
  void refresh();
 },[refresh]);

 useEffect(()=>{
  if(!supabase||!active)return;
  const channel=supabase.channel("institutional-message-thread-"+active)
   .on("postgres_changes",{event:"INSERT",schema:"public",table:"institutional_messages",filter:"thread_id=eq."+active},()=>{void loadThread(active);})
   .subscribe();
  return()=>{void supabase!.removeChannel(channel);};
 },[active,loadThread]);

 async function reply(event:React.FormEvent){
  event.preventDefault();const text=draft.trim();
  if(!active||!text||text.length>5000||sending)return;
  setSending(true);setNotice("");
  const {error:replyError}=await db.rpc("reply_institutional_message",{p_thread_id:active,p_message:text});
  setSending(false);
  if(replyError){setNotice("پاسخ ارسال نشد: "+replyError.message);return;}
  setDraft("");await loadThread(active);await refresh();
 }

 async function grantExpertConsent(){
  if(!expertProfileId)return;
  setConsentBusy(true);setNotice("");setError("");
  const expiresAt=new Date(Date.now()+90*24*60*60*1000).toISOString();
  const {error:insertError}=await db.from("expert_authority_consents").insert({
   expert_profile_id:expertProfileId,organization_id:null,consent_scopes:["institutional_messaging"],
   purpose_code:"jihad_official_communication",consent_version:"2026-11-22-v1",status:"active",expires_at:expiresAt
  });
  setConsentBusy(false);
  if(insertError){setError("ثبت رضایت ارتباط سازمانی انجام نشد: "+insertError.message);return;}
  setConsentActive(true);setNotice("رضایت دریافت پیام از نهادهای عمومی تأییدشده برای ۹۰ روز ثبت شد.");
 }

 async function revokeExpertConsent(){
  if(!expertProfileId)return;
  setConsentBusy(true);setNotice("");setError("");
  const {error:revokeError}=await db.from("expert_authority_consents").update({status:"revoked",revoked_at:new Date().toISOString()})
   .eq("expert_profile_id",expertProfileId).is("organization_id",null).eq("status","active");
  setConsentBusy(false);
  if(revokeError){setError("لغو رضایت انجام نشد: "+revokeError.message);return;}
  setConsentActive(false);setNotice("رضایت دریافت پیام سازمانی لغو شد؛ پیام‌های قبلی همچنان در سوابق شما باقی می‌مانند.");
 }

 async function copyCode(){
  if(!expertCode)return;
  try{await navigator.clipboard.writeText(expertCode);setNotice("کد یکتای متخصص کپی شد.");}
  catch{setNotice("کد را می‌توانید انتخاب و کپی کنید.");}
 }

 const selected=threads.find(t=>t.id===active)||null;
 const unread=messages.filter(m=>m.sender_user_id!==userId&&!m.read_at).length;
 return <section className="institutional-inbox" dir="rtl">
  <style>{`
   .institutional-inbox{display:grid;gap:13px;margin:18px 0;padding:17px;border:1px solid #dce8dc;border-radius:17px;background:#fff;color:#294b34}
   .iim-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.iim-head h3{margin:5px 0;font-size:16px}.iim-head p{margin:0;color:#758278;font-size:11px;line-height:1.8}
   .iim-expert-code{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:11px 13px;border:1px dashed #b9ceb8;border-radius:12px;background:#f7faf6}
   .iim-expert-code strong{font:800 16px ui-monospace,monospace;direction:ltr}
   .iim-button{display:inline-flex;align-items:center;gap:6px;border:1px solid #d9e4d7;border-radius:9px;background:#fff;padding:8px 11px;color:#345b3c;font:inherit;font-size:10px;cursor:pointer}
   .iim-button.primary{background:#2f6840;color:#fff;border-color:#2f6840}.iim-button:disabled{opacity:.5;cursor:not-allowed}
   .iim-note{padding:10px 12px;border-radius:10px;background:#f1f7ef;color:#58715b;font-size:10px;line-height:1.8}
   .iim-layout{display:grid;grid-template-columns:minmax(220px,.75fr) minmax(0,1.4fr);gap:12px;min-height:250px}
   .iim-list,.iim-thread{border:1px solid #e4ebe3;border-radius:12px;min-width:0;overflow:hidden}
   .iim-list{display:grid;align-content:start;max-height:440px;overflow:auto}
   .iim-thread-row{display:grid;gap:4px;text-align:right;padding:12px;border:0;border-bottom:1px solid #edf0eb;background:#fff;color:#36533d;cursor:pointer}
   .iim-thread-row.active{background:#f0f7ef}.iim-thread-row b{font-size:11px}.iim-thread-row small{font-size:9px;color:#829087}
   .iim-thread{display:grid;grid-template-rows:auto minmax(120px,1fr) auto}
   .iim-thread-head{padding:11px 13px;border-bottom:1px solid #e9eee7}.iim-thread-head b{font-size:12px}.iim-thread-head small{display:block;color:#879187;font-size:9px;margin-top:4px}
   .iim-history{display:flex;flex-direction:column;gap:9px;padding:12px;max-height:340px;overflow:auto;background:#fbfcfa}
   .iim-message{max-width:88%;align-self:flex-start;padding:9px 11px;border:1px solid #e5ebe3;border-radius:12px 12px 3px 12px;background:#fff}
   .iim-message.mine{align-self:flex-end;background:#eef6ed;border-color:#dce9da;border-radius:12px 12px 12px 3px}
   .iim-message p{margin:0;white-space:pre-wrap;font-size:11px;line-height:1.9}.iim-message small{display:block;margin-top:5px;color:#879187;font-size:9px}
   .iim-compose{display:grid;gap:7px;padding:10px;border-top:1px solid #e9eee7}.iim-compose textarea{width:100%;border:1px solid #dce6da;border-radius:9px;padding:9px;font:inherit;font-size:11px;resize:vertical}
   .iim-compose button{justify-self:end}.iim-empty{display:grid;place-content:center;justify-items:center;gap:7px;padding:20px;color:#879187;text-align:center;font-size:11px;line-height:1.8}
   .iim-alert{padding:9px 11px;background:#fff4e9;color:#835e2b;border-radius:9px;font-size:10px;line-height:1.8}
   @media(max-width:680px){.iim-layout{grid-template-columns:1fr}.iim-list{max-height:220px}.iim-head{flex-direction:column}}
  `}</style>
  <header className="iim-head"><div><span className="eyebrow"><Inbox size={14} style={{verticalAlign:"middle"}}/> ارتباط رسمی سازمانی</span><h3>{mode==="farmer"?"پیام‌های نهادهای مرتبط با مزرعه":"پیام‌های سازمانی متخصص"}</h3><p>مکاتبات رسمی داخل SARINA؛ دسترسی و ارسال پاسخ بر اساس رضایت و محدوده مجاز کنترل می‌شود.</p></div><button className="iim-button" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={14}/> تازه‌سازی</button></header>
  {mode==="expert"&&<div className="iim-expert-code"><div><small>کد یکتای متخصص برای مکاتبات سازمانی</small><br/><strong>{expertCode||"پس از تأیید صلاحیت نمایش داده می‌شود"}</strong></div>{expertCode&&<button className="iim-button" type="button" onClick={()=>void copyCode()}><Copy size={13}/> کپی کد</button>}</div>}
  {mode==="expert"&&expertProfileId&&<div className="iim-note"><ShieldCheck size={14} style={{verticalAlign:"middle",marginLeft:5}}/>{consentActive?"رضایت دریافت پیام از سازمان‌های عمومی تأییدشده فعال است.":"برای دریافت پیام از سازمان‌های عمومی تأییدشده، رضایت خود را فعال کنید."}<button className="iim-button" type="button" onClick={()=>void(consentActive?revokeExpertConsent():grantExpertConsent())} disabled={consentBusy}>{consentBusy?"در حال ثبت...":consentActive?"لغو رضایت":"فعال‌سازی رضایت ۹۰ روزه"}</button></div>}
  {mode==="expert"&&!expertProfileId&&<div className="iim-note">کد مکاتبات و امکان دریافت پیام سازمانی پس از تأیید صلاحیت پروفایل متخصص فعال می‌شود.</div>}
  {error&&<div className="iim-alert">{error}</div>}{notice&&<div className="iim-note">{notice}</div>}
  <div className="iim-layout">
   <aside className="iim-list">{loading?<div className="iim-empty"><LoaderCircle size={20}/>در حال دریافت پیام‌ها...</div>:threads.length===0?<div className="iim-empty"><MessageCircle size={24}/><b>هنوز پیام سازمانی ندارید</b><span>پس از ارسال پیام از سوی مرجع مجاز، مکاتبه اینجا نمایش داده می‌شود.</span></div>:threads.map(t=><button type="button" key={t.id} className={"iim-thread-row"+(active===t.id?" active":"")} onClick={()=>void loadThread(t.id)}><b>{t.organization_display_name||"مرجع سازمانی تأییدشده"}</b><span>{t.subject}</span><small>{stamp(t.updated_at)} · {t.recipient_code}</small></button>)}</aside>
   <div className="iim-thread">{!selected?<div className="iim-empty"><MessageCircle size={28}/><b>یک مکاتبه را انتخاب کنید</b><span>تاریخچه پیام‌ها و امکان پاسخ در این بخش قرار دارد.</span></div>:<><header className="iim-thread-head"><b>{selected.organization_display_name||"مرجع سازمانی تأییدشده"}</b><small>{selected.subject} · {unread?"پیام خوانده‌نشده":"سوابق مکاتبه"}</small></header><div className="iim-history">{messages.map(m=><article key={m.id} className={"iim-message"+(m.sender_user_id===userId?" mine":"")}><p>{m.message_text}</p><small>{stamp(m.created_at)} {m.sender_user_id===userId?"· شما":"· سازمان"}</small></article>)}</div><form className="iim-compose" onSubmit={reply}><textarea value={draft} onChange={e=>setDraft(e.target.value)} rows={2} maxLength={5000} placeholder="پاسخ خود را بنویسید..." disabled={sending}/><button className="iim-button primary" type="submit" disabled={sending||!draft.trim()}><Send size={14}/>{sending?"در حال ارسال...":"ارسال پاسخ"}</button></form></>}</div>
  </div>
 </section>;
}
