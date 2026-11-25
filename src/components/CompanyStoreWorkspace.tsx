import {useCallback,useEffect,useState} from "react";
import type {Session} from "@supabase/supabase-js";
import {Building2,RefreshCw,Store} from "lucide-react";
import {supabase} from "../lib/supabase";
import SpecialistStoreWorkspace from "./SpecialistStoreWorkspace";

type Organization={organization_id:string;display_name:string};
const db=supabase as any;

export default function CompanyStoreWorkspace({session}:{session:Session}){
 const[userId,setUserId]=useState("");
 const[organizations,setOrganizations]=useState<Organization[]>([]);
 const[selectedOrganization,setSelectedOrganization]=useState("");
 const[loading,setLoading]=useState(true);
 const[error,setError]=useState("");

 const load=useCallback(async()=>{
  if(!supabase){setError("اتصال پایگاه داده در این محیط پیکربندی نشده است.");setLoading(false);return;}
  setLoading(true);setError("");
  try{
   const [profile,orgs]=await Promise.all([
    db.from("users").select("id").eq("auth_user_id",session.user.id).maybeSingle(),
    db.rpc("list_my_marketplace_organizations")
   ]);
   if(profile.error)throw profile.error;
   if(orgs.error)throw orgs.error;
   if(!profile.data?.id)throw new Error("پروفایل کاربری SARINA پیدا نشد.");
   const available=(orgs.data||[]) as Organization[];
   setUserId(profile.data.id);setOrganizations(available);
   setSelectedOrganization(current=>available.some(o=>o.organization_id===current)?current:(available[0]?.organization_id||""));
  }catch(e){setError(e instanceof Error?e.message:"دریافت سازمان‌های مجاز انجام نشد.");}
  finally{setLoading(false);}
 },[session.user.id]);

 useEffect(()=>{void load();},[load]);

 if(loading)return <section className="specialist-store"><div className="specialist-store-empty">در حال بررسی دسترسی سازمانی...</div></section>;
 if(error)return <section className="specialist-store"><div className="specialist-store-empty"><Building2 size={30}/><strong>دریافت فروشگاه سازمانی انجام نشد</strong><p>{error}</p><button type="button" onClick={()=>void load()}><RefreshCw size={15}/> تلاش دوباره</button></div></section>;
 if(!organizations.length)return <section className="specialist-store"><div className="specialist-store-empty"><Building2 size={32}/><h2>فروشگاه سازمانی</h2><p>هنوز سازمان تأییدشده‌ای با عضویت فعال برای این حساب پیدا نشد. پس از تأیید سازمان و فعال‌شدن عضویت، می‌توانید محصولات و نهاده‌های آن را در بازارگاه SARINA عرضه کنید.</p><button type="button" onClick={()=>void load()}><RefreshCw size={15}/> بررسی دوباره</button></div></section>;

 return <section className="company-store-workspace" dir="rtl">
  <header className="company-store-heading"><div><span>عرضه محصولات و نهاده‌های سازمان</span><h2><Store size={22}/> فروشگاه سازمانی</h2><p>فروشگاه فقط برای سازمان‌هایی فعال است که عضویت شما در آن‌ها تأیید شده باشد.</p></div><button type="button" onClick={()=>void load()}><RefreshCw size={15}/> به‌روزرسانی</button></header>
  <label className="company-store-org-select">انتخاب سازمان فعال<select value={selectedOrganization} onChange={e=>setSelectedOrganization(e.target.value)}>{organizations.map(o=><option key={o.organization_id} value={o.organization_id}>{o.display_name}</option>)}</select></label>
  {selectedOrganization&&<SpecialistStoreWorkspace userId={userId} enabled={true} sellerType="company" organizationId={selectedOrganization}/>}
 </section>;
}
