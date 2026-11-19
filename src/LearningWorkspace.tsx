import {useEffect,useMemo,useState} from "react";
import type {Session} from "@supabase/supabase-js";
import {Bookmark,BookOpen,CheckCircle2,Clock3,GraduationCap,Search,Star,ArrowRight,Leaf} from "lucide-react";
import {supabase} from "./lib/supabase";

type Localized={language_code:string;title:string;summary:string|null;body:string|null};
type CategoryLocale={language_code:string;name:string};
type Content={id:string;content_type:string;difficulty_level:string|null;estimated_duration_minutes:number|null;category_id:string|null;published_at:string|null;educational_content_localizations:Localized[];educational_categories:{id:string;code:string;educational_category_localizations:CategoryLocale[]} | null};
const languageOrder=["fa","ar","en"];
const chooseLocale=<T extends {language_code:string}>(rows:T[]|null|undefined,language:string)=>rows?.find(x=>x.language_code===language)||rows?.find(x=>languageOrder.includes(x.language_code))||rows?.[0];
const typeLabel:Record<string,string>={article:"مقاله",video:"ویدئو",course:"دوره آموزشی",podcast:"پادکست",guide:"راهنما"};
const levelLabel:Record<string,string>={beginner:"مقدماتی",intermediate:"متوسط",advanced:"پیشرفته"};

