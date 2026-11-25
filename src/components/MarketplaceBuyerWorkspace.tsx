import {useCallback,useEffect,useMemo,useState} from "react";
import {ClipboardList,Package,RefreshCw,ShoppingCart,Truck} from "lucide-react";
import {supabase} from "../lib/supabase";

type CartRow={id:string;product_id:string;quantity:number|string};
type Product={id:string;seller_id:string;name:string;price:number|string|null;currency:string;unit_label:string;stock_qty:number|string|null;reserved_qty:number|string;minimum_order_qty:number|string;pricing_model:string;status:string};
type Seller={id:string;display_name:string;verification_status:string};
type Order={id:string;order_number:string;seller_id:string;status:string;payment_status:string;fulfillment_status:string;total_amount:number|string;currency:string;placed_at:string;reservation_expires_at:string};
type Quote={id:string;seller_id:string;product_id:string|null;quantity:number|string|null;unit_label:string|null;message:string;status:string;seller_response:string|null;created_at:string};

const db=supabase as any;
const currencies:Record<string,string>={IRR:"ریال",USD:"دلار",EUR:"یورو",AED:"درهم",TRY:"لیر",AZN:"منات"};
const orderStatus:Record<string,string>={awaiting_payment:"در انتظار پرداخت",confirmed:"تأیید سفارش",processing:"در حال آماده‌سازی",shipped:"ارسال‌شده",delivered:"تحویل‌شده",cancelled:"لغوشده",disputed:"در حال رسیدگی"};
const paymentStatus:Record<string,string>={unpaid:"پرداخت‌نشده",pending:"در انتظار تأیید",paid:"پرداخت تأییدشده",failed:"پرداخت ناموفق",partially_refunded:"بازپرداخت جزئی",refunded:"بازپرداخت‌شده"};
const fulfillmentStatus:Record<string,string>={not_arranged:"هماهنگ نشده",preparing:"در حال آماده‌سازی",shipped:"ارسال‌شده",delivered:"تحویل‌شده",returned:"مرجوع‌شده"};

