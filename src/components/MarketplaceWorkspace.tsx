import {useEffect,useMemo,useState} from "react";
import {BadgeCheck,Leaf,PackageSearch,RefreshCw,Search,ShieldCheck,ShoppingBag,ShoppingCart,Store} from "lucide-react";
import {supabase} from "../lib/supabase";
import FarmerStoreWorkspace from "./FarmerStoreWorkspace";
import MarketplaceBuyerWorkspace from "./MarketplaceBuyerWorkspace";

type Category={id:string;code:string;name_fa:string;name_en:string;market_section:string;sort_order:number};
type Product={id:string;seller_id:string;category_id:string;market_section:string;name:string;description:string|null;specifications:Record<string,unknown>;pricing_model:string;price:number|string|null;currency:string;unit_label:string;minimum_order_qty:number|string;stock_qty:number|string|null;reserved_qty:number|string;origin_country:string|null;origin_region:string|null;quality_grade:string|null;image_urls:unknown;regulated:boolean;regulatory_status:string;regulatory_reviewed_at:string|null;is_sarina_premium:boolean};
type Seller={id:string;display_name:string;seller_type:string;country_code:string|null;region:string|null;city:string|null;verification_status:string};

const currencyLabels:Record<string,string>={IRR:"ریال",USD:"دلار",EUR:"یورو",AED:"درهم",TRY:"لیر",AZN:"منات"};

function safeImage(value:unknown):string|null{
 const candidate=Array.isArray(value)?value.find(item=>typeof item==="string"):null;
 if(typeof candidate!=="string")return null;
 try{const url=new URL(candidate);return url.protocol==="https:"?url.toString():null;}catch{return null;}
}
function formatPrice(value:number|string|null,currency:string,unit:string){
 if(value===null||value===undefined)return "قیمت با استعلام";
 const amount=Number(value);if(!Number.isFinite(amount))return "قیمت با استعلام";
 return amount.toLocaleString("fa-IR",{maximumFractionDigits:2})+" "+(currencyLabels[currency]||currency)+" / "+unit;
}

