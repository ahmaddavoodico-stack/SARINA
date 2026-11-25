import {useCallback,useEffect,useMemo,useState} from "react";
import type {FormEvent} from "react";
import {BadgeCheck,PackagePlus,RefreshCw,Store,Truck} from "lucide-react";
import {supabase} from "../lib/supabase";

type Seller={id:string;display_name:string;description:string|null;country_code:string|null;region:string|null;city:string|null;contact_email:string|null;contact_phone:string|null;verification_status:string;verification_notes:string|null};
type Category={id:string;code:string;name_fa:string;market_section:string};
type Product={id:string;name:string;description:string|null;category_id:string;status:string;pricing_model:string;price:number|string|null;currency:string;unit_label:string;minimum_order_qty:number|string;stock_qty:number|string|null;image_urls:unknown;created_at:string};
type Order={id:string;order_number:string;status:string;payment_status:string;fulfillment_status:string;total_amount:number|string;currency:string;placed_at:string};

const db=supabase as any;
const currencyLabels:Record<string,string>={IRR:"ریال",USD:"دلار",EUR:"یورو",AED:"درهم",TRY:"لیر",AZN:"منات"};
const statusLabels:Record<string,string>={pending:"در انتظار بررسی",verified:"تأییدشده",rejected:"نیازمند اصلاح",suspended:"تعلیق‌شده",draft:"پیش‌نویس",published:"منتشرشده",archived:"بایگانی‌شده",awaiting_payment:"در انتظار پرداخت",paid:"پرداخت‌شده",cancelled:"لغوشده",processing:"در حال آماده‌سازی",shipped:"ارسال‌شده",delivered:"تحویل‌شده"};