export default function MarketplaceBuyerWorkspace({userId}:{userId:string}){
 const[cart,setCart]=useState<CartRow[]>([]);
 const[products,setProducts]=useState<Record<string,Product>>({});
 const[sellers,setSellers]=useState<Record<string,Seller>>({});
 const[orders,setOrders]=useState<Order[]>([]);
 const[quotes,setQuotes]=useState<Quote[]>([]);
 const[loading,setLoading]=useState(true);
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState("");
 const[notice,setNotice]=useState("");
 const[checkoutSellerId,setCheckoutSellerId]=useState<string|null>(null);
 const[shipping,setShipping]=useState({recipient:"",phone:"",address:"",city:"",country:""});
 const[buyerNote,setBuyerNote]=useState("");

 const load=useCallback(async()=>{
  if(!supabase||!userId){setError("نشست کاربر یا اتصال پایگاه داده در دسترس نیست.");setLoading(false);return;}
  setLoading(true);setError("");
  try{
   const cartResult=await db.from("marketplace_cart_items").select("id,product_id,quantity").eq("buyer_user_id",userId).order("created_at",{ascending:false});
   if(cartResult.error)throw cartResult.error;
   const nextCart=(cartResult.data||[]) as CartRow[];
   const productIds=[...new Set(nextCart.map(item=>item.product_id))];
   let nextProducts:Record<string,Product>={};
   let nextSellers:Record<string,Seller>={};
   if(productIds.length){
    const p=await db.from("marketplace_products").select("id,seller_id,name,price,currency,unit_label,stock_qty,reserved_qty,minimum_order_qty,pricing_model,status").in("id",productIds);
    if(p.error)throw p.error;
    nextProducts=Object.fromEntries(((p.data||[]) as Product[]).map(item=>[item.id,item]));
    const sellerIds=[...new Set(((p.data||[]) as Product[]).map(item=>item.seller_id))];
    if(sellerIds.length){
     const s=await db.from("marketplace_sellers").select("id,display_name,verification_status").in("id",sellerIds);
     if(s.error)throw s.error;
     nextSellers=Object.fromEntries(((s.data||[]) as Seller[]).map(item=>[item.id,item]));
    }
   }
   const [o,q]=await Promise.all([
    db.from("marketplace_orders").select("id,order_number,seller_id,status,payment_status,fulfillment_status,total_amount,currency,placed_at,reservation_expires_at").eq("buyer_user_id",userId).order("placed_at",{ascending:false}).limit(30),
    db.from("marketplace_quote_requests").select("id,seller_id,product_id,quantity,unit_label,message,status,seller_response,created_at").eq("buyer_user_id",userId).order("created_at",{ascending:false}).limit(30)
   ]);
   if(o.error)throw o.error;if(q.error)throw q.error;
   setCart(nextCart);setProducts(nextProducts);setSellers(nextSellers);setOrders((o.data||[]) as Order[]);setQuotes((q.data||[]) as Quote[]);
  }catch(e){setError(e instanceof Error?e.message:"دریافت سبد و سفارش‌ها انجام نشد.");}
  finally{setLoading(false);}
 },[userId]);

 useEffect(()=>{void load();},[load]);

 const groups=useMemo(()=>{
  const grouped:Record<string,CartRow[]>={};
  for(const item of cart){const sellerId=products[item.product_id]?.seller_id;if(!sellerId)continue;(grouped[sellerId]??=[]).push(item);}
  return grouped;
 },[cart,products]);
 const cartCount=cart.reduce((sum,item)=>sum+Number(item.quantity||0),0);

 async function changeQuantity(item:CartRow,delta:number){
  if(!supabase)return;
  const product=products[item.product_id];const next=Number(item.quantity)+delta;
  if(!product||next<=0)return;
  if(product.stock_qty!==null&&next>Number(product.stock_qty)-Number(product.reserved_qty||0)){setError("مقدار درخواستی از موجودی قابل عرضه بیشتر است.");return;}
  setBusy(true);setError("");setNotice("");
  try{const {error}=await db.from("marketplace_cart_items").update({quantity:next}).eq("id",item.id);if(error)throw error;await load();}
  catch(e){setError(e instanceof Error?e.message:"تغییر تعداد انجام نشد.");}
  finally{setBusy(false);}
 }
 async function removeItem(item:CartRow){
  if(!supabase)return;
  setBusy(true);setError("");setNotice("");
  try{const {error}=await db.from("marketplace_cart_items").delete().eq("id",item.id);if(error)throw error;setNotice("محصول از سبد حذف شد.");await load();}
  catch(e){setError(e instanceof Error?e.message:"حذف محصول انجام نشد.");}
  finally{setBusy(false);}
 }
 async function checkout(sellerId:string){
  if(!supabase)return;
  if(!shipping.recipient.trim()||shipping.phone.trim().length<5||shipping.address.trim().length<5||shipping.city.trim().length<2||shipping.country.trim().length<2){setError("اطلاعات تحویل‌گیرنده، تلفن، نشانی، شهر و کشور را کامل کنید.");return;}
  setBusy(true);setError("");setNotice("");
  try{
   const {data,error}=await db.rpc("create_marketplace_order",{p_seller_id:sellerId,p_shipping_address:{recipient:shipping.recipient.trim(),phone:shipping.phone.trim(),address:shipping.address.trim(),city:shipping.city.trim(),country:shipping.country.trim()},p_buyer_note:buyerNote.trim()||null});
   if(error)throw error;
   setCheckoutSellerId(null);setBuyerNote("");setShipping({recipient:"",phone:"",address:"",city:"",country:""});
   setNotice("سفارش "+String(data||"")+" ثبت شد. وضعیت آن «در انتظار پرداخت» است؛ پرداخت آنلاین هنوز در SARINA فعال نشده است.");
   await load();
  }catch(e){setError(e instanceof Error?e.message:"ثبت سفارش انجام نشد.");}
  finally{setBusy(false);}
 }
 async function cancelOrder(order:Order){
  if(!supabase)return;
  setBusy(true);setError("");setNotice("");
  try{const {error}=await db.rpc("cancel_marketplace_order",{p_order_id:order.id});if(error)throw error;setNotice("سفارش پرداخت‌نشده لغو شد و رزرو موجودی آزاد شد.");await load();}
  catch(e){setError(e instanceof Error?e.message:"لغو سفارش انجام نشد.");}
  finally{setBusy(false);}
 }

 return <section className="marketplace-buyer" dir="rtl">
  <div className="marketplace-buyer-heading"><div><span>خرید و پیگیری</span><h2><ShoppingCart size={21}/> سبد خرید و سفارش‌ها</h2><p>هر سفارش برای یک فروشنده ثبت می‌شود. پرداخت آنلاین هنوز فعال نیست.</p></div><button type="button" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> به‌روزرسانی</button></div>
  {error&&<div className="marketplace-error" role="alert">{error}</div>}{notice&&<div className="marketplace-buyer-notice">{notice}</div>}
  {loading?<div className="marketplace-empty"><Package size={30}/><strong>در حال دریافت اطلاعات خرید...</strong></div>:<>
   <div className="marketplace-buyer-stats"><span>تعداد اقلام سبد: <b>{cartCount.toLocaleString("fa-IR")}</b></span><span>سفارش‌ها: <b>{orders.length.toLocaleString("fa-IR")}</b></span><span>درخواست‌های قیمت: <b>{quotes.length.toLocaleString("fa-IR")}</b></span></div>
   <h3>سبد خرید</h3>
   {Object.keys(groups).length===0?<div className="marketplace-empty"><ShoppingCart size={30}/><strong>سبد خرید شما خالی است</strong><p>از بخش بازارگاه، محصولات دارای قیمت ثابت را به سبد اضافه کنید.</p></div>:Object.entries(groups).map(([sellerId,items])=>{
    const seller=sellers[sellerId];const total=items.reduce((sum,item)=>{const p=products[item.product_id];return sum+(p?.price===null?0:Number(p?.price||0)*Number(item.quantity));},0);const currency=products[items[0]?.product_id]?.currency||"";
    return <article className="marketplace-cart-seller" key={sellerId}>
     <header><strong>{seller?.display_name||"فروشنده"}</strong><small>{items.length.toLocaleString("fa-IR")} محصول</small></header>
     {items.map(item=>{const p=products[item.product_id];if(!p)return <div className="marketplace-cart-row" key={item.id}><span>این محصول دیگر در دسترس نیست.</span><button type="button" disabled={busy} onClick={()=>void removeItem(item)}>حذف</button></div>;return <div className="marketplace-cart-row" key={item.id}>
      <div><strong>{p.name}</strong><small>{Number(p.price||0).toLocaleString("fa-IR")} {currencies[p.currency]||p.currency} / {p.unit_label}</small></div>
      <div className="marketplace-cart-quantity"><button type="button" disabled={busy} onClick={()=>void changeQuantity(item,-1)}>−</button><b>{Number(item.quantity).toLocaleString("fa-IR")}</b><button type="button" disabled={busy} onClick={()=>void changeQuantity(item,1)}>+</button></div>
      <button type="button" className="marketplace-cart-remove" disabled={busy} onClick={()=>void removeItem(item)}>حذف</button>
     </div>;})}
     <div className="marketplace-cart-total"><span>جمع اقلام این فروشنده</span><strong>{total.toLocaleString("fa-IR")} {currencies[currency]||currency}</strong></div>
     {checkoutSellerId===sellerId?<div className="marketplace-checkout-form">
      <h4>اطلاعات تحویل</h4>
      <label>نام تحویل‌گیرنده<input value={shipping.recipient} onChange={e=>setShipping({...shipping,recipient:e.target.value})}/></label>
      <label>تلفن تماس<input value={shipping.phone} onChange={e=>setShipping({...shipping,phone:e.target.value})}/></label>
      <label>نشانی کامل<textarea rows={2} value={shipping.address} onChange={e=>setShipping({...shipping,address:e.target.value})}/></label>
      <label>شهر<input value={shipping.city} onChange={e=>setShipping({...shipping,city:e.target.value})}/></label>
      <label>کشور<input value={shipping.country} onChange={e=>setShipping({...shipping,country:e.target.value})}/></label>
      <label>توضیح برای فروشنده (اختیاری)<textarea rows={2} value={buyerNote} onChange={e=>setBuyerNote(e.target.value)}/></label>
      <p>ثبت سفارش باعث رزرو موقت موجودی به مدت ۳۰ دقیقه می‌شود. این مرحله پرداخت نیست و هیچ مبلغی دریافت نمی‌شود.</p>
      <div><button type="button" disabled={busy} onClick={()=>void checkout(sellerId)}>{busy?"در حال ثبت...":"ثبت سفارش و پیش‌نویس فاکتور"}</button><button type="button" disabled={busy} onClick={()=>setCheckoutSellerId(null)}>انصراف</button></div>
     </div>:<button className="marketplace-checkout-start" type="button" disabled={busy} onClick={()=>setCheckoutSellerId(sellerId)}>ثبت سفارش برای این فروشنده</button>}
    </article>;
   })}
   <h3>درخواست‌های استعلام قیمت</h3>
   {quotes.length===0?<div className="marketplace-empty"><ClipboardList size={26}/><strong>هنوز درخواست قیمتی ثبت نشده است</strong></div>:<div className="marketplace-quote-list">{quotes.map(q=><article key={q.id}><div><strong>{sellers[q.seller_id]?.display_name||"فروشنده"}</strong><small>{new Date(q.created_at).toLocaleDateString("fa-IR")}</small></div><p>{q.message}</p><span>{q.status==="open"?"در انتظار پاسخ":q.status==="responded"?"پاسخ دریافت شد":q.status==="declined"?"ردشده":"بسته‌شده"}</span>{q.seller_response&&<blockquote>{q.seller_response}</blockquote>}</article>)}</div>}
   <h3>سفارش‌های من</h3>
   {orders.length===0?<div className="marketplace-empty"><Package size={26}/><strong>هنوز سفارشی ثبت نشده است</strong></div>:<div className="marketplace-order-list">{orders.map(order=><article key={order.id}>
    <div className="marketplace-order-heading"><div><strong>{order.order_number}</strong><small>{sellers[order.seller_id]?.display_name||"فروشنده"} · {new Date(order.placed_at).toLocaleDateString("fa-IR")}</small></div><b>{Number(order.total_amount).toLocaleString("fa-IR")} {currencies[order.currency]||order.currency}</b></div>
    <div className="marketplace-order-status"><span>{orderStatus[order.status]||order.status}</span><span>{paymentStatus[order.payment_status]||order.payment_status}</span><span>{fulfillmentStatus[order.fulfillment_status]||order.fulfillment_status}</span></div>
    {order.status==="awaiting_payment"&&order.payment_status==="unpaid"&&<div className="marketplace-order-pending"><p>این سفارش هنوز پرداخت نشده است. پرداخت آنلاین در SARINA فعال نیست.</p><small>انقضای رزرو: {new Date(order.reservation_expires_at).toLocaleString("fa-IR")}</small><button type="button" disabled={busy} onClick={()=>void cancelOrder(order)}>لغو سفارش و آزادسازی موجودی</button></div>}
   </article>)}</div>}
  </>}
 </section>;
}