export default function LearningWorkspace({session}:{session:Session}){
 const[items,setItems]=useState<Content[]>([]),[bookmarks,setBookmarks]=useState<string[]>([]),[profileId,setProfileId]=useState<string|null>(null);
 const[selected,setSelected]=useState<Content|null>(null),[query,setQuery]=useState(""),[language,setLanguage]=useState("fa");
 const[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState("");
 useEffect(()=>{let alive=true;(async()=>{
  if(!supabase)return;
  setLoading(true);setError("");
  try{
   const client=supabase as any;
   const[{data:profile,error:profileError},{data:contents,error:contentsError}]=await Promise.all([
    client.from("users").select("id,preferred_language").eq("auth_user_id",session.user.id).maybeSingle(),
    client.from("educational_contents").select("id,content_type,difficulty_level,estimated_duration_minutes,category_id,published_at,educational_content_localizations(language_code,title,summary,body),educational_categories(id,code,educational_category_localizations(language_code,name))").eq("status","published").order("published_at",{ascending:false})
   ]);
   if(profileError)throw profileError;if(contentsError)throw contentsError;
   if(!alive)return;
   const lang=profile?.preferred_language||"fa";setLanguage(lang);
   setProfileId(profile?.id||null);setItems((contents||[]) as Content[]);
   if(profile?.id){const{data:marks,error:marksError}=await client.from("user_content_bookmarks").select("content_id").eq("user_id",profile.id);if(marksError)throw marksError;if(alive)setBookmarks((marks||[]).map((x:any)=>x.content_id));}
  }catch(e){if(alive)setError(e instanceof Error?e.message:"بارگذاری محتوای آموزشی انجام نشد.");}
  finally{if(alive)setLoading(false);}
 })();return()=>{alive=false;};},[session.user.id]);
 const visible=useMemo(()=>items.filter(item=>{const loc=chooseLocale(item.educational_content_localizations,language);const cat=chooseLocale(item.educational_categories?.educational_category_localizations,language);return [loc?.title,loc?.summary,cat?.name,typeLabel[item.content_type]].filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase());}),[items,query,language]);
 async function toggleBookmark(item:Content){if(!supabase||!profileId)return;setSaving(true);setError("");const client=supabase as any;const exists=bookmarks.includes(item.id);const result=exists?await client.from("user_content_bookmarks").delete().eq("user_id",profileId).eq("content_id",item.id):await client.from("user_content_bookmarks").insert({user_id:profileId,content_id:item.id});setSaving(false);if(result.error){setError(result.error.message);return;}setBookmarks(old=>exists?old.filter(id=>id!==item.id):[...old,item.id]);}
 async function markComplete(item:Content){if(!supabase||!profileId)return;setSaving(true);setError("");const client=supabase as any;const{error}=await client.from("user_content_progress").upsert({user_id:profileId,content_id:item.id,lesson_id:null,progress_percent:100,completed_at:new Date().toISOString(),last_accessed_at:new Date().toISOString()},{onConflict:"user_id,content_id,lesson_id"});setSaving(false);if(error){setError(error.message);return;}setError("این آموزش به‌عنوان تکمیل‌شده ثبت شد.");}
 const locale=(item:Content)=>chooseLocale(item.educational_content_localizations,language);
 if(selected){const loc=locale(selected);return <section className="learning-workspace"><button className="learning-back" onClick={()=>setSelected(null)}><ArrowRight size={17}/> بازگشت به فهرست آموزش‌ها</button><article className="learning-detail"><span className="learning-kicker"><BookOpen size={16}/> {typeLabel[selected.content_type]||"محتوای آموزشی"}</span><h1>{loc?.title||"عنوان آموزش"}</h1><p className="learning-summary">{loc?.summary||"خلاصه‌ای برای این آموزش ثبت نشده است."}</p><div className="learning-body">{loc?.body?loc.body.split(/\n{2,}/).map((paragraph,i)=><p key={i}>{paragraph}</p>):<p>متن این آموزش هنوز آماده انتشار نیست.</p>}</div><div className="learning-actions"><button className="learning-primary" disabled={saving||!profileId} onClick={()=>markComplete(selected)}><CheckCircle2 size={17}/> ثبت به‌عنوان مطالعه‌شده</button><button className="learning-secondary" disabled={saving||!profileId} onClick={()=>toggleBookmark(selected)}><Bookmark size={17} fill={bookmarks.includes(selected.id)?"currentColor":"none"}/>{bookmarks.includes(selected.id)?"حذف از نشانک‌ها":"ذخیره آموزش"}</button></div></article></section>;}
 return <section className="learning-workspace"><div className="learning-heading"><div><span className="eyebrow">یادگیری پیوسته و کاربردی</span><h1>آموزش و راهنمای کشاورزی</h1><p>دانش کاربردی، متناسب با زبان و نیاز کشاورزان.</p></div><div className="learning-mark"><GraduationCap size={28}/></div></div>
 <div className="learning-highlight"><div><span>دانش، سرمایه هر مزرعه</span><h2>هر روز یک قدم به کشاورزی آگاهانه‌تر</h2><p>مقاله‌ها، راهنماها و دوره‌های منتشرشده را دنبال کن و مسیر یادگیری‌ات را نگه دار.</p></div><Leaf size={46}/></div>
 <div className="learning-toolbar"><div className="search-box"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="جست‌وجوی عنوان یا موضوع آموزش..."/></div><div className="learning-language">{["fa","ar","en"].map(code=><button key={code} className={language===code?"active":""} onClick={()=>setLanguage(code)}>{code.toUpperCase()}</button>)}</div></div>
 {error&&<div className="notice">{error}</div>}
 {loading?<div className="empty-state">در حال دریافت آموزش‌های منتشرشده...</div>:visible.length===0?<div className="empty-state"><BookOpen size={34}/><strong>{items.length?"آموزشی با این عبارت پیدا نشد":"کتابخانه آموزشی سارینا در حال آماده‌سازی است"}</strong><p>{items.length?"عبارت جست‌وجو را تغییر بده.":"به‌محض انتشار محتوای تأییدشده، آموزش‌های فارسی و عربی در همین بخش نمایش داده می‌شوند. محتوای پیش‌نویس برای کاربران قابل مشاهده نیست."}</p></div>:<div className="learning-grid">{visible.map(item=>{const loc=locale(item),cat=chooseLocale(item.educational_categories?.educational_category_localizations,language);return <article className="learning-card" key={item.id}><div className="learning-card-top"><span>{typeLabel[item.content_type]||item.content_type}</span><button disabled={saving||!profileId} onClick={()=>toggleBookmark(item)} aria-label="ذخیره آموزش"><Bookmark size={17} fill={bookmarks.includes(item.id)?"currentColor":"none"}/></button></div><h3>{loc?.title||"عنوان آموزش"}</h3><p>{loc?.summary||"برای مشاهده جزئیات این آموزش وارد شوید."}</p><div className="learning-meta">{cat?.name&&<span>{cat.name}</span>}{item.estimated_duration_minutes&&<span><Clock3 size={13}/>{item.estimated_duration_minutes} دقیقه</span>}{item.difficulty_level&&<span><Star size={13}/>{levelLabel[item.difficulty_level]||item.difficulty_level}</span>}</div><button className="learning-open" onClick={()=>setSelected(item)}>مطالعه آموزش <ArrowRight size={15}/></button></article>;})}</div>}
 </section>;
}
