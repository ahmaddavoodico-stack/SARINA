import {useCallback,useEffect,useMemo,useState} from "react";
import {AlertCircle,ArrowLeft,CalendarClock,CreditCard,History,Leaf,Package,RefreshCw,Wallet} from "lucide-react";
import {supabase} from "../lib/supabase";

type LedgerEntry={id:string;delta_units:number;entry_type:string;period_start:string|null;period_end:string|null;description_code:string|null;created_at:string};
const db=supabase as any;
const fmt=(n:number)=>n.toLocaleString("fa-IR");
const date=(v:string|null|undefined)=>v?new Date(v+"T00:00:00").toLocaleDateString("fa-IR"):"ثبت نشده";
const kind=(v:string)=>({allowance:"سهمیه پایه ماهانه",usage:"مصرف خدمات",bonus:"اعتبار تشویقی",adjustment:"اصلاح اعتبار",reversal:"برگشت اعتبار",expiry:"انقضای اعتبار"} as Record<string,string>)[v]||"رویداد اعتبار";

export function FarmerCreditSummaryCard({userId,onOpen}:{userId:string;onOpen:()=>void}){
 const [rows,setRows]=useState<LedgerEntry[]>([]);
 const [loading,setLoading]=useState(true);
 const [unavailable,setUnavailable]=useState(false);
 const load=useCallback(async()=>{
  if(!supabase||!userId){setUnavailable(true);setLoading(false);return;}
  const {data,error}=await db.from("ai_conversation_credit_ledger").select("id,delta_units,entry_type,period_start,period_end,description_code,created_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(1000);
  if(error||(data||[]).length>=1000){setUnavailable(true);setRows([]);}else{setUnavailable(false);setRows((data||[]) as LedgerEntry[]);}
  setLoading(false);
 },[userId]);
 useEffect(()=>{void load();},[load]);
 const balance=useMemo(()=>rows.reduce((sum,row)=>sum+Number(row.delta_units||0),0),[rows]);
 return <button type="button" className="farmer-credit-summary" onClick={onOpen}>
  <span className="farmer-credit-summary-icon"><Leaf size={21}/></span>
  <span className="farmer-credit-summary-copy"><small>اعتبار خدمات SARINA</small><strong>{loading?"در حال دریافت…":unavailable?"اطلاعات فعلاً در دسترس نیست":rows.length===0?"هنوز اعتباری ثبت نشده":fmt(balance)+" واحد"}</strong><em>سهمیه، مصرف، تمدید و بسته‌های افزایش اعتبار</em></span>
  <ArrowLeft size={18}/>
 </button>;
}

export default function FarmerCreditWorkspace({userId}:{userId:string}){
 const [rows,setRows]=useState<LedgerEntry[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [unavailable,setUnavailable]=useState(false);
 const load=useCallback(async()=>{
  if(!supabase||!userId){setUnavailable(true);setLoading(false);return;}
  setLoading(true);setError("");
  const {data,error}=await db.from("ai_conversation_credit_ledger").select("id,delta_units,entry_type,period_start,period_end,description_code,created_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(1000);
  if(error||(data||[]).length>=1000){setUnavailable(true);setRows([]);setError(error?"دریافت دفترکل اعتبار ممکن نشد. لطفاً بعداً دوباره تلاش کنید.":"تعداد رویدادهای دفترکل از محدوده امن نمایش بیشتر است؛ برای جلوگیری از محاسبه ناقص، موجودی نمایش داده نمی‌شود.");}
  else{setUnavailable(false);setRows((data||[]) as LedgerEntry[]);}
  setLoading(false);
 },[userId]);
 useEffect(()=>{void load();},[load]);
 const balance=useMemo(()=>rows.reduce((sum,row)=>sum+Number(row.delta_units||0),0),[rows]);
 const currentAllowance=useMemo(()=>{
  const today=new Date().toISOString().slice(0,10);
  const active=rows.filter(x=>x.entry_type==="allowance"&&x.period_start&&x.period_end&&x.period_start<=today&&x.period_end>=today);
  return active.length?active.reduce((sum,x)=>sum+Number(x.delta_units||0),0):null;
 },[rows]);
 const latestPeriod=useMemo(()=>rows.filter(x=>x.entry_type==="allowance"&&x.period_end).sort((a,b)=>(b.period_end||"").localeCompare(a.period_end||""))[0]||null,[rows]);
 const usage=useMemo(()=>rows.filter(x=>x.entry_type==="usage").reduce((sum,x)=>sum+Math.abs(Number(x.delta_units||0)),0),[rows]);
 return <section className="farmer-credit-page" dir="rtl">
  <header className="farmer-credit-heading"><div><span>شفافیت و مدیریت خدمات</span><h1><Leaf size={24}/> اعتبار خدمات SARINA</h1><p>سهمیه پایه، مصرف خدمات و اعتبارهای تشویقی خود را در یکجا ببینید.</p></div><button type="button" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/> تازه‌سازی</button></header>
  {error&&<div className="farmer-credit-alert"><AlertCircle size={17}/>{error}</div>}
  {loading?<div className="farmer-credit-empty">در حال دریافت دفترکل اعتبار…</div>:unavailable?<div className="farmer-credit-empty"><AlertCircle size={25}/><b>اطلاعات اعتبار فعلاً قابل دریافت نیست</b><p>برای جلوگیری از نمایش عدد نادرست، موجودی یا مصرف تخمینی نشان داده نمی‌شود.</p></div>:<>
   <div className="farmer-credit-stats">
    <article className="primary"><small>مانده ثبت‌شده در دفترکل</small><strong>{fmt(balance)}</strong><span>واحد اعتبار</span></article>
    <article><small>سهمیه پایه دوره جاری</small><strong>{currentAllowance===null?"ثبت نشده":fmt(currentAllowance)}</strong><span>فقط تخصیص‌های ثبت‌شده در دوره جاری</span></article>
    <article><small>مصرف ثبت‌شده</small><strong>{fmt(usage)}</strong><span>مجموع رویدادهای مصرف موجود در دفترکل</span></article>
   </div>
   <div className="farmer-credit-period"><CalendarClock size={20}/><div><b>تمدید ماهانه سهمیه پایه</b><p>{latestPeriod?"آخرین دوره ثبت‌شده: "+date(latestPeriod.period_start)+" تا "+date(latestPeriod.period_end):"هنوز دوره تخصیص ماهانه‌ای در دفترکل این حساب ثبت نشده است."}</p><small>زمان تمدید بعدی فقط پس از ثبت برنامه تخصیص دوره‌ای از سمت سرور نمایش داده می‌شود.</small></div></div>
   <div className="farmer-credit-columns">
    <section className="farmer-credit-panel"><h2><Package size={19}/> بسته‌های افزایش اعتبار</h2><p>بسته‌های مستقیم اعتبار و بسته‌های خرید محصول همراه با اعتبار تشویقی، پس از انتشار کاتالوگ رسمی و اتصال پرداخت امن در این بخش نمایش داده می‌شوند.</p><div className="farmer-credit-disabled"><CreditCard size={21}/><div><b>خرید اعتبار هنوز فعال نشده است</b><small>هیچ قیمت یا بسته‌ای تا زمان تأیید رسمی به شما پیشنهاد نمی‌شود.</small></div></div></section>
    <section className="farmer-credit-panel"><h2><Wallet size={19}/> اعتبار تشویقی از خرید برندها</h2><p>در نسخه نهایی، خرید محصولات برند SARINA و برندهای معتبر تأییدشده می‌تواند طبق شرایط هر پیشنهاد، اعتبار تشویقی ایجاد کند.</p><div className="farmer-credit-disabled"><Leaf size={21}/><div><b>پیشنهادهای تشویقی در حال آماده‌سازی</b><small>اعتبار فقط پس از تأیید سفارش واجد شرایط ثبت خواهد شد.</small></div></div></section>
   </div>
   <section className="farmer-credit-panel farmer-credit-history"><h2><History size={19}/> سوابق اعتبار</h2>{rows.length===0?<div className="farmer-credit-empty">هنوز رویدادی در دفترکل اعتبار این حساب ثبت نشده است.</div>:<div className="farmer-credit-table"><div className="farmer-credit-table-head"><span>شرح رویداد</span><span>تاریخ</span><span>تغییر اعتبار</span></div>{rows.map(row=><article key={row.id}><div><b>{kind(row.entry_type)}</b><small>{row.description_code||"رویداد ثبت‌شده در دفترکل"}</small>{row.period_start&&row.period_end&&<small>دوره: {date(row.period_start)} تا {date(row.period_end)}</small>}</div><time>{new Date(row.created_at).toLocaleDateString("fa-IR")}</time><strong className={row.delta_units>0?"positive":"negative"}>{row.delta_units>0?"+":""}{fmt(row.delta_units)}</strong></article>)}</div>}</section>
  </>}
  <p className="farmer-credit-footnote">اعتبار SARINA سهمیه استفاده از خدمات پلتفرم است و پول نقد یا موجودی قابل برداشت محسوب نمی‌شود. تمدید خودکار و خرید تا زمان تکمیل و تأیید زیرساخت سمت سرور فعال نخواهد شد.</p>
 </section>;
}
