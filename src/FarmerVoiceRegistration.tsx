import {useEffect,useMemo,useRef,useState} from "react";
import type {FormEvent} from "react";
import type {Session} from "@supabase/supabase-js";
import {Check,Mic,Save,SkipForward} from "lucide-react";
import {supabase} from "./lib/supabase";
import FarmMap,{type FarmLocationCapture,type FarmPoint} from "./FarmMap";
import VoiceMessageControls from "./components/VoiceMessageControls";
import type {Json} from "./lib/database.types";

type CropOption={id:string;common_name:string;local_names:Json};
type Step="name"|"map"|"crop"|"role"|"variety"|"age"|"yield"|"irrigation"|"source"|"review"|"saved";
type ChatLine={id:number;role:"farmer"|"sarina";text:string;audioUrl?:string};
type RegistrationDraft={name:string;cropId:string;cropName:string;role:string;variety:string;age:string;yieldAmount:string;irrigation:string;waterSource:string};
type VoicePayload={audio:Blob;mimeType:string};
const roles=[{value:"main_crop",label:"محصول اصلی"},{value:"intercrop",label:"کشت همراه"},{value:"forage",label:"علوفه‌ای"},{value:"cover_crop",label:"پوششی"}];
const irrigation=[{value:"flood",label:"غرقابی"},{value:"furrow",label:"جوی و پشته"},{value:"drip",label:"قطره‌ای"},{value:"sprinkler",label:"بارانی"},{value:"manual",label:"دستی"},{value:"mixed",label:"ترکیبی"}];
const sources=[{value:"canal",label:"کانال یا نهر"},{value:"river",label:"رودخانه"},{value:"well",label:"چاه"},{value:"pond",label:"استخر ذخیره آب"},{value:"rainwater",label:"آب باران"},{value:"network",label:"شبکه آبرسانی"},{value:"other",label:"سایر"}];
const initialDraft:RegistrationDraft={name:"",cropId:"",cropName:"",role:"main_crop",variety:"",age:"",yieldAmount:"",irrigation:"",waterSource:""};
const questions:Partial<Record<Step,string>>={
 name:"سلام، من سارینا هستم. با هم قدم‌به‌قدم پرونده مزرعه‌ات رو می‌سازیم. اول بگو اسم مزرعه‌ات چیه؟",
 map:"حالا محدوده زمین رو روی نقشه مشخص کن. می‌تونی موقعیت GPS رو بگیری یا گوشه‌های زمین رو لمس کنی. بعد از سه نقطه یا بیشتر، محدوده رو تأیید کن.",
 crop:"چه درخت یا محصولی در این مزرعه داری؟ اسمش رو بگو یا از فهرست انتخاب کن.",
 role:"این کشت، محصول اصلی مزرعه است یا کشت همراه، علوفه‌ای یا پوششی؟",
 variety:"رقم یا گونه این محصول چیه؟ اگر نمی‌دونی، می‌تونیم بعداً تکمیلش کنیم.",
 age:"سن درخت‌ها یا کشت دائمی تقریباً چند ساله؟ اگر دقیق نمی‌دونی، یک عدد تقریبی هم خوبه؛ یا فعلاً ردش کن.",
 yield:"به‌طور معمول هر درخت در سال چند کیلو محصول می‌ده؟ اگر فعلاً نمی‌دونی، رد می‌کنیم.",
 irrigation:"روش آبیاری مزرعه چیه؟ مثلاً غرقابی، جوی و پشته یا قطره‌ای.",
 source:"آب آبیاری رو از کجا تأمین می‌کنی؟ مثلاً کانال، رودخانه یا چاه.",
 review:"اطلاعات رو با هم مرور کنیم. اگر تأیید می‌کنی، پرونده مزرعه رو ذخیره می‌کنم."
};
function digits(value:string){return value.replace(/[۰-۹]/g,d=>"۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString()).replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d).toString()).replace(/٫/g,".");}
function polygonAreaM2(points:FarmPoint[]){const radius=6371008.8;let sum=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];sum+=(b.lng-a.lng)*Math.PI/180*(2+Math.sin(a.lat*Math.PI/180)+Math.sin(b.lat*Math.PI/180));}return Math.abs(sum)*radius*radius/2;}
function selfIntersects(points:FarmPoint[]){const orient=(p:FarmPoint,q:FarmPoint,r:FarmPoint)=>(q.lng-p.lng)*(r.lat-p.lat)-(q.lat-p.lat)*(r.lng-p.lng);for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];for(let j=i+1;j<points.length;j++){if(j===i||(j+1)%points.length===i||(i+1)%points.length===j)continue;const c=points[j],d=points[(j+1)%points.length];if(orient(a,b,c)*orient(a,b,d)<0&&orient(c,d,a)*orient(c,d,b)<0)return true;}}return false;}
export default function FarmerVoiceRegistration({session,onClose}:{session:Session;onClose:()=>void}){
 const [step,setStep]=useState<Step>("name"),[draft,setDraft]=useState<RegistrationDraft>(initialDraft),[answer,setAnswer]=useState(""),[points,setPoints]=useState<FarmPoint[]>([]),[capture,setCapture]=useState<FarmLocationCapture|null>(null),[boundaryConfirmed,setBoundaryConfirmed]=useState(false),[cropOptions,setCropOptions]=useState<CropOption[]>([]),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[voiceMode,setVoiceMode]=useState(true),[error,setError]=useState(""),[lines,setLines]=useState<ChatLine[]>([{id:1,role:"sarina",text:questions.name}]);
 const linesRef=useRef<ChatLine[]>(lines);
 const latestPrompt=useMemo(()=>[...lines].reverse().find(x=>x.role==="sarina")?.text,[lines]);
 const areaM2=useMemo(()=>points.length>=3?polygonAreaM2(points):0,[points]);
 const areaHa=areaM2/10000;
 function appendLine(line:ChatLine){setLines(current=>{const next=[...current,line].slice(-24);linesRef.current=next;return next;});}
 function ask(next:Step,message?:string){setStep(next);setError("");setAnswer("");appendLine({id:Date.now()+Math.random(),role:"sarina",text:message||questions[next]||""});}
 useEffect(()=>{let active=true;(async()=>{if(!supabase){setError("اتصال پایگاه داده در دسترس نیست.");setLoading(false);return;}const{data,error}=await supabase.from("crop_catalog").select("id,common_name,local_names").eq("is_active",true).order("common_name");if(!active)return;if(error)setError("فهرست محصولات دریافت نشد؛ اتصال را بررسی کن.");else setCropOptions((data??[]) as CropOption[]);setLoading(false);})();return()=>{active=false;};},[]);
 useEffect(()=>()=>{for(const line of linesRef.current)if(line.audioUrl)URL.revokeObjectURL(line.audioUrl);},[]);
 function matchCrop(text:string){const value=text.trim().toLocaleLowerCase();return cropOptions.find(c=>{const names=[c.common_name,...Object.values((c.local_names||{}) as Record<string,string>)];return names.some(n=>n.toLocaleLowerCase()===value||value.includes(n.toLocaleLowerCase()));});}
 function parseChoice(text:string,options:{value:string;label:string}[]){const value=text.toLocaleLowerCase();return options.find(x=>value.includes(x.label.toLocaleLowerCase())||value.includes(x.value));}
 function submitAnswer(raw:string){
  const value=raw.trim();if(!value||saving)return;appendLine({id:Date.now(),role:"farmer",text:value});setAnswer("");setError("");
  if(step==="name"){setDraft(d=>({...d,name:value}));ask("map");return;}
  if(step==="crop"){const found=matchCrop(value);if(!found){setError("محصول رو از فهرست انتخاب کن تا نام و شناسه درست ثبت بشه.");return;}setDraft(d=>({...d,cropId:found.id,cropName:((found.local_names as any)?.fa||found.common_name)}));ask("role");return;}
  if(step==="role"){const found=parseChoice(value,roles);if(!found){setError("یکی از گزینه‌های نقش کشت رو انتخاب کن.");return;}setDraft(d=>({...d,role:found.value}));ask("variety");return;}
  if(step==="variety"){setDraft(d=>({...d,variety:/^(نمی.?دونم|نمی.?دانم|بعدا|بعداً|رد)/.test(value)?"":value}));ask("age");return;}
  if(step==="age"){const number=Number(digits(value).match(/[0-9]+(?:\.[0-9]+)?/)?.[0]);setDraft(d=>({...d,age:Number.isFinite(number)&&number>=0&&number<=200?String(number):""}));ask("yield");return;}
  if(step==="yield"){const number=Number(digits(value).match(/[0-9]+(?:\.[0-9]+)?/)?.[0]);setDraft(d=>({...d,yieldAmount:Number.isFinite(number)&&number>=0?String(number):""}));ask("irrigation");return;}
  if(step==="irrigation"){const found=parseChoice(value,irrigation);if(!found){setError("روش آبیاری رو از گزینه‌ها انتخاب کن.");return;}setDraft(d=>({...d,irrigation:found.value}));ask("source");return;}
  if(step==="source"){const found=parseChoice(value,sources);if(!found){setError("منبع آب رو از گزینه‌ها انتخاب کن.");return;}setDraft(d=>({...d,waterSource:found.value}));ask("review");return;}
 }
 function skip(){if(step==="variety"){setDraft(d=>({...d,variety:""}));ask("age");}else if(step==="age"){setDraft(d=>({...d,age:""}));ask("yield");}else if(step==="yield"){setDraft(d=>({...d,yieldAmount:""}));ask("irrigation");}else if(step==="irrigation"){setDraft(d=>({...d,irrigation:""}));ask("source");}else if(step==="source"){setDraft(d=>({...d,waterSource:""}));ask("review");}}
 async function saveFarm(){
  if(!supabase||saving)return;if(!draft.name.trim()||!draft.cropId||points.length<3||!boundaryConfirmed){setError("نام مزرعه، محصول و محدوده تأییدشده برای ثبت لازم‌اند.");return;}if(selfIntersects(points)||areaM2<10||areaM2>1e10){setError("محدوده نقشه معتبر نیست؛ نقاط رو بازبینی کن.");return;}
  setSaving(true);setError("");
  try{
   const{data:profile,error:profileError}=await supabase.from("users").select("id").eq("auth_user_id",session.user.id).single();if(profileError||!profile)throw new Error("پرونده کاربری پیدا نشد؛ لطفاً دوباره وارد شو.");
   const{data:farm,error:farmError}=await supabase.from("farms").insert({owner_user_id:profile.id,farm_name:draft.name,total_area:areaHa,area_unit:"hectare",water_structures:[],irrigation_systems:draft.irrigation||draft.waterSource?[{method:draft.irrigation||null,water_source:draft.waterSource||null,equipment:[]}]:[]}).select("id").single();if(farmError||!farm)throw farmError||new Error("ساخت پرونده مزرعه انجام نشد.");
   try{
    const ring=[...points.map(p=>[p.lng,p.lat]),[points[0].lng,points[0].lat]],boundary={type:"MultiPolygon",coordinates:[[ring]]} as unknown as Json;
    const{data:field,error:fieldError}=await supabase.from("farm_fields").insert({farm_id:farm.id,field_name:"قطعه اول",area:areaHa,area_unit:"hectare",boundary,boundary_capture_method:capture?"mixed":"map_pin",gps_accuracy_m:capture?.accuracy??null,boundary_confirmed_at:new Date().toISOString()}).select("id").single();if(fieldError||!field)throw fieldError||new Error("ذخیره محدوده انجام نشد.");
    const centroid=points.reduce((a,p)=>({lat:a.lat+p.lat/points.length,lng:a.lng+p.lng/points.length}),{lat:0,lng:0});
    const{error:locationError}=await supabase.from("farm_locations").insert({farm_id:farm.id,latitude:capture?.lat??centroid.lat,longitude:capture?.lng??centroid.lng,precision_m:capture?.accuracy??null,location_source:capture?"device_gps":"user_pin",is_primary:true,confirmed_by_user:true,captured_at:new Date().toISOString()});if(locationError)throw locationError;
    const{error:cropError}=await supabase.from("crop_cycles").insert({farm_id:farm.id,field_id:field.id,crop_id:draft.cropId,variety_id:null,crop_label:null,variety_label:draft.variety||null,tree_age_years:draft.age===""?null:Number(draft.age),yield_quantity:draft.yieldAmount===""?null:Number(draft.yieldAmount),yield_unit:draft.yieldAmount===""?null:"kg_per_tree",yield_period:draft.yieldAmount===""?null:"per_year",crop_role:draft.role,planted_area:null,area_unit:"hectare",status:"active",created_by:profile.id});if(cropError)throw cropError;
   }catch(inner){await supabase.from("farms").delete().eq("id",farm.id);throw inner;}
   ask("saved","پرونده مزرعه‌ات با موفقیت در سارینا ذخیره شد. هر وقت آماده بودی، می‌تونیم اطلاعات بیشتری مثل خاک، کیفیت آب و مشکلات مزرعه رو هم تکمیل کنیم.");appendLine({id:Date.now()+1,role:"sarina",text:"ثبت پرونده انجام شد."});
  }catch(e){setError(e instanceof Error?e.message:"ذخیره پرونده مزرعه ناموفق بود.");}finally{setSaving(false);}
 }
 function receiveVoice(payload:VoicePayload){void payload;}
 function receiveReplyAudio(payload:VoicePayload){const url=URL.createObjectURL(payload.audio);setLines(current=>{const next=[...current];for(let i=next.length-1;i>=0;i--){if(next[i].role==="sarina"){if(next[i].audioUrl)URL.revokeObjectURL(next[i].audioUrl);next[i]={...next[i],audioUrl:url};break;}}linesRef.current=next;return next;});}
 function receiveTranscription(text:string){submitAnswer(text);}
 const currentOptions=step==="role"?roles:step==="irrigation"?irrigation:step==="source"?sources:[];
 const showSkip=["variety","age","yield","irrigation","source"].includes(step);
 return <section className="farmer-voice-registration" dir="rtl" aria-label="ثبت مزرعه با گفت‌وگوی صوتی" style={{border:"1px solid #d8e8d8",borderRadius:18,padding:14,background:"#f8fcf7",margin:"12px 0"}}>
  <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}><div><strong>ثبت مزرعه با سارینا</strong><p style={{margin:"4px 0",fontSize:12,color:"#55715b"}}>گفت‌وگوی مرحله‌ای · صدای فارسی</p></div><button type="button" onClick={onClose} aria-label="بستن ثبت مزرعه">بستن</button></header>
  <div style={{display:"flex",gap:6,alignItems:"center",margin:"10px 0"}}><span style={{fontSize:12}}>مرحله {(["name","map","crop","role","variety","age","yield","irrigation","source","review","saved"] as Step[]).indexOf(step)+1} از ۱۱</span><div style={{height:6,flex:1,borderRadius:9,background:"#e5eee4",overflow:"hidden"}}><div style={{height:"100%",width:((["name","map","crop","role","variety","age","yield","irrigation","source","review","saved"] as Step[]).indexOf(step)+1)/11*100+"%",background:"#39834e"}}/></div></div>
  <div style={{maxHeight:260,overflowY:"auto",display:"grid",gap:8,padding:"8px 0"}}>{lines.map(line=><div key={line.id} style={{justifySelf:line.role==="sarina"?"start":"end",maxWidth:"92%",padding:"10px 12px",borderRadius:14,background:line.role==="sarina"?"#eaf4e8":"#fff",border:"1px solid #dfe9dd",fontSize:14,lineHeight:1.8}}>{line.text}{line.audioUrl&&<audio controls preload="none" src={line.audioUrl} style={{display:"block",maxWidth:"100%",marginTop:8}}/>}</div>)}</div>
  {step==="map"&&<><FarmMap onBoundaryChange={(next,nextCapture)=>{setPoints(next);setCapture(nextCapture);setBoundaryConfirmed(false);}}/><p style={{fontSize:13}}>مساحت محاسبه‌شده: {points.length>=3?areaHa.toLocaleString("fa-IR",{maximumFractionDigits:4})+" هکتار":"پس از ثبت سه نقطه نمایش داده می‌شود"}</p><button type="button" disabled={points.length<3||selfIntersects(points)} onClick={()=>{setBoundaryConfirmed(true);ask("crop","محدوده ثبت شد. حالا چه درخت یا محصولی در مزرعه داری؟")}}><Check size={15}/> تأیید محدوده و ادامه</button></>}
  {step==="crop"&&<label style={{display:"block",margin:"8px 0"}}>نوع درخت یا محصول<select value={draft.cropId} disabled={loading} onChange={e=>{const c=cropOptions.find(x=>x.id===e.target.value);setDraft(d=>({...d,cropId:e.target.value,cropName:c?((c.local_names as any)?.fa||c.common_name):""}));}} style={{width:"100%",padding:10,borderRadius:10,marginTop:6}}><option value="">انتخاب محصول</option>{cropOptions.map(c=><option key={c.id} value={c.id}>{(c.local_names as any)?.fa||c.common_name}</option>)}</select>{loading&&<small>در حال دریافت فهرست محصولات…</small>}</label>}
  {step==="crop"&&<button type="button" disabled={!draft.cropId||loading} onClick={()=>ask("role")}>ادامه با این محصول ←</button>}
  {currentOptions.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:7,margin:"8px 0"}}>{currentOptions.map(o=><button type="button" key={o.value} onClick={()=>submitAnswer(o.label)}>{o.label}</button>)}</div>}
  {["name","variety","age","yield"].includes(step)&&<form onSubmit={(e:FormEvent)=>{e.preventDefault();submitAnswer(answer);}} style={{display:"flex",gap:8,margin:"8px 0"}}><input value={answer} onChange={e=>setAnswer(e.target.value)} placeholder={step==="name"?"نام مزرعه":step==="age"?"سن تقریبی به سال":step==="yield"?"کیلوگرم برای هر درخت در سال":"رقم یا گونه"} style={{flex:1,minWidth:0,padding:10,borderRadius:10}}/><button type="submit" disabled={!answer.trim()}>ارسال</button></form>}
  {step==="review"&&<div style={{background:"#fff",borderRadius:12,padding:12,lineHeight:1.9,fontSize:13}}><strong>خلاصه پرونده</strong><div>نام مزرعه: {draft.name}</div><div>مساحت: {areaHa.toLocaleString("fa-IR",{maximumFractionDigits:4})} هکتار</div><div>محصول: {draft.cropName}</div><div>نقش کشت: {roles.find(x=>x.value===draft.role)?.label}</div><div>رقم: {draft.variety||"بعداً تکمیل می‌شود"}</div><div>سن: {draft.age?draft.age+" سال":"نامشخص"}</div><div>باردهی: {draft.yieldAmount?draft.yieldAmount+" کیلوگرم برای هر درخت در سال":"نامشخص"}</div><div>آبیاری: {irrigation.find(x=>x.value===draft.irrigation)?.label||"ثبت نشده"}</div><div>منبع آب: {sources.find(x=>x.value===draft.waterSource)?.label||"ثبت نشده"}</div><button type="button" disabled={saving} onClick={()=>void saveFarm()} style={{marginTop:10}}><Save size={15}/>{saving?"در حال ذخیره…":"تأیید و ذخیره پرونده"}</button></div>}
  {step==="saved"&&<div style={{padding:12,background:"#eaf4e8",borderRadius:12}}>پرونده ذخیره شد. می‌تونی این پنجره رو ببندی.</div>}
  {showSkip&&<button type="button" onClick={skip} style={{margin:"6px 0"}}><SkipForward size={14}/> فعلاً نمی‌دانم / رد کردن</button>}
  {error&&<p role="alert" style={{color:"#a12e2e",fontSize:13}}>{error}</p>}
  {step!=="map"&&step!=="review"&&step!=="saved"&&<div style={{borderTop:"1px solid #e1eadf",paddingTop:10,marginTop:10}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:8}}><span style={{fontSize:12,color:"#55715b"}}>پاسخ صوتی یا نوشتاری</span><button type="button" onClick={()=>setVoiceMode(v=>!v)}><Mic size={14}/>{voiceMode?"خاموش‌کردن پخش خودکار صدا":"فعال‌کردن پخش خودکار صدا"}</button></div><VoiceMessageControls onVoiceMessage={receiveVoice} onTranscription={receiveTranscription} textToSpeak={latestPrompt} speechLanguage="fa" autoGenerateAudio={voiceMode&&step!=="saved"} onVoiceReplyAudio={receiveReplyAudio} onAudioGenerationComplete={()=>{}} disabled={saving}/></div>}
 </section>;
}
