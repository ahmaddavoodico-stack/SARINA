import {useEffect,useState} from "react";
import type {FormEvent} from "react";
import type {Session} from "@supabase/supabase-js";
import {ArrowLeft,MapPin,Plus,RefreshCw,Sprout} from "lucide-react";
import {supabase} from "./lib/supabase";

type Farm={id:string;farm_name:string;total_area:number|null;area_unit:string;status:string;created_at:string};
type FarmDocument={id:string;farm_id:string;file_name:string;storage_path:string;mime_type:string;file_size_bytes:number;created_at:string};
const units=[{value:"hectare",label:"هکتار"},{value:"acre",label:"آکر"},{value:"square_meter",label:"متر مربع"}];
export default function FarmWorkspace({session}:{session:Session}){
 const[farms,setFarms]=useState<Farm[]>([]),[documents,setDocuments]=useState<FarmDocument[]>([]),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[showForm,setShowForm]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const[name,setName]=useState(""),[area,setArea]=useState(""),[unit,setUnit]=useState("hectare"),[latitude,setLatitude]=useState(""),[longitude,setLongitude]=useState("");
 async function load(){
  if(!supabase)return;
  setLoading(true);setError("");
  try{
   const{data,error}=await supabase.from("farms").select("id,farm_name,total_area,area_unit,status,created_at").order("created_at",{ascending:false});
   if(error)throw error;
   setFarms((data??[]) as Farm[]);
   const{data:docRows,error:docError}=await supabase.from("farm_documents").select("id,farm_id,file_name,storage_path,mime_type,file_size_bytes,created_at").order("created_at",{ascending:false});
   if(docError)throw docError;
   setDocuments((docRows??[]) as FarmDocument[]);
  }catch(e){setError(e instanceof Error?e.message:"دریافت پرونده‌های مزرعه انجام نشد.");}
  finally{setLoading(false);}
 }
 useEffect(()=>{void load();},[session.user.id]);
 async function createFarm(e:FormEvent){
  e.preventDefault();if(!supabase)return;
  const parsedArea=area.trim()===""?null:Number(area);
  const lat=latitude.trim()===""?null:Number(latitude),lon=longitude.trim()===""?null:Number(longitude);
  if(!name.trim()){setError("نام مزرعه را وارد کنید.");return;}
  if(parsedArea!==null&&(!Number.isFinite(parsedArea)||parsedArea<=0)){setError("مساحت باید عددی بزرگ‌تر از صفر باشد.");return;}
  if((lat===null)!==(lon===null)){setError("برای ثبت موقعیت، هر دو مختصات عرض و طول جغرافیایی را وارد کنید.");return;}
  if(lat!==null&&(!Number.isFinite(lat)||lat < -90||lat > 90)){setError("عرض جغرافیایی باید بین ۹۰- تا ۹۰ باشد.");return;}
  if(lon!==null&&(!Number.isFinite(lon)||lon < -180||lon > 180)){setError("طول جغرافیایی باید بین ۱۸۰- تا ۱۸۰ باشد.");return;}
  setSaving(true);setError("");setNotice("");
  try{
   const{data:profile,error:profileError}=await supabase.from("users").select("id").eq("auth_user_id",session.user.id).single();
   if(profileError)throw new Error("پرونده کاربری شما پیدا نشد. یک‌بار خارج شوید و دوباره وارد شوید. جزئیات: "+profileError.message);
   const{data:farm,error:farmError}=await supabase.from("farms").insert({owner_user_id:profile.id,farm_name:name.trim(),total_area:parsedArea,area_unit:unit}).select("id,farm_name,total_area,area_unit,status,created_at").single();
   if(farmError)throw farmError;
   if(lat!==null&&lon!==null){
    const{error:locationError}=await supabase.from("farm_locations").insert({farm_id:farm.id,latitude:lat,longitude:lon,location_source:"user_pin",is_primary:true,confirmed_by_user:true,captured_at:new Date().toISOString()});
    if(locationError){
     await supabase.from("farms").delete().eq("id",farm.id);
     throw new Error("مزرعه ساخته شد اما ذخیره موقعیت موفق نبود؛ عملیات مزرعه بازگردانده شد. "+locationError.message);
    }
   }
   setFarms(current=>[farm as Farm,...current]);setName("");setArea("");setUnit("hectare");setLatitude("");setLongitude("");setShowForm(false);
   setNotice("پرونده مزرعه با موفقیت ذخیره شد."+(lat!==null?" موقعیت جغرافیایی نیز ثبت شد.":" برای تکمیل اطلاعات، می‌توانید موقعیت را بعداً اضافه کنید."));
  }catch(e){setError(e instanceof Error?e.message:"ذخیره پرونده مزرعه انجام نشد.");}
  finally{setSaving(false);}
 }
 async function uploadDocument(farmId:string,file:File|null,input:HTMLInputElement){
  if(!file)return;
  setError("");setNotice("");
  const allowed=["application/pdf","image/jpeg","image/png"];
  if(!allowed.includes(file.type)){setError("فقط فایل PDF یا تصویر JPG و PNG پذیرفته می‌شود.");input.value="";return;}
  if(file.size>10*1024*1024){setError("حجم هر مدرک حداکثر ۱۰ مگابایت است.");input.value="";return;}
  try{
   const{data:profile,error:profileError}=await supabase!.from("users").select("id").eq("auth_user_id",session.user.id).single();
   if(profileError)throw profileError;
   const safeName=file.name.replace(/[^\\p{L}\\p{N}._-]/gu,"_").slice(-120)||"document";
   const path=session.user.id+"/"+farmId+"/"+crypto.randomUUID()+"-"+safeName;
   const{error:uploadError}=await supabase!.storage.from("farmer-documents").upload(path,file,{contentType:file.type,upsert:false});
   if(uploadError)throw uploadError;
   const{data:doc,error:insertError}=await supabase!.from("farm_documents").insert({farm_id:farmId,uploaded_by_user_id:profile.id,file_name:file.name,mime_type:file.type,file_size_bytes:file.size,storage_path:path}).select("id,farm_id,file_name,storage_path,mime_type,file_size_bytes,created_at").single();
   if(insertError){await supabase!.storage.from("farmer-documents").remove([path]);throw insertError;}
   setDocuments(current=>[doc as FarmDocument,...current]);
   setNotice("مدرک با موفقیت بارگذاری و ذخیره شد.");
  }catch(e){setError(e instanceof Error?e.message:"بارگذاری مدرک انجام نشد.");}
  finally{input.value="";}
 }
 async function openDocument(path:string){
  const{data,error}=await supabase!.storage.from("farmer-documents").createSignedUrl(path,60);
  if(error){setError(error.message);return;}
  window.open(data.signedUrl,"_blank","noopener,noreferrer");
 }
 const statusText=(s:string)=>s==="active"?"فعال":s==="inactive"?"غیرفعال":"بایگانی‌شده";
 const unitText=(u:string)=>units.find(x=>x.value===u)?.label||u;
 return <section>
  <div className="page-heading"><span className="eyebrow">مدیریت اطلاعات کشاورزی</span><h1>مزارع من</h1><p>پرونده مزرعه‌تان را ایجاد کنید تا اطلاعات زمین، موقعیت و فعالیت‌های کشاورزی در یکجا نگهداری شود.</p></div>
  {error&&<div className="notice warning" role="alert">{error}</div>}{notice&&<div className="notice" role="status">{notice}</div>}
  <div className="lower-grid" style={{marginBottom:24}}>
   <article className="panel"><span className="round-icon"><Sprout/></span><h3>{farms.length.toLocaleString("fa-IR")} پرونده مزرعه</h3><p>پرونده‌های ثبت‌شده به حساب شما متصل‌اند و فقط با دسترسی مجاز قابل مشاهده هستند.</p><button className="text-button" onClick={()=>{setShowForm(v=>!v);setError("");}}><Plus size={16}/>{showForm?"بستن فرم":"ایجاد پرونده جدید"}</button></article>
   <article className="panel"><span className="round-icon"><MapPin/></span><h3>موقعیت مزرعه</h3><p>مختصات را می‌توانید هنگام ایجاد پرونده وارد کنید یا بعداً در تکمیل پرونده ثبت کنید.</p><span className="secure-note">موقعیت فقط پس از تأیید شما ذخیره می‌شود.</span></article>
  </div>
  {showForm&&<article className="panel" style={{marginBottom:24}}>
   <div className="section-title"><div><span className="eyebrow">گام اول</span><h2>اطلاعات پایه مزرعه</h2></div></div>
   <form onSubmit={createFarm}>
    <label>نام مزرعه<input value={name} onChange={e=>setName(e.target.value)} required maxLength={120} placeholder="مثلاً مزرعه امید"/></label>
    <div style={{display:"grid",gridTemplateColumns:"minmax(0,2fr) minmax(130px,1fr)",gap:12}}>
     <label>مساحت کل<input type="number" min="0.0001" step="any" value={area} onChange={e=>setArea(e.target.value)} placeholder="اختیاری"/></label>
     <label>واحد مساحت<select value={unit} onChange={e=>setUnit(e.target.value)}>{units.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
    </div>
    <div className="section-title" style={{marginTop:20}}><div><span className="eyebrow">اختیاری</span><h2>موقعیت جغرافیایی</h2></div></div>
    <p className="muted">اگر مختصات را در اختیار دارید وارد کنید. هر دو مقدار باید با هم ثبت شوند.</p>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
     <label>عرض جغرافیایی<input type="number" step="any" value={latitude} onChange={e=>setLatitude(e.target.value)} placeholder="مثلاً ۳۱٫۳۲"/></label>
     <label>طول جغرافیایی<input type="number" step="any" value={longitude} onChange={e=>setLongitude(e.target.value)} placeholder="مثلاً ۴۸٫۶۷"/></label>
    </div>
    <button className="primary-button" disabled={saving}>{saving?"در حال ذخیره...":"ذخیره پرونده مزرعه"} <ArrowLeft size={17}/></button>
   </form>
  </article>}
  <div className="section-title"><div><span className="eyebrow">پرونده‌های شما</span><h2>فهرست مزارع</h2></div><button className="text-button" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> به‌روزرسانی</button></div>
  {loading?<div className="empty-state">در حال دریافت مزارع...</div>:farms.length===0?<div className="empty-state"><Sprout size={36}/><strong>هنوز مزرعه‌ای ثبت نکرده‌اید</strong><p>با ایجاد اولین پرونده، اطلاعات مزرعه شما در سارینا ذخیره می‌شود.</p><button className="primary-button" onClick={()=>setShowForm(true)}>شروع پرونده مزرعه <ArrowLeft size={16}/></button></div>:<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>نام مزرعه</th><th>مساحت</th><th>وضعیت</th><th>تاریخ ایجاد</th></tr></thead><tbody>{farms.map(f=><tr key={f.id}><td>{f.farm_name}</td><td>{f.total_area===null?"ثبت نشده":Number(f.total_area).toLocaleString("fa-IR")+" "+unitText(f.area_unit)}</td><td>{statusText(f.status)}</td><td>{new Date(f.created_at).toLocaleDateString("fa-IR")}</td></tr>)}</tbody></table></div>}
 </section>;
}
