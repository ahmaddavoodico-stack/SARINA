import {useEffect,useMemo,useState} from "react";
import type {FormEvent} from "react";
import type {Session} from "@supabase/supabase-js";
import {AlertCircle,CheckCircle2,FileText,Inbox,Landmark,MessageCircle,RefreshCw,Search,Send,ShieldCheck} from "lucide-react";
import {supabase} from "../lib/supabase";

type AuthorityOrg={id:string;display_name:string;legal_name:string;organization_type:string};
type Recipient={recipient_kind:"farmer"|"expert";public_code:string;display_name:string|null;consent_expires_at:string|null};
type CaseRow={id:string;request_number:number;request_title:string;farmer_message:string|null;status:string;submitted_at:string;organization_response:string|null;rejection_reason:string|null;official_reference:string|null};
type CaseEvent={id:string;event_type:string;from_status:string|null;to_status:string|null;message:string|null;occurred_at:string;is_visible_to_farmer:boolean};
type Thread={id:string;recipient_user_id:string;recipient_kind:string;recipient_code:string;subject:string;updated_at:string;organization_display_name:string|null};
type Message={id:string;sender_user_id:string;message_text:string;created_at:string;read_at:string|null};
const db=supabase as any;
const authorityTypes=["government","regulator","support_agency","public_institution"];
const statusLabels:Record<string,string>={submitted:"ثبت‌شده",needs_information:"نیازمند اطلاعات",accepted:"پذیرفته‌شده",in_progress:"در حال بررسی",forwarded_to_authority:"ارجاع به مرجع رسمی",awaiting_official_response:"در انتظار پاسخ مرجع",approved:"تأییدشده",rejected:"ردشده",completed:"تکمیل‌شده",unable_to_route:"نیازمند بررسی مسیر",withdrawn:"پس‌گرفته‌شده"};
const statusTransitions:Record<string,[string,string][] >={submitted:[["accepted","پذیرفته‌شده"],["needs_information","درخواست اطلاعات تکمیلی"],["in_progress","در حال بررسی"],["unable_to_route","نیازمند بررسی مسیر"]],needs_information:[["accepted","پذیرفته‌شده"],["in_progress","در حال بررسی"],["rejected","ردشده"],["unable_to_route","نیازمند بررسی مسیر"]],accepted:[["in_progress","در حال بررسی"],["forwarded_to_authority","ارجاع به مرجع رسمی"],["needs_information","درخواست اطلاعات تکمیلی"],["completed","تکمیل‌شده"],["rejected","ردشده"]],in_progress:[["needs_information","درخواست اطلاعات تکمیلی"],["forwarded_to_authority","ارجاع به مرجع رسمی"],["awaiting_official_response","در انتظار پاسخ مرجع"],["approved","تأییدشده"],["rejected","ردشده"],["completed","تکمیل‌شده"]],forwarded_to_authority:[["awaiting_official_response","در انتظار پاسخ مرجع"],["approved","تأییدشده"],["rejected","ردشده"],["completed","تکمیل‌شده"]],awaiting_official_response:[["approved","تأییدشده"],["rejected","ردشده"],["completed","تکمیل‌شده"],["in_progress","بازگشت به بررسی"]],unable_to_route:[],approved:[],rejected:[],completed:[],withdrawn:[]};
const stamp=(value:string)=>new Date(value).toLocaleString("fa-IR",{dateStyle:"short",timeStyle:"short"});

