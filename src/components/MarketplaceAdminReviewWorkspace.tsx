import {useCallback,useEffect,useState} from "react";
import {BadgeCheck,ClipboardCheck,RefreshCw,ShieldCheck,Store} from "lucide-react";
import {supabase} from "../lib/supabase";

type PendingSeller={
 id:string;seller_type:string;display_name:string;legal_name:string|null;description:string|null;
 country_code:string|null;region:string|null;city:string|null;contact_email:string|null;
 contact_phone:string|null;website_url:string|null;verification_notes:string|null;created_at:string;
};
type PendingProduct={
 id:string;seller_id:string;seller_name:string;seller_type:string;category_name:string;category_code:string;
 name:string;description:string|null;license_reference:string|null;regulatory_status:string;
 status:string;created_at:string;
};

export default function MarketplaceAdminReviewWorkspace(){
 const[sellers,setSellers]=useState<PendingSeller[]>([]);
 const[products,setProducts]=useState<PendingProduct[]>([]);
 const[loading,setLoading]=useState(true);
 const[busy,setBusy]=useState<string|null>(null);
 const[error,setError]=useState("");
 const[notice,setNotice]=useState("");

 const load=useCallback(async()=>{
  if(!supabase){setError("اتصال پایگاه داده در دسترس نیست.");setLoading(false);return;}
  setLoading(true);setError("");
  const{data,error:rpcError}=await (supabase as any).rpc("admin_list_marketplace_review_queue");
  if(rpcError){
   setError("صف بررسی بازارگاه هنوز از سمت پایگاه داده فعال نشده است. ابتدا مهاجرت مدیریتی باید در محیط آزمایشی اعمال و آزمون شود.");
   setLoading(false);return;
  }
  setSellers(Array.isArray(data?.pending_sellers)?data.pending_sellers:[]);
  setProducts(Array.isArray(data?.pending_products)?data.pending_products:[]);
  setLoading(false);
 },[]);

 useEffect(()=>{void load();},[load]);

 async function reviewSeller(item:PendingSeller,status:"verified"|"rejected"){
  if(!supabase)return;
  setBusy("seller:"+item.id);setError("");setNotice("");
  const{error:rpcError}=await (supabase as any).rpc("admin_review_marketplace_seller",{
   p_seller_id:item.id,p_status:status,p_notes:null
  });
  setBusy(null);
  if(rpcError){setError("ثبت نتیجه بررسی فروشنده انجام نشد: "+rpcError.message);return;}
  setNotice(status==="verified"?"فروشنده تأیید شد؛ محصولات او همچنان جداگانه باید شرایط انتشار را داشته باشند.":"درخواست فروشندگی رد شد.");
  await load();
 }

 async function reviewProduct(item:PendingProduct,status:"verified"|"rejected"){
  if(!supabase)return;
  setBusy("product:"+item.id);setError("");setNotice("");
  const{error:rpcError}=await (supabase as any).rpc("admin_review_marketplace_product",{
   p_product_id:item.id,p_status:status,p_notes:null
  });
  setBusy(null);
  if(rpcError){setError("ثبت نتیجه بررسی محصول انجام نشد: "+rpcError.message);return;}
  setNotice(status==="verified"?"بررسی مجوز محصول تأیید شد؛ انتشار محصول همچنان در اختیار فروشنده و سیاست‌های انتشار است.":"مجوز محصول رد شد و محصول به پیش‌نویس برگشت.");
  await load();
 }

 return <section className="admin-panel marketplace-admin-review" dir="rtl">
  <div className="admin-list-head">
   <div><h2><ShieldCheck size={19}/> بررسی فروشندگان و محصولات بازارگاه</h2><small>تأییدها در پایگاه داده به‌صورت اتمیک و همراه با ثبت سابقه مدیریتی انجام می‌شوند.</small></div>
   <button className="admin-refresh" type="button" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/> به‌روزرسانی</button>
  </div>
  {error&&<div className="admin-alert error" role="alert">{error}</div>}
  {notice&&<div className="admin-alert success" role="status">{notice}</div>}
  {loading?<div className="admin-empty">در حال دریافت درخواست‌های بررسی...</div>:<>
   <div className="admin-list-head"><div><h3><Store size={17}/> درخواست‌های فروشندگی</h3><small>{sellers.length.toLocaleString("fa-IR")} درخواست در انتظار</small></div></div>
   {sellers.length===0?<div className="admin-empty">درخواست فروشندگی در انتظار بررسی وجود ندارد.</div>:<div className="admin-user-list">{sellers.map(item=><article className="admin-user-card" key={item.id}>
    <div className="admin-user-head"><div className="admin-user-avatar"><Store size={18}/></div><div className="admin-user-info"><strong>{item.display_name}</strong><span>{item.seller_type==="farmer"?"فروشگاه کشاورز":item.seller_type==="company"?"فروشگاه شرکت":item.seller_type==="specialist"?"فروشگاه متخصص":"فروشنده"}</span><small>{[item.city,item.region,item.country_code].filter(Boolean).join(" · ")||"مکان ثبت نشده"}</small></div><span className="admin-protected">در انتظار</span></div>
    {item.legal_name&&<p>نام حقوقی: {item.legal_name}</p>}{item.description&&<p>{item.description}</p>}
    <div className="admin-user-footer"><small>{[item.contact_phone,item.contact_email].filter(Boolean).join(" · ")||"اطلاعات تماس ثبت نشده"}</small><div className="admin-user-actions">
     <button className="primary-button" type="button" disabled={busy!==null} onClick={()=>void reviewSeller(item,"verified")}>{busy==="seller:"+item.id?"در حال ثبت...":"تأیید فروشنده"}</button>
     <button className="danger-action" type="button" disabled={busy!==null} onClick={()=>void reviewSeller(item,"rejected")}>رد درخواست</button>
    </div></div>
   </article>)}</div>}
   <div className="admin-list-head"><div><h3><ClipboardCheck size={17}/> بررسی محصولات نیازمند مجوز</h3><small>{products.length.toLocaleString("fa-IR")} محصول در انتظار بررسی</small></div></div>
   {products.length===0?<div className="admin-empty">محصول نیازمند بررسی مجوز وجود ندارد.</div>:<div className="admin-user-list">{products.map(item=><article className="admin-user-card" key={item.id}>
    <div className="admin-user-head"><div className="admin-user-avatar"><BadgeCheck size={18}/></div><div className="admin-user-info"><strong>{item.name}</strong><span>{item.seller_name} · {item.category_name}</span><small>وضعیت فعلی: {item.regulatory_status==="pending_review"?"در انتظار بررسی":"بررسی‌نشده"}</small></div><span className="admin-protected">نیازمند مجوز</span></div>
    {item.description&&<p>{item.description}</p>}
    <div className="admin-user-footer"><small>شناسه مجوز: {item.license_reference||"ثبت نشده"}</small><div className="admin-user-actions">
     <button className="primary-button" type="button" disabled={busy!==null} onClick={()=>void reviewProduct(item,"verified")}>{busy==="product:"+item.id?"در حال ثبت...":"تأیید مجوز"}</button>
     <button className="danger-action" type="button" disabled={busy!==null} onClick={()=>void reviewProduct(item,"rejected")}>رد مجوز</button>
    </div></div>
   </article>)}</div>}
  </>}
  <p className="admin-footnote">تأیید فروشنده به‌معنای تأیید همه محصولات او نیست. محصولات مشمول مقررات، تا تأیید مجوز قابل انتشار یا سفارش نیستند. این پنل پرداخت آنلاین را فعال نمی‌کند.</p>
 </section>;
}