export default function MarketplaceWorkspace({userId}:{userId:string|null}){
 const[view,setView]=useState<"catalog"|"buyer"|"my-store">("catalog");
 const[categories,setCategories]=useState<Category[]>([]);
 const[products,setProducts]=useState<Product[]>([]);
 const[sellers,setSellers]=useState<Record<string,Seller>>({});
 const[section,setSection]=useState<"farmer_products"|"company_supplies">("farmer_products");
 const[categoryId,setCategoryId]=useState("all");
 const[search,setSearch]=useState("");
 const[loading,setLoading]=useState(true);
 const[error,setError]=useState("");
 const[notice,setNotice]=useState("");
 const[cartBusy,setCartBusy]=useState(false);
 const[quoteProductId,setQuoteProductId]=useState<string|null>(null);
 const[quoteQuantity,setQuoteQuantity]=useState("1");
 const[quoteMessage,setQuoteMessage]=useState("");
 const[refreshedAt,setRefreshedAt]=useState<Date|null>(null);

 async function load(){
  if(!supabase){setError("اتصال پایگاه داده در این محیط پیکربندی نشده است.");setLoading(false);return;}
  setLoading(true);setError("");
  try{
   const client=supabase as any;
   const [categoryResult,productResult]=await Promise.all([
    client.from("marketplace_categories").select("id,code,name_fa,name_en,market_section,sort_order").eq("is_active",true).order("sort_order",{ascending:true}),
    client.from("marketplace_products").select("id,seller_id,category_id,market_section,name,description,specifications,pricing_model,price,currency,unit_label,minimum_order_qty,stock_qty,reserved_qty,origin_country,origin_region,quality_grade,image_urls,regulated,regulatory_status,regulatory_reviewed_at,is_sarina_premium").eq("status","published").order("published_at",{ascending:false}).limit(80)
   ]);
   if(categoryResult.error)throw categoryResult.error;
   if(productResult.error)throw productResult.error;
   const nextProducts=(productResult.data||[]) as Product[];
   const sellerIds=[...new Set(nextProducts.map(item=>item.seller_id).filter(Boolean))];
   let nextSellers:Record<string,Seller>={};
   if(sellerIds.length){
    const {data,error:sellerError}=await client.from("marketplace_sellers").select("id,display_name,seller_type,country_code,region,city,verification_status").in("id",sellerIds);
    if(sellerError)throw sellerError;
    nextSellers=Object.fromEntries(((data||[]) as Seller[]).map(seller=>[seller.id,seller]));
   }
   setCategories((categoryResult.data||[]) as Category[]);
   // Never display a product unless its seller record is present and verified.
   setProducts(nextProducts.filter(item=>nextSellers[item.seller_id]?.verification_status==="verified"));
   setSellers(nextSellers);
   setRefreshedAt(new Date());
  }catch(err){
   setError(err instanceof Error?err.message:"دریافت اطلاعات بازارگاه با مشکل روبه‌رو شد.");
  }finally{setLoading(false);}
 }
 useEffect(()=>{if(view==="catalog")void load();},[view]);
 const visibleCategories=useMemo(()=>categories.filter(item=>item.market_section===section),[categories,section]);
 const visibleProducts=useMemo(()=>products.filter(item=>item.market_section===section&&(categoryId==="all"||item.category_id===categoryId)&&[item.name,item.description,item.origin_country,item.origin_region].filter(Boolean).join(" ").toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())),[products,section,categoryId,search,categories]);
 const categoryNames=useMemo(()=>Object.fromEntries(categories.map(item=>[item.id,item.name_fa])),[categories]);

 function changeSection(next:"farmer_products"|"company_supplies"){setSection(next);setCategoryId("all");setSearch("");}
 async function addToCart(product:Product){
  if(!supabase||!userId){setError("برای افزودن محصول به سبد، ابتدا وارد حساب شوید.");return;}
  const quantity=Math.max(1,Number(product.minimum_order_qty)||1);
  const available=product.stock_qty===null?0:Number(product.stock_qty)-Number(product.reserved_qty||0);
  if(available<quantity){setError("موجودی قابل عرضه برای حداقل سفارش این محصول کافی نیست.");return;}
  setCartBusy(true);setError("");setNotice("");
  try{
   const client=supabase as any;
   const {data:existing,error:readError}=await client.from("marketplace_cart_items").select("id,quantity").eq("buyer_user_id",userId).eq("product_id",product.id).maybeSingle();
   if(readError)throw readError;
   const nextQuantity=Number(existing?.quantity||0)+quantity;
   if(nextQuantity>available)throw new Error("مجموع مقدار این محصول در سبد از موجودی قابل عرضه بیشتر می‌شود.");
   const result=existing?await client.from("marketplace_cart_items").update({quantity:nextQuantity}).eq("id",existing.id):await client.from("marketplace_cart_items").insert({buyer_user_id:userId,product_id:product.id,quantity});
   if(result.error)throw result.error;
   setNotice("محصول به سبد خرید اضافه شد.");
  }catch(e){setError(e instanceof Error?e.message:"افزودن محصول به سبد انجام نشد.");}
  finally{setCartBusy(false);}
 }
 async function submitQuote(product:Product){
  if(!supabase||!userId)return;
  const quantity=Number(quoteQuantity);
  if(!Number.isFinite(quantity)||quantity<Number(product.minimum_order_qty)){setError("مقدار درخواست قیمت نباید از حداقل سفارش محصول کمتر باشد.");return;}
  if(quoteMessage.trim().length<3){setError("برای درخواست قیمت، توضیح کوتاهی بنویسید.");return;}
  setCartBusy(true);setError("");setNotice("");
  try{const {error}=await (supabase as any).rpc("create_marketplace_quote_request",{p_seller_id:product.seller_id,p_product_id:product.id,p_quantity:quantity,p_unit_label:product.unit_label,p_message:quoteMessage.trim()});if(error)throw error;setQuoteProductId(null);setQuoteMessage("");setQuoteQuantity("1");setNotice("درخواست استعلام قیمت ثبت شد؛ پاسخ فروشنده در بخش سبد و سفارش‌ها نمایش داده می‌شود.");}
  catch(e){setError(e instanceof Error?e.message:"ثبت درخواست قیمت انجام نشد.");}
  finally{setCartBusy(false);}
 }
 return <section className="marketplace-workspace" dir="rtl">
  <div className="marketplace-mode-tabs" role="tablist" aria-label="بخش‌های بازارگاه">
   <button type="button" role="tab" aria-selected={view==="catalog"} className={view==="catalog"?"active":""} onClick={()=>setView("catalog")}><ShoppingBag size={17}/>مشاهده بازارگاه</button>
   <button type="button" role="tab" aria-selected={view==="buyer"} className={view==="buyer"?"active":""} onClick={()=>setView("buyer")}><ShoppingCart size={17}/>سبد و سفارش‌ها</button>
   <button type="button" role="tab" aria-selected={view==="my-store"} className={view==="my-store"?"active":""} onClick={()=>setView("my-store")}><Store size={17}/>محصولات من</button>
  </div>
  {view==="my-store"?<FarmerStoreWorkspace userId={userId||""} enabled={Boolean(userId)}/>:view==="buyer"?<MarketplaceBuyerWorkspace userId={userId||""}/>:<>
  <div className="marketplace-heading">
   <div><span className="marketplace-eyebrow">بازار مطمئن کشاورزی</span><h1>بازارگاه SARINA</h1><p>محصولات کشاورزان و نهاده‌های تأمین‌کنندگان را در یک فضای شفاف ببینید.</p></div>
   <button className="marketplace-refresh" type="button" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/>{loading?"در حال به‌روزرسانی":"به‌روزرسانی"}</button>
  </div>
  <div className="marketplace-trust-note"><ShieldCheck size={18}/><span>فقط محصولات منتشرشده از فروشندگان تأییدشده نمایش داده می‌شوند. ثبت سفارش و درخواست قیمت ممکن است؛ پرداخت آنلاین هنوز فعال نیست.</span></div>
  {error&&<div className="marketplace-error" role="alert">{error}</div>}{notice&&<div className="marketplace-buyer-notice">{notice}</div>}
  <div className="marketplace-tabs" role="tablist" aria-label="بخش‌های بازارگاه">
   <button type="button" role="tab" aria-selected={section==="farmer_products"} className={section==="farmer_products"?"active":""} onClick={()=>changeSection("farmer_products")}><Leaf size={18}/>محصولات کشاورزان</button>
   <button type="button" role="tab" aria-selected={section==="company_supplies"} className={section==="company_supplies"?"active":""} onClick={()=>changeSection("company_supplies")}><Store size={18}/>فروشگاه نهاده‌ها و تجهیزات</button>
  </div>
  {section==="company_supplies"&&<div className="marketplace-export-note"><BadgeCheck size={18}/><div><strong>بررسی سازگاری با بازار صادراتی</strong><p>سازگاری یک نهاده با محصول و کشور مقصد باید جداگانه و بر پایه مقررات رسمی ارزیابی شود. در این نسخه هنوز ارزیابی مقصد برای محصولات ثبت نشده است؛ بنابراین هیچ محصولی به‌طور خودکار «مناسب صادرات» تلقی نمی‌شود.</p></div></div>}
  <div className="marketplace-filters">
   <label className="marketplace-search"><Search size={17}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="جست‌وجوی نام محصول، منطقه یا مبدأ..."/></label>
   <label className="marketplace-category"><span>دسته‌بندی</span><select value={categoryId} onChange={event=>setCategoryId(event.target.value)}><option value="all">همه دسته‌ها</option>{visibleCategories.map(item=><option key={item.id} value={item.id}>{item.name_fa}</option>)}</select></label>
  </div>
  {error&&<div className="marketplace-error" role="alert">{error}</div>}
  {loading?<div className="marketplace-empty"><PackageSearch size={30}/><strong>در حال دریافت فهرست محصولات...</strong><p>اطلاعات فقط از جداول و دسترسی‌های موجود خوانده می‌شود.</p></div>
   :visibleProducts.length===0?<div className="marketplace-empty"><ShoppingBag size={34}/><strong>{search||categoryId!=="all"?"محصولی با این فیلتر پیدا نشد":"هنوز محصول منتشرشده‌ای برای نمایش وجود ندارد"}</strong><p>با تأیید فروشندگان و انتشار محصولات، فهرست این بخش به‌صورت خودکار نمایش داده خواهد شد.</p></div>
   :<div className="marketplace-grid">{visibleProducts.map(product=>{
    const seller=sellers[product.seller_id];const image=safeImage(product.image_urls);const category=categoryNames[product.category_id]||"سایر محصولات";
    return <article className="marketplace-product-card" key={product.id}>
     <div className="marketplace-product-media">{image?<img src={image} alt={product.name} loading="lazy"/>:<div className="marketplace-product-placeholder"><Leaf size={34}/><span>SARINA</span></div>}{product.is_sarina_premium&&<span className="marketplace-premium">منتخب سارینا</span>}</div>
     <div className="marketplace-product-body">
      <div className="marketplace-product-meta"><span>{category}</span>{product.regulated&&<span className={product.regulatory_status==="verified"?"marketplace-regulatory-ok":"marketplace-regulatory-pending"}>{product.regulatory_status==="verified"?"بررسی مجوز ثبت شده":"نیازمند بررسی مجوز"}</span>}</div>
      <h3>{product.name}</h3>
      <p>{product.description||"توضیحات تکمیلی این محصول هنوز ثبت نشده است."}</p>
      <div className="marketplace-seller"><Store size={14}/><span>{seller?.display_name||"فروشنده تأییدشده"}</span>{seller?.verification_status==="verified"&&<BadgeCheck size={14}/>}</div>
      <div className="marketplace-origin">{[product.origin_region,product.origin_country].filter(Boolean).length?"مبدأ اعلامی فروشنده: "+[product.origin_region,product.origin_country].filter(Boolean).join("، "):"مبدأ ثبت نشده"}{product.quality_grade?" · کیفیت اعلامی فروشنده: "+product.quality_grade:""}</div>
      <div className="marketplace-product-footer"><strong>{product.pricing_model==="request_quote"?"قیمت با استعلام":formatPrice(product.price,product.currency,product.unit_label)}</strong><small>حداقل سفارش: {Number(product.minimum_order_qty).toLocaleString("fa-IR")} {product.unit_label}</small></div>
      {product.pricing_model==="fixed"?<button className="marketplace-action" type="button" disabled={!userId||cartBusy} onClick={()=>void addToCart(product)}>{cartBusy?"در حال ثبت...":"افزودن به سبد خرید"}</button>:<>
       <button className="marketplace-action secondary" type="button" disabled={!userId||cartBusy} onClick={()=>{setQuoteProductId(quoteProductId===product.id?null:product.id);setQuoteQuantity(String(product.minimum_order_qty));setQuoteMessage("");setError("");}}>{quoteProductId===product.id?"بستن فرم":"درخواست قیمت"}</button>
       {quoteProductId===product.id&&<div className="marketplace-quote-form"><label>مقدار موردنیاز<input type="number" min={Number(product.minimum_order_qty)} step="0.01" value={quoteQuantity} onChange={e=>setQuoteQuantity(e.target.value)}/></label><label>توضیح درخواست<textarea rows={2} value={quoteMessage} onChange={e=>setQuoteMessage(e.target.value)} placeholder="مقدار، زمان و شرایط موردنیاز را بنویسید."/></label><button type="button" disabled={cartBusy} onClick={()=>void submitQuote(product)}>ارسال درخواست قیمت</button></div>}
      </>}
     </div>
    </article>;
   })}</div>}
  <div className="marketplace-footnote"><ShieldCheck size={15}/><span>وضعیت تأیید فروشنده و بررسی مجوز محصول، جایگزین بررسی تخصصی و مقررات کشور مقصد صادرات نیست.</span>{refreshedAt&&<small>آخرین دریافت: {refreshedAt.toLocaleTimeString("fa-IR",{hour:"2-digit",minute:"2-digit"})}</small>}</div>
  </>}
 </section>;
}
