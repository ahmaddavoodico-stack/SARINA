import {useCallback,useEffect,useMemo,useState} from "react";
import type {Session} from "@supabase/supabase-js";
import {Building2,Check,RefreshCw,Search,ShieldCheck,Users} from "lucide-react";
import {supabase} from "../lib/supabase";
import MarketplaceAdminReviewWorkspace from "./MarketplaceAdminReviewWorkspace";

type Props={session:Session;onLogout:()=>void};
type AdminUser={id:string;full_name:string|null;email:string|null;account_status:string;created_at:string;role_codes:string[]};
const roleOptions=[
 {code:"farmer",label:"کشاورز"},
 {code:"livestock_keeper",label:"دامدار / پرورش‌دهنده"},
 {code:"expert",label:"متخصص"},
 {code:"organization",label:"نماینده شرکت / سازمان"},
];
const roleLabel=(code:string)=>roleOptions.find(r=>r.code===code)?.label??code;
const statusLabel=(status:string)=>({active:"فعال",pending:"در انتظار",suspended:"تعلیق‌شده",closed:"بسته‌شده"} as Record<string,string>)[status]??status;

export default function AdminDashboard({session,onLogout}:Props){
 const[users,setUsers]=useState<AdminUser[]>([]);
 const[loading,setLoading]=useState(true);
 const[busyUser,setBusyUser]=useState<string|null>(null);
 const[error,setError]=useState("");
 const[notice,setNotice]=useState("");
 const[busyStatus,setBusyStatus]=useState<string|null>(null);
 const[search,setSearch]=useState("");
 const[drafts,setDrafts]=useState<Record<string,string[]>>({});
 const load=useCallback(async(silent=false)=>{
  if(!supabase)return;if(!silent)setLoading(true);setError("");
  const{data,error:rpcError}=await supabase.rpc("admin_list_sarina_users" as never);
  if(rpcError){setError(`دریافت فهرست کاربران ناموفق بود: ${rpcError.message}${rpcError.code?` (کد: ${rpcError.code})`:""}`);setLoading(false);return;}
  const rows=((data??[]) as unknown as AdminUser[]).filter(user=>!(user.role_codes??[]).includes("admin"));
  setUsers(rows);setDrafts(Object.fromEntries(rows.map(user=>[user.id,(user.role_codes??[])])));
  setLoading(false);
 },[]);
 useEffect(()=>{void load();},[load]);
 const filtered=useMemo(()=>users.filter(user=>[user.full_name,user.email,user.id].filter(Boolean).join(" ").toLocaleLowerCase().includes(search.toLocaleLowerCase())),[users,search]);
 function toggle(userId:string,code:string){setDrafts(current=>{const selected=current[userId]??[];return {...current,[userId]:selected.includes(code)?selected.filter(item=>item!==code):[...selected,code]};});}
 async function changeStatus(user:AdminUser,status:"active"|"suspended"){if(!supabase||(user.role_codes??[]).includes("admin"))return;setBusyStatus(user.id);setError("");setNotice("");const{error:statusError}=await (supabase as any).rpc("admin_set_sarina_user_status",{p_target_user_id:user.id,p_status:status});setBusyStatus(null);if(statusError){setError(`تغییر وضعیت حساب ناموفق بود: ${statusError.message}${statusError.code?` (کد: ${statusError.code})`:""}`);return;}setUsers(current=>current.map(item=>item.id===user.id?{...item,account_status:status}:item));setNotice(status==="active"?"حساب کاربر تأیید و فعال شد؛ از وضعیت انتظار خارج شد.":"حساب کاربر تعلیق شد.");void load(true);}
 async function save(user:AdminUser){
  if(!supabase||(user.role_codes??[]).includes("admin"))return;setBusyUser(user.id);setNotice("");setError("");
  const{error:saveError}=await supabase.rpc("admin_set_sarina_user_roles" as never,{p_target_user_id:user.id,p_role_codes:drafts[user.id]??[]} as never);
  if(saveError){setError(`ذخیره نقش‌ها ناموفق بود: ${saveError.message}${saveError.code?` (کد: ${saveError.code})`:""}`);setBusyUser(null);return;}
  setNotice("نقش‌های کاربر با موفقیت به‌روزرسانی شد و در سابقه مدیریتی ثبت گردید.");
  await load(true);setBusyUser(null);
 }
 return <main className="admin-shell" dir="rtl">
  <header className="admin-topbar"><div className="admin-brand"><span><ShieldCheck size={22}/></span><div><strong>SARINA</strong><small>پنل مدیریت مرکزی</small></div></div><div className="admin-top-actions"><span>{session.user.email}</span><button onClick={onLogout}>خروج</button></div></header>
  <div className="admin-content">
   <div className="admin-heading"><div><span className="admin-eyebrow">مدیریت سامانه</span><h1>کاربران و نقش‌ها</h1><p>مدیریت نوع فعالیت حساب‌ها؛ بدون ساخت حساب جدید یا تغییر سوابق کاربر.</p></div><div className="admin-count"><Users size={20}/><strong>{users.length.toLocaleString("fa-IR")}</strong><small>حساب ثبت‌شده</small></div></div>
   <div className="admin-principle"><ShieldCheck size={19}/><p>نقش مدیر مرکزی از این پنل قابل اعطا یا حذف نیست. تغییرات نقش‌ها فقط از مسیر مجاز مدیر انجام می‌شود و در گزارش ممیزی ثبت خواهد شد.</p></div>
   {error&&<div className="admin-alert error">{error}</div>}{notice&&<div className="admin-alert success">{notice}</div>}
   <section className="admin-panel">
    <div className="admin-list-head"><div><h2>فهرست حساب‌ها</h2><small>نقش‌های عمومی هر حساب را انتخاب و ذخیره کنید.</small></div><button className="admin-refresh" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/> به‌روزرسانی</button></div>
    <label className="admin-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="جست‌وجو بر اساس نام، ایمیل یا شناسه..."/></label>
    {loading?<div className="admin-empty">در حال دریافت کاربران...</div>:filtered.length===0?<div className="admin-empty"><Users size={28}/><strong>کاربری پیدا نشد</strong></div>:<div className="admin-user-list">{filtered.map(user=>{
      const selected=drafts[user.id]??[];
      const changed=JSON.stringify([...selected].sort())!==JSON.stringify([...(user.role_codes??[])].sort());
      return <article className="admin-user-card" key={user.id}>
       <div className="admin-user-head"><div className="admin-user-avatar"><Users size={19}/></div><div className="admin-user-info"><strong>{user.full_name||"بدون نام ثبت‌شده"}</strong><span>{user.email||"بدون ایمیل"}</span><small>وضعیت حساب: {statusLabel(user.account_status)}</small></div></div>
       <div className="admin-role-label"><Building2 size={15}/> نوع فعالیت و نقش‌های عمومی</div>
       <div className="admin-role-options">{roleOptions.map(role=><label key={role.code} className={selected.includes(role.code)?"admin-role-option selected":"admin-role-option"}><input type="checkbox" checked={selected.includes(role.code)} onChange={()=>toggle(user.id,role.code)}/><span>{roleLabel(role.code)}</span>{selected.includes(role.code)&&<Check size={14}/>}</label>)}</div>
       <div className="admin-user-footer"><small>عضویت: {new Date(user.created_at).toLocaleDateString("fa-IR")}</small><div className="admin-user-actions">{user.account_status==="pending"&&<button className="primary-button" onClick={()=>void changeStatus(user,"active")} disabled={busyStatus===user.id}>{busyStatus===user.id?"در حال ثبت...":"تأیید و فعال‌سازی حساب"}</button>}{user.account_status==="active"&&<button className="danger-action" onClick={()=>void changeStatus(user,"suspended")} disabled={busyStatus===user.id}>تعلیق حساب</button>}{user.account_status==="suspended"&&<button onClick={()=>void changeStatus(user,"active")} disabled={busyStatus===user.id}>فعال‌سازی مجدد</button>}<button onClick={()=>void save(user)} disabled={!changed||busyUser===user.id}>{busyUser===user.id?"در حال ذخیره...":"ذخیره نقش‌ها"}</button></div></div>
      </article>;
    })}</div>}
   </section>
   <p className="admin-footnote">این نسخه فقط مدیریت نقش‌های عمومی و مشاهده حساب‌ها را فعال می‌کند. سطح دسترسی‌های جزئی سازمانی، تعلیق حساب و حذف امن در مرحله بعد و پس از تکمیل سیاست‌های دسترسی و آزمون امنیتی اضافه می‌شوند.</p>
   <MarketplaceAdminReviewWorkspace />
  </div>
 </main>;
}