export default function SpecialistStoreWorkspace({userId,enabled}:{userId:string;enabled:boolean}){
 const [seller,setSeller]=useState<Seller|null>(null);
 const [categories,setCategories]=useState<Category[]>([]);
 const [products,setProducts]=useState<Product[]>([]);
 const [orders,setOrders]=useState<Order[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [sellerForm,setSellerForm]=useState({display_name:"",description:"",country_code:"",region:"",city:"",contact_email:"",contact_phone:""});
 const [productForm,setProductForm]=useState({name:"",description:"",category_id:"",pricing_model:"fixed",price:"",currency:"USD",unit_label:"unit",minimum_order_qty:"1",stock_qty:"",image_url:""});
 const [showProductForm,setShowProductForm]=useState(false);
 const [editingProductId,setEditingProductId]=useState<string|null>(null);

 const load=useCallback(async()=>{
  if(!supabase){setError("اتصال پایگاه داده در این محیط پیکربندی نشده است.");setLoading(false);return;}
  setLoading(true);setError("");
  try{
   const own=await db.from("marketplace_sellers").select("id,display_name,description,country_code,region,city,contact_email,contact_phone,verification_status,verification_notes").eq("owner_user_id",userId).eq("seller_type","specialist").maybeSingle();
   if(own.error)throw own.error;
   setSeller(own.data as Seller|null);
   const cats=await db.from("marketplace_categories").select("id,code,name_fa,market_section").eq("market_section","company_supplies").eq("is_active",true).neq("code","crop_protection").order("sort_order",{ascending:true});
   if(cats.error)throw cats.error;
   setCategories((cats.data||[]) as Category[]);
   if(own.data){
    setSellerForm({display_name:own.data.display_name||"",description:own.data.description||"",country_code:own.data.country_code||"",region:own.data.region||"",city:own.data.city||"",contact_email:own.data.contact_email||"",contact_phone:own.data.contact_phone||""});
    const [p,o]=await Promise.all([
     db.from("marketplace_products").select("id,name,description,category_id,status,pricing_model,price,currency,unit_label,minimum_order_qty,stock_qty,image_urls,created_at").eq("seller_id",own.data.id).order("created_at",{ascending:false}).limit(100),
     db.from("marketplace_orders").select("id,order_number,status,payment_status,fulfillment_status,total_amount,currency,placed_at").eq("seller_id",own.data.id).order("placed_at",{ascending:false}).limit(50)
    ]);
    if(p.error)throw p.error;if(o.error)throw o.error;
    setProducts((p.data||[]) as Product[]);setOrders((o.data||[]) as Order[]);
   }else{setProducts([]);setOrders([]);}
  }catch(e){setError(e instanceof Error?e.message:"دریافت اطلاعات فروشگاه انجام نشد.");}
  finally{setLoading(false);}
 },[userId]);

 useEffect(()=>{if(enabled)void load();else setLoading(false);},[enabled,load]);
 const verified=seller?.verification_status==="verified";
 const publishedCount=useMemo(()=>products.filter(p=>p.status==="published").length,[products]);

 async function createSeller(e:FormEvent){
  e.preventDefault();if(!supabase||!enabled)return;
  setBusy(true);setError("");setNotice("");
  try{
   const {error}=await db.from("marketplace_sellers").insert({seller_type:"specialist",owner_user_id:userId,display_name:sellerForm.display_name.trim(),description:sellerForm.description.trim()||null,country_code:sellerForm.country_code.trim().toUpperCase()||null,region:sellerForm.region.trim()||null,city:sellerForm.city.trim()||null,contact_email:sellerForm.contact_email.trim()||null,contact_phone:sellerForm.contact_phone.trim()||null}).select("id").single();
   if(error)throw error;
   setNotice("درخواست ایجاد فروشگاه ثبت شد. پس از بررسی و تأیید فروشنده، امکان انتشار محصولات فعال می‌شود.");
   await load();
  }catch(e){setError(e instanceof Error?e.message:"ثبت درخواست فروشگاه انجام نشد.");}
  finally{setBusy(false);}
 }

 async function saveProduct(e:FormEvent){
  e.preventDefault();if(!supabase||!seller)return;
  const price=productForm.pricing_model==="fixed"?Number(productForm.price):null;
  if(productForm.pricing_model==="fixed"&&(!Number.isFinite(price)||price!<=0)){setError("برای فروش با قیمت ثابت، مبلغ معتبر وارد کنید.");return;}
  if(productForm.pricing_model==="fixed"&&productForm.stock_qty.trim()===""){setError("برای قیمت ثابت، مقدار موجودی را نیز وارد کنید.");return;}
  setBusy(true);setError("");setNotice("");
  try{
   let imageUrls: string[]=[];
   if(productForm.image_url.trim()){const url=new URL(productForm.image_url.trim());if(url.protocol!=="https:")throw new Error("نشانی تصویر باید با HTTPS آغاز شود.");imageUrls=[url.toString()];}
   const payload={seller_id:seller.id,category_id:productForm.category_id,market_section:"company_supplies",name:productForm.name.trim(),description:productForm.description.trim()||null,specifications:{},pricing_model:productForm.pricing_model,price,currency:productForm.currency,unit_label:productForm.unit_label.trim()||"unit",minimum_order_qty:Number(productForm.minimum_order_qty)||1,stock_qty:productForm.stock_qty.trim()===""?null:Number(productForm.stock_qty),image_urls:imageUrls};
   const result=editingProductId
    ?await db.from("marketplace_products").update(payload).eq("id",editingProductId).eq("seller_id",seller.id)
    :await db.from("marketplace_products").insert({...payload,status:"draft",regulated:false,regulatory_metadata:{}});
   if(result.error)throw result.error;
   setProductForm({name:"",description:"",category_id:"",pricing_model:"fixed",price:"",currency:"USD",unit_label:"unit",minimum_order_qty:"1",stock_qty:"",image_url:""});
   setEditingProductId(null);setShowProductForm(false);setNotice(editingProductId?"تغییرات محصول ذخیره شد.":"محصول به‌صورت پیش‌نویس ذخیره شد.");await load();
  }catch(e){setError(e instanceof Error?e.message:"ثبت محصول انجام نشد.");}
  finally{setBusy(false);}
 }

 function editProduct(product:Product){
  const image=Array.isArray(product.image_urls)?product.image_urls.find(x=>typeof x==="string") as string|undefined:"";
  setEditingProductId(product.id);setProductForm({name:product.name,description:product.description||"",category_id:product.category_id,pricing_model:product.pricing_model,price:product.price===null?"":String(product.price),currency:product.currency,unit_label:product.unit_label,minimum_order_qty:String(product.minimum_order_qty),stock_qty:product.stock_qty===null?"":String(product.stock_qty),image_url:image||""});setShowProductForm(true);
 }
 async function updateProductStatus(product:Product,status:"published"|"draft"){
  if(!supabase||!seller)return;
  setBusy(true);setError("");setNotice("");
  try{const {error}=await db.from("marketplace_products").update({status,published_at:status==="published"?new Date().toISOString():null}).eq("id",product.id).eq("seller_id",seller.id);if(error)throw error;setNotice(status==="published"?"درخواست انتشار محصول ثبت شد.":"محصول به پیش‌نویس بازگردانده شد.");await load();}
  catch(e){setError(e instanceof Error?e.message:"تغییر وضعیت محصول انجام نشد.");}
  finally{setBusy(false);}
 }

 if(!enabled)return <section className="specialist-store"><div className="specialist-store-empty"><Store size={34}/><h2>فروشگاه متخصص</h2><p>این بخش برای حساب‌هایی فعال است که هنگام ثبت‌نام داشتن فروشگاه را تأیید کرده‌اند.</p></div></section>;
 return <section className="specialist-store" dir="rtl">
  <div className="specialist-store-heading"><div><span>کسب‌وکار تخصصی شما</span><h2><Store size={24}/> فروشگاه من</h2><p>محصولات تخصصی خود را مدیریت کنید و پس از تأیید فروشندگی، آن‌ها را در بازارگاه SARINA عرضه کنید.</p></div><button type="button" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> به‌روزرسانی</button></div>
  <div className="specialist-store-trust"><BadgeCheck size={18}/><span>ایجاد فروشگاه به‌معنای تأیید فروشندگی نیست. انتشار کالا پس از تأیید فروشنده و بررسی الزامات محصول انجام می‌شود؛ پرداخت آنلاین هنوز فعال نیست.</span></div>
  {error&&<div className="specialist-store-alert" role="alert">{error}</div>}{notice&&<div className="specialist-store-notice">{notice}</div>}
  {loading?<div className="specialist-store-empty">در حال دریافت اطلاعات فروشگاه...</div>:!seller?<div className="specialist-store-panel"><h3>راه‌اندازی فروشگاه تخصصی</h3><p>اطلاعات اولیه فروشگاه را ثبت کنید. درخواست شما در وضعیت «در انتظار بررسی» قرار می‌گیرد.</p><form className="specialist-store-form" onSubmit={createSeller}>
   <label>نام فروشگاه<input required minLength={2} maxLength={120} value={sellerForm.display_name} onChange={e=>setSellerForm({...sellerForm,display_name:e.target.value})} placeholder="نامی که خریداران می‌بینند"/></label>
   <label>معرفی فروشگاه<textarea rows={3} value={sellerForm.description} onChange={e=>setSellerForm({...sellerForm,description:e.target.value})} placeholder="حوزه محصولات و خدمات فروشگاه"/></label>
   <label>کشور (کد دوحرفی)<input maxLength={2} value={sellerForm.country_code} onChange={e=>setSellerForm({...sellerForm,country_code:e.target.value})} placeholder="مثلاً IR یا AZ"/></label>
   <label>استان / منطقه<input value={sellerForm.region} onChange={e=>setSellerForm({...sellerForm,region:e.target.value})}/></label>
   <label>شهر<input value={sellerForm.city} onChange={e=>setSellerForm({...sellerForm,city:e.target.value})}/></label>
   <label>ایمیل تماس<input type="email" value={sellerForm.contact_email} onChange={e=>setSellerForm({...sellerForm,contact_email:e.target.value})}/></label>
   <label>تلفن تماس<input value={sellerForm.contact_phone} onChange={e=>setSellerForm({...sellerForm,contact_phone:e.target.value})}/></label>
   <button type="submit" disabled={busy}>{busy?"در حال ثبت...":"ثبت درخواست ایجاد فروشگاه"}</button>
  </form></div>:<>
   <div className="specialist-store-stats"><article><small>وضعیت فروشندگی</small><strong>{statusLabels[seller.verification_status]||seller.verification_status}</strong></article><article><small>محصولات منتشرشده</small><strong>{publishedCount.toLocaleString("fa-IR")}</strong></article><article><small>کل محصولات</small><strong>{products.length.toLocaleString("fa-IR")}</strong></article><article><small>سفارش‌های دریافتی</small><strong>{orders.length.toLocaleString("fa-IR")}</strong></article></div>
   {seller.verification_status!=="verified"&&<div className="specialist-store-pending"><strong>فروشگاه شما هنوز تأیید نشده است</strong><p>{seller.verification_notes||"پس از بررسی اطلاعات فروشگاه، نتیجه در همین بخش نمایش داده می‌شود. تا آن زمان می‌توانید محصولات را به‌صورت پیش‌نویس ثبت کنید."}</p></div>}
   <div className="specialist-store-actions"><div><h3>محصولات فروشگاه</h3><p>محصولات اینجا پس از انتشار مجاز در بازارگاه عمومی نمایش داده می‌شوند.</p></div><button type="button" onClick={()=>{setShowProductForm(v=>!v);if(showProductForm){setEditingProductId(null);setProductForm({name:"",description:"",category_id:"",pricing_model:"fixed",price:"",currency:"USD",unit_label:"unit",minimum_order_qty:"1",stock_qty:"",image_url:""});}}}><PackagePlus size={16}/>{showProductForm?"بستن فرم":"افزودن محصول"}</button></div>
   {showProductForm&&<form className="specialist-store-form specialist-store-panel" onSubmit={saveProduct}><h3>{editingProductId?"ویرایش محصول":"ثبت محصول جدید"}</h3>
    <label>نام محصول<input required minLength={2} maxLength={160} value={productForm.name} onChange={e=>setProductForm({...productForm,name:e.target.value})}/></label>
    <label>دسته‌بندی<select required value={productForm.category_id} onChange={e=>setProductForm({...productForm,category_id:e.target.value})}><option value="">انتخاب دسته‌بندی</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name_fa}</option>)}</select></label>
    <label>شرح محصول<textarea rows={3} value={productForm.description} onChange={e=>setProductForm({...productForm,description:e.target.value})}/></label>
    <label>نشانی تصویر محصول (اختیاری)<input type="url" value={productForm.image_url} onChange={e=>setProductForm({...productForm,image_url:e.target.value})} placeholder="https://..."/></label>
    <label>مدل قیمت<select value={productForm.pricing_model} onChange={e=>setProductForm({...productForm,pricing_model:e.target.value})}><option value="fixed">قیمت ثابت</option><option value="request_quote">استعلام قیمت</option></select></label>
    {productForm.pricing_model==="fixed"&&<label>قیمت<input type="number" min="0.01" step="0.01" required value={productForm.price} onChange={e=>setProductForm({...productForm,price:e.target.value})}/></label>}
    <label>ارز<select value={productForm.currency} onChange={e=>setProductForm({...productForm,currency:e.target.value})}>{Object.keys(currencyLabels).map(k=><option key={k} value={k}>{currencyLabels[k]} ({k})</option>)}</select></label>
    <label>واحد فروش<input required value={productForm.unit_label} onChange={e=>setProductForm({...productForm,unit_label:e.target.value})} placeholder="کیلوگرم، بسته، عدد..."/></label>
    <label>حداقل مقدار سفارش<input type="number" min="0.01" step="0.01" required value={productForm.minimum_order_qty} onChange={e=>setProductForm({...productForm,minimum_order_qty:e.target.value})}/></label>
    <label>موجودی {productForm.pricing_model==="fixed"?"(الزامی برای قیمت ثابت)":"(اختیاری)"}<input type="number" min="0" step="0.01" required={productForm.pricing_model==="fixed"} value={productForm.stock_qty} onChange={e=>setProductForm({...productForm,stock_qty:e.target.value})}/></label>
    <button type="submit" disabled={busy||!categories.length}>{busy?"در حال ذخیره...":editingProductId?"ذخیره تغییرات":"ذخیره پیش‌نویس محصول"}</button>
   </form>}
   <div className="specialist-store-list">{products.map(p=><article key={p.id}><div><strong>{p.name}</strong><p>{p.description||"بدون توضیحات"} · {p.pricing_model==="request_quote"?"قیمت با استعلام":Number(p.price||0).toLocaleString("fa-IR")+" "+(currencyLabels[p.currency]||p.currency)} / {p.unit_label}</p><small>{statusLabels[p.status]||p.status} · {new Date(p.created_at).toLocaleDateString("fa-IR")}</small></div><div className="specialist-store-row-actions"><button type="button" disabled={busy} onClick={()=>editProduct(p)}>ویرایش</button>{p.status==="published"?<button type="button" disabled={busy} onClick={()=>void updateProductStatus(p,"draft")}>بازگردانی به پیش‌نویس</button>:<button type="button" disabled={busy||!verified} title={!verified?"انتشار پس از تأیید فروشنده فعال می‌شود":""} onClick={()=>void updateProductStatus(p,"published")}>انتشار در بازارگاه</button>}</div></article>)}{products.length===0&&<div className="specialist-store-empty">هنوز محصولی ثبت نشده است. می‌توانید اولین محصول را به‌صورت پیش‌نویس اضافه کنید.</div>}</div>
   <div className="specialist-store-actions"><div><h3><Truck size={18}/> سفارش‌های دریافتی</h3><p>سفارش‌های مربوط به فروشگاه شما پس از ثبت توسط خریداران در این بخش دیده می‌شوند.</p></div></div>
   <div className="specialist-store-list">{orders.map(o=><article key={o.id}><div><strong>سفارش {o.order_number}</strong><p>{Number(o.total_amount).toLocaleString("fa-IR")} {currencyLabels[o.currency]||o.currency}</p><small>{statusLabels[o.status]||o.status} · پرداخت: {statusLabels[o.payment_status]||o.payment_status} · {new Date(o.placed_at).toLocaleDateString("fa-IR")}</small></div></article>)}{orders.length===0&&<div className="specialist-store-empty">هنوز سفارشی برای این فروشگاه ثبت نشده است.</div>}</div>
  </>}
 </section>;
}