export default function JihadAuthorityWorkspace({session}:{session:Session}){
 const [loading,setLoading]=useState(true),[orgs,setOrgs]=useState<AuthorityOrg[]>([]),[orgId,setOrgId]=useState(""),[userId,setUserId]=useState("");
 const [tab,setTab]=useState<"cases"|"compose"|"messages">("cases");
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [cases,setCases]=useState<CaseRow[]>([]),[caseQuery,setCaseQuery]=useState(""),[selectedCaseId,setSelectedCaseId]=useState(""),[events,setEvents]=useState<CaseEvent[]>([]);
 const [caseStatus,setCaseStatus]=useState(""),[caseResponse,setCaseResponse]=useState(""),[caseEventMessage,setCaseEventMessage]=useState(""),[caseBusy,setCaseBusy]=useState(false);
 const [code,setCode]=useState(""),[recipient,setRecipient]=useState<Recipient|null>(null),[searched,setSearched]=useState(false),[lookupBusy,setLookupBusy]=useState(false);
 const [subject,setSubject]=useState(""),[message,setMessage]=useState(""),[sendBusy,setSendBusy]=useState(false);
 const [threads,setThreads]=useState<Thread[]>([]),[activeThreadId,setActiveThreadId]=useState(""),[threadMessages,setThreadMessages]=useState<Message[]>([]),[replyText,setReplyText]=useState("");
 const [refreshing,setRefreshing]=useState(false);
 const selected=useMemo(()=>orgs.find(x=>x.id===orgId)||null,[orgs,orgId]);
 const selectedCase=cases.find(x=>x.id===selectedCaseId)||null;
 const filteredCases=useMemo(()=>cases.filter(x=>(x.request_title+" "+x.request_number+" "+x.status).toLowerCase().includes(caseQuery.toLowerCase())),[cases,caseQuery]);
 const activeThread=threads.find(x=>x.id===activeThreadId)||null;

 async function loadCases(id:string){
  const {data,error:loadError}=await db.from("institutional_service_requests")
   .select("id,request_number,request_title,farmer_message,status,submitted_at,organization_response,rejection_reason,official_reference")
   .eq("organization_id",id).order("submitted_at",{ascending:false}).limit(100);
  if(loadError)throw loadError;
  setCases((data||[]) as CaseRow[]);
  if(selectedCaseId&&!((data||[]) as CaseRow[]).some(x=>x.id===selectedCaseId)){setSelectedCaseId("");setEvents([]);}
 }
 async function loadThreads(id:string){
  const {data,error:loadError}=await db.from("institutional_message_threads")
   .select("id,recipient_user_id,recipient_kind,recipient_code,subject,updated_at,organization_display_name")
   .eq("organization_id",id).order("updated_at",{ascending:false}).limit(100);
  if(loadError)throw loadError;
  setThreads((data||[]) as Thread[]);
  if(activeThreadId&&!((data||[]) as Thread[]).some(x=>x.id===activeThreadId)){setActiveThreadId("");setThreadMessages([]);}
 }
 async function refreshData(id=orgId){
  if(!id)return;setRefreshing(true);setError("");
  try{await Promise.all([loadCases(id),loadThreads(id)]);}
  catch(e){setError(e instanceof Error?e.message:"دریافت کارتابل سازمانی انجام نشد. سطح دسترسی سازمان را بررسی کنید.");}
  finally{setRefreshing(false);}
 }
 useEffect(()=>{let live=true;(async()=>{
  if(!supabase){setLoading(false);return;}
  try{
   const {data:uid,error:uidError}=await db.rpc("current_sarina_user_id");
   if(uidError||!uid)throw new Error("شناسه کاربر سازمانی دریافت نشد.");
   const {data:members,error:memberError}=await db.from("organization_members").select("organization_id").eq("user_id",uid).eq("status","active");
   if(memberError)throw memberError;
   const ids=[...new Set((members||[]).map((x:any)=>x.organization_id).filter(Boolean))];
   if(!ids.length){setOrgs([]);return;}
   const {data:organizations,error:orgError}=await db.from("organizations").select("id,display_name,legal_name,organization_type").in("id",ids).eq("status","verified").in("organization_type",authorityTypes).order("display_name");
   if(orgError)throw orgError;
   if(live){setUserId(uid);setOrgs((organizations||[]) as AuthorityOrg[]);if(organizations?.length)setOrgId(organizations[0].id);}
  }catch(e){if(live)setError(e instanceof Error?e.message:"دریافت دسترسی سازمانی ممکن نشد.");}
  finally{if(live)setLoading(false);}
 })();return()=>{live=false;};},[session.user.id]);

 useEffect(()=>{if(orgId)void refreshData(orgId);},[orgId]);
 async function selectCase(row:CaseRow){
  setSelectedCaseId(row.id);setCaseStatus(row.status);setCaseResponse(row.organization_response||"");setCaseEventMessage("");
  const {data,error:eventsError}=await db.from("institutional_request_events")
   .select("id,event_type,from_status,to_status,message,occurred_at,is_visible_to_farmer")
   .eq("request_id",row.id).order("occurred_at",{ascending:false}).limit(40);
  if(eventsError){setEvents([]);setNotice("تاریخچه پرونده در محدوده دسترسی فعلی قابل دریافت نیست.");return;}
  setEvents((data||[]) as CaseEvent[]);
 }
 async function updateCase(event:FormEvent){
  event.preventDefault();if(!selectedCase||!caseStatus||caseBusy)return;
  setCaseBusy(true);setError("");setNotice("");
  const {data,error:updateError}=await db.rpc("update_institutional_service_request",{
   p_request_id:selectedCase.id,p_status:caseStatus,p_organization_response:caseResponse.trim()||null,p_event_message:caseEventMessage.trim()||null
  });
  setCaseBusy(false);
  if(updateError){setError("به‌روزرسانی پرونده انجام نشد: "+updateError.message);return;}
  setNotice("وضعیت پرونده تغییر کرد و رویداد قابل مشاهده برای کشاورز ثبت شد.");
  await refreshData();await selectCase({...selectedCase,status:caseStatus,organization_response:caseResponse});
 }
 async function lookupRecipient(event:FormEvent){
  event.preventDefault();if(!orgId||!code.trim())return;
  setLookupBusy(true);setError("");setNotice("");setRecipient(null);setSearched(false);
  const {data,error:lookupError}=await db.rpc("lookup_institutional_message_recipient",{p_organization_id:orgId,p_public_code:code.trim().toUpperCase()});
  setLookupBusy(false);setSearched(true);
  if(lookupError){setError("بررسی مخاطب انجام نشد. قابلیت communications.send، محدوده سازمان و رضایت مخاطب را بررسی کنید.");return;}
  const row=Array.isArray(data)?data[0]:data;
  if(!row){setError("مخاطب پیدا نشد یا رضایت پیام‌رسانی و محدوده مجاز فعال نیست.");return;}
  setRecipient(row as Recipient);
 }
 async function sendMessage(event:FormEvent){
  event.preventDefault();if(!recipient||!subject.trim()||!message.trim()||sendBusy)return;
  setSendBusy(true);setError("");setNotice("");
  const {data,error:sendError}=await db.rpc("send_institutional_message",{
   p_organization_id:orgId,p_public_code:recipient.public_code,p_subject:subject.trim(),p_message:message.trim()
  });
  setSendBusy(false);
  if(sendError){setError("ارسال پیام انجام نشد: "+sendError.message);return;}
  setNotice("پیام در صندوق داخلی SARINA ثبت و برای مخاطب ارسال شد.");
  setMessage("");setRecipient(null);setSearched(false);setCode("");setSubject("");
  await refreshData();
  const row=Array.isArray(data)?data[0]:data;
  if(row?.thread_id){setTab("messages");await loadThread(row.thread_id);}
 }
 async function loadThread(id:string){
  setActiveThreadId(id);setThreadMessages([]);
  const {data,error:loadError}=await db.from("institutional_messages")
   .select("id,sender_user_id,message_text,created_at,read_at").eq("thread_id",id).order("created_at",{ascending:true}).limit(200);
  if(loadError){setError("دریافت پیام‌های مکاتبه انجام نشد: "+loadError.message);return;}
  setThreadMessages((data||[]) as Message[]);
 }
 async function replyToThread(event:FormEvent){
  event.preventDefault();if(!activeThread||!replyText.trim()||sendBusy)return;
  setSendBusy(true);setError("");const {error:sendError}=await db.rpc("send_institutional_message",{
   p_organization_id:orgId,p_public_code:activeThread.recipient_code,p_subject:activeThread.subject,p_message:replyText.trim()
  });
  setSendBusy(false);
  if(sendError){setError("ارسال پیام انجام نشد: "+sendError.message);return;}
  setReplyText("");await loadThread(activeThread.id);await refreshData();
 }
 if(loading)return <div className="jihad-authority-card" dir="rtl"><p>در حال بررسی عضویت و دسترسی سازمانی...</p></div>;
 if(!orgs.length)return null;
 return <section className="jihad-authority-card" dir="rtl">
  <style>{`
   .jihad-authority-card{margin:18px 0;padding:20px;border:1px solid #d8e6d8;border-radius:18px;background:#f7faf6;color:#284b34;display:grid;gap:15px}
   .jaw-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.jaw-head h2{font-size:19px;margin:6px 0}.jaw-head p,.jaw-muted{font-size:11px;color:#6d7f70;line-height:1.9;margin:0}.jaw-kicker{display:flex;align-items:center;gap:7px;color:#527a59;font-size:10px;font-weight:800}
   .jaw-orgrow{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,1fr);gap:10px}.jaw-orgrow label,.jaw-field{display:grid;gap:6px;font-size:11px;font-weight:700}
   .jaw-orgrow select,.jaw-field input,.jaw-field textarea,.jaw-field select,.jaw-search input,.jaw-toolbar input{width:100%;border:1px solid #d6e2d5;border-radius:10px;background:#fff;padding:11px;color:#294b34;font:inherit;font-size:12px;min-width:0}
   .jaw-field textarea{resize:vertical;line-height:1.8}.jaw-search{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;align-items:end}
   .jaw-button{border:0;border-radius:10px;background:#2e6940;color:white;padding:11px 15px;font:inherit;font-size:11px;font-weight:700;display:inline-flex;gap:7px;align-items:center;justify-content:center;cursor:pointer}.jaw-button:disabled{opacity:.5;cursor:not-allowed}.jaw-button.secondary{border:1px solid #d6e2d5;background:#fff;color:#345d3d}
   .jaw-alert{padding:10px 12px;border-radius:11px;background:#fff5e8;color:#805e2b;font-size:10px;line-height:1.8}.jaw-success{padding:10px 12px;border-radius:11px;background:#edf6ec;color:#416a48;font-size:10px;line-height:1.8}
   .jaw-tabs{display:flex;gap:7px;flex-wrap:wrap;border-bottom:1px solid #dfe8dc;padding-bottom:10px}.jaw-tabs button{border:1px solid #d9e5d7;background:#fff;color:#5c725f;padding:9px 13px;border-radius:10px;font:inherit;font-size:10px;cursor:pointer}.jaw-tabs button.active{background:#2e6940;color:white;border-color:#2e6940}
   .jaw-panel{background:#fff;border:1px solid #e0e9de;border-radius:13px;padding:13px;display:grid;gap:11px;min-width:0}.jaw-grid{display:grid;grid-template-columns:minmax(220px,.8fr) minmax(0,1.2fr);gap:11px}.jaw-list{display:grid;align-content:start;gap:6px;max-height:430px;overflow:auto}.jaw-row{display:grid;gap:4px;text-align:right;padding:10px;border:1px solid #e8eee6;border-radius:10px;background:#fff;color:#35583c;cursor:pointer}.jaw-row.active{background:#f0f7ef;border-color:#b9d1b7}.jaw-row b{font-size:11px}.jaw-row small{font-size:9px;color:#829087;line-height:1.7}
   .jaw-detail{display:grid;gap:10px;min-width:0}.jaw-detail h3{margin:0;font-size:14px}.jaw-meta{display:flex;gap:7px;flex-wrap:wrap}.jaw-chip{background:#edf5ec;color:#55745a;border-radius:30px;padding:5px 9px;font-size:9px}
   .jaw-history{display:grid;gap:7px;max-height:260px;overflow:auto}.jaw-event{padding:9px;border:1px solid #e7ede5;border-radius:9px}.jaw-event b{font-size:10px}.jaw-event p{font-size:10px;line-height:1.8;margin:4px 0;color:#5c6e60}.jaw-event small{font-size:9px;color:#8a968d}
   .jaw-empty{padding:13px;border:1px dashed #cbdacb;border-radius:11px;color:#728273;font-size:10px;line-height:1.9;text-align:center}
   .jaw-recipient{padding:13px;border:1px solid #dce8da;background:white;border-radius:12px;display:grid;gap:6px}.jaw-recipient strong{font:800 16px ui-monospace,monospace;direction:ltr}.jaw-recipient small{font-size:10px;color:#748276}
   .jaw-compose{display:grid;gap:10px}.jaw-compose-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
   .jaw-thread-list{display:grid;gap:6px;max-height:300px;overflow:auto}.jaw-thread-row{display:grid;gap:4px;padding:10px;border:1px solid #e5ece3;border-radius:10px;background:white;text-align:right;cursor:pointer;color:#36583c}.jaw-thread-row.active{background:#eff7ee;border-color:#b9d1b7}.jaw-thread-row b{font-size:11px}.jaw-thread-row small{font-size:9px;color:#849087}
   .jaw-messages{display:flex;flex-direction:column;gap:8px;max-height:320px;overflow:auto;background:#fbfcfa;border:1px solid #e8eee6;border-radius:10px;padding:10px}.jaw-message{align-self:flex-start;max-width:90%;padding:9px 11px;border:1px solid #e3eae1;background:white;border-radius:11px 11px 3px 11px}.jaw-message.mine{align-self:flex-end;background:#eef6ed;border-color:#d9e8d7;border-radius:11px 11px 11px 3px}.jaw-message p{margin:0;font-size:10px;line-height:1.8;white-space:pre-wrap}.jaw-message small{display:block;margin-top:4px;font-size:9px;color:#89948b}
   @media(max-width:680px){.jaw-head{flex-direction:column}.jaw-orgrow,.jaw-search,.jaw-grid,.jaw-compose-grid{grid-template-columns:1fr}}
  `}</style>
  <div className="jaw-head"><div><span className="jaw-kicker"><Landmark size={16}/> SARINA · عملیات سازمانی</span><h2>کارتابل جهاد کشاورزی</h2><p>رسیدگی به درخواست‌های واقعی، مکاتبه با کد یکتای کشاورز یا متخصص و ثبت تاریخچه اقدامات؛ دسترسی‌ها در پایگاه داده کنترل می‌شوند.</p></div><ShieldCheck size={26}/></div>
  <div className="jaw-orgrow"><label>سازمان فعال<select value={orgId} onChange={e=>{setOrgId(e.target.value);setSelectedCaseId("");setActiveThreadId("");setRecipient(null);setError("");}}>{orgs.map(o=><option key={o.id} value={o.id}>{o.display_name}</option>)}</select></label><div className="jaw-empty"><b>{selected?.legal_name}</b><br/>سازمان تأییدشده · عضویت فعال</div></div>
  <div className="jaw-tabs"><button className={tab==="cases"?"active":""} onClick={()=>setTab("cases")}><FileText size={13}/> درخواست‌های کشاورزان ({cases.length.toLocaleString("fa-IR")})</button><button className={tab==="compose"?"active":""} onClick={()=>setTab("compose")}><Send size={13}/> ارسال پیام جدید</button><button className={tab==="messages"?"active":""} onClick={()=>setTab("messages")}><Inbox size={13}/> مکاتبات ({threads.length.toLocaleString("fa-IR")})</button><button className="jaw-button secondary" onClick={()=>void refreshData()} disabled={refreshing}><RefreshCw size={13}/> تازه‌سازی</button></div>
  {error&&<div className="jaw-alert"><AlertCircle size={14} style={{verticalAlign:"middle",marginLeft:5}}/>{error}</div>}{notice&&<div className="jaw-success"><CheckCircle2 size={14} style={{verticalAlign:"middle",marginLeft:5}}/>{notice}</div>}
  {tab==="cases"&&<div className="jaw-grid">
   <div className="jaw-panel"><label className="jaw-field">جست‌وجوی درخواست<input value={caseQuery} onChange={e=>setCaseQuery(e.target.value)} placeholder="عنوان، شماره یا وضعیت..."/></label><div className="jaw-list">{filteredCases.length===0?<div className="jaw-empty">درخواست قابل مشاهده‌ای وجود ندارد یا قابلیت service.requests.manage برای این سازمان فعال نشده است.</div>:filteredCases.map(row=><button key={row.id} className={"jaw-row"+(selectedCaseId===row.id?" active":"")} onClick={()=>void selectCase(row)}><b>{row.request_title}</b><small>شماره {Number(row.request_number).toLocaleString("fa-IR")} · {statusLabels[row.status]||row.status}</small><small>{stamp(row.submitted_at)}</small></button>)}</div></div>
   <div className="jaw-panel">{!selectedCase?<div className="jaw-empty"><FileText size={25}/><br/>برای مشاهده جزئیات و تاریخچه، یک درخواست را انتخاب کنید.</div>:<div className="jaw-detail"><div><h3>{selectedCase.request_title}</h3><div className="jaw-meta"><span className="jaw-chip">درخواست {Number(selectedCase.request_number).toLocaleString("fa-IR")}</span><span className="jaw-chip">{statusLabels[selectedCase.status]||selectedCase.status}</span><span className="jaw-chip">{stamp(selectedCase.submitted_at)}</span></div></div><div className="jaw-panel"><b style={{fontSize:11}}>پیام ثبت‌شده توسط کشاورز</b><p style={{fontSize:11,lineHeight:1.9,whiteSpace:"pre-wrap",margin:0}}>{selectedCase.farmer_message||"پیامی ثبت نشده است."}</p></div>{selectedCase.official_reference&&<small className="jaw-muted">شماره مرجع رسمی: {selectedCase.official_reference}</small>}<b style={{fontSize:11}}>تاریخچه اقدامات</b><div className="jaw-history">{events.length===0?<div className="jaw-empty">رویداد قابل مشاهده‌ای ثبت نشده است.</div>:events.map(ev=><article className="jaw-event" key={ev.id}><b>{ev.event_type==="status_changed"?"تغییر وضعیت":ev.event_type}</b><small> · {stamp(ev.occurred_at)} {ev.is_visible_to_farmer?"· قابل مشاهده برای کشاورز":""}</small>{ev.from_status&&<p>{statusLabels[ev.from_status]||ev.from_status} ← {statusLabels[ev.to_status||""]||ev.to_status}</p>}{ev.message&&<p>{ev.message}</p>}</article>)}</div><form className="jaw-compose" onSubmit={updateCase}><div className="jaw-compose-grid"><label className="jaw-field">وضعیت جدید<select value={caseStatus} onChange={e=>setCaseStatus(e.target.value)}>{(statusTransitions[selectedCase.status]||[]).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label className="jaw-field">پاسخ رسمی سازمان<textarea rows={2} value={caseResponse} onChange={e=>setCaseResponse(e.target.value)} maxLength={5000} placeholder="پاسخ یا نتیجه بررسی..."/></label></div><label className="jaw-field">یادداشت رویداد برای کشاورز (اختیاری)<textarea rows={2} value={caseEventMessage} onChange={e=>setCaseEventMessage(e.target.value)} maxLength={3000} placeholder="توضیحی که در تاریخچه پرونده نمایش داده می‌شود"/></label><button className="jaw-button" type="submit" disabled={caseBusy||!caseStatus||caseStatus===selectedCase.status||!(statusTransitions[selectedCase.status]||[]).length}>{caseBusy?"در حال ثبت...":(statusTransitions[selectedCase.status]||[]).length?"ثبت اقدام و اطلاع‌رسانی به کشاورز":"این پرونده بسته شده و تغییر وضعیت ندارد"}</button></form></div>}</div>
  </div>}
  {tab==="compose"&&<div className="jaw-panel"><form className="jaw-compose" onSubmit={lookupRecipient}><label className="jaw-field">کد یکتای SARINA کشاورز یا متخصص<input value={code} onChange={e=>{setCode(e.target.value.toUpperCase());setRecipient(null);setSearched(false);}} placeholder="SRN-XXXX-XXXX-XXXX-XXXX یا EXP-XXXX-XXXX-XXXX-XXXX" autoComplete="off" spellCheck={false}/></label><button className="jaw-button" type="submit" disabled={lookupBusy||!code.trim()}><Search size={14}/>{lookupBusy?"در حال بررسی...":"بررسی کد و رضایت مخاطب"}</button></form>{searched&&!recipient&&!error&&<div className="jaw-empty">مخاطبی با این کد در محدوده مجاز و با رضایت فعال پیدا نشد.</div>}{recipient&&<div className="jaw-recipient"><strong>{recipient.public_code}</strong><b>{recipient.display_name||"مخاطب SARINA"}</b><small>{recipient.recipient_kind==="farmer"?"کشاورز":"متخصص تأییدشده"} · رضایت فعال برای دریافت پیام رسمی</small><small>{recipient.consent_expires_at?"اعتبار رضایت تا "+new Date(recipient.consent_expires_at).toLocaleDateString("fa-IR"):"رضایت بدون تاریخ انقضا"}</small></div>}{recipient&&<form className="jaw-compose" onSubmit={sendMessage}><label className="jaw-field">موضوع پیام<input value={subject} onChange={e=>setSubject(e.target.value)} maxLength={180} required placeholder="موضوع مکاتبه"/></label><label className="jaw-field">متن پیام<textarea rows={5} value={message} onChange={e=>setMessage(e.target.value)} maxLength={5000} required placeholder="متن پیام رسمی را بنویسید..."/></label><button className="jaw-button" type="submit" disabled={sendBusy||!subject.trim()||!message.trim()}><Send size={14}/>{sendBusy?"در حال ارسال...":"ارسال پیام در SARINA"}</button></form>}<p className="jaw-muted">ارسال پیام فقط در صندوق داخلی SARINA انجام می‌شود. ارسال از طریق بله، تلگرام یا پیامک تا زمان اتصال و تأیید کانال مستقل، فعال تلقی نمی‌شود.</p></div>}
  {tab==="messages"&&<div className="jaw-grid"><div className="jaw-panel"><b style={{fontSize:12}}>مکاتبات سازمانی</b><div className="jaw-thread-list">{threads.length===0?<div className="jaw-empty">مکاتبه‌ای وجود ندارد یا قابلیت communications.read برای این سازمان فعال نشده است.</div>:threads.map(t=><button key={t.id} className={"jaw-thread-row"+(activeThreadId===t.id?" active":"")} onClick={()=>void loadThread(t.id)}><b>{t.recipient_kind==="farmer"?"کشاورز":"متخصص"} · {t.subject}</b><small>{t.recipient_code} · {stamp(t.updated_at)}</small></button>)}</div></div><div className="jaw-panel">{!activeThread?<div className="jaw-empty"><MessageCircle size={24}/><br/>یک مکاتبه را انتخاب کنید.</div>:<div className="jaw-detail"><h3>{activeThread.subject}</h3><div className="jaw-meta"><span className="jaw-chip">{activeThread.recipient_kind==="farmer"?"کشاورز":"متخصص"}</span><span className="jaw-chip">{activeThread.recipient_code}</span></div><div className="jaw-messages">{threadMessages.map(m=><article key={m.id} className={"jaw-message"+(m.sender_user_id===userId?" mine":"")}><p>{m.message_text}</p><small>{stamp(m.created_at)} {m.sender_user_id===userId?"· سازمان":"· مخاطب"}</small></article>)}</div><form className="jaw-compose" onSubmit={replyToThread}><label className="jaw-field">پیام بعدی<textarea rows={3} value={replyText} onChange={e=>setReplyText(e.target.value)} maxLength={5000} placeholder="ادامه مکاتبه..."/></label><button className="jaw-button" type="submit" disabled={sendBusy||!replyText.trim()}><Send size={14}/>ارسال پیام</button></form></div>}</div></div>}
  <div className="jaw-muted"><ShieldCheck size={13} style={{verticalAlign:"middle",marginLeft:5}}/>تمامی جست‌وجوها، ارسال پیام‌ها و تغییر وضعیت پرونده‌ها در سمت سرور با عضویت، قابلیت و محدوده سازمانی کنترل و برای ممیزی ثبت می‌شوند. پیام‌رسانی این نسخه داخلی است و به معنی اتصال زنده به پیام‌رسان‌های بیرونی نیست.</div>
 </section>;
}
