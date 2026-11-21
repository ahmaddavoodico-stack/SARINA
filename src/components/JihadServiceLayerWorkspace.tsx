import {useMemo,useState} from "react";
import {Activity,ArrowLeft,Building2,CalendarClock,CheckCircle2,Clock3,FileText,Filter,MapPinned,MessageCircle,Search,ShieldCheck,Sprout,TrendingUp} from "lucide-react";

type Mode="organization"|"expert"|"farmer";
type DemoRequest={id:string;title:string;category:string;status:string;priority:"فوری"|"بالا"|"عادی";age:string;summary:string;next:string;owner:string;steps:string[]};
const demoRequests:DemoRequest[]=[
 {id:"DEMO-ABADAN-101",title:"درخواست بررسی تنش آبی نخلستان",category:"آب و آبیاری",status:"در انتظار بررسی کارشناس",priority:"فوری",age:"۲ روز",summary:"نمونه نمایشی برای بررسی نیاز آبی و امکان معرفی خدمت یا راهکار حمایتی؛ هیچ اطلاعات واقعی کشاورز در آن وجود ندارد.",next:"بررسی اولیه کارشناس آب و خاک و اعلام مدارک تکمیلی",owner:"کارشناس تخصصی آب و خاک",steps:["ثبت تقاضا در SARINA","بررسی اولیه و تکمیل اطلاعات","در انتظار بررسی کارشناس","اعلام نتیجه و قدم بعدی"]},
 {id:"DEMO-ABADAN-102",title:"پیگیری درخواست تسهیلات تجهیز آبیاری",category:"تسهیلات و حمایت",status:"در انتظار پاسخ مرجع",priority:"بالا",age:"۵ روز",summary:"سناریوی ساختگی برای نمایش اتصال وضعیت بیرونی سازمان به صفحه پیگیری کشاورز.",next:"دریافت رویداد وضعیت از سامانه مرجع یا ثبت به‌روزرسانی مجاز",owner:"واحد پاسخ‌گوی سازمان",steps:["ثبت درخواست","بررسی اولیه","ارسال به مرجع مسئول","در انتظار پاسخ مرجع"]},
 {id:"DEMO-ABADAN-103",title:"نیاز منطقه‌ای به پایش آفات خرما",category:"پایش و ترویج",status:"در حال جمع‌بندی منطقه‌ای",priority:"عادی",age:"۱ روز",summary:"نمونه تجمیعی و بی‌نام برای نمایش تحلیل نیازهای پرتکرار منطقه؛ پرونده فردی یا مزرعه واقعی نیست.",next:"تکمیل جمع‌بندی نیاز و پیشنهاد اقدام منطقه‌ای",owner:"کارشناس حفظ نباتات",steps:["ثبت نشانه‌های منطقه‌ای","تجمیع و تحلیل نیاز","پیشنهاد اقدام منطقه‌ای","اطلاع‌رسانی دستورالعمل"]},
];
const directives=[
 {title:"راهنمای مدیریت تنش گرمایی و آبی در نخیلات",issuer:"مرجع صادرکننده: نمونه نمایشی",version:"نسخه نمونه ۱.۰",scope:"نخیلات · مناطق گرم"},
 {title:"اصول پایش و گزارش آفات مهم خرما",issuer:"مرجع صادرکننده: نمونه نمایشی",version:"نسخه نمونه ۱.۲",scope:"حفظ نباتات · پایش مزرعه"}
];
const faNum=(v:number)=>v.toLocaleString("fa-IR");
export default function JihadServiceLayerWorkspace({mode}:{mode:Mode}){
 const [selected,setSelected]=useState(demoRequests[0].id);
 const [filter,setFilter]=useState("همه");
 const [query,setQuery]=useState("");
 const current=demoRequests.find(x=>x.id===selected)||demoRequests[0];
 const visible=useMemo(()=>demoRequests.filter(x=>(filter==="همه"||x.priority===filter)&&(!query||[x.title,x.category,x.id].join(" ").includes(query))),[filter,query]);
 const isOrg=mode==="organization",isExpert=mode==="expert";
 const title=isOrg?"داشبورد خدمات منطقه‌ای جهاد کشاورزی":isExpert?"خدمات و ارجاعات جهاد کشاورزی":"پیگیری خدمات جهاد کشاورزی";
 const description=isOrg?"پایش تقاضاهای کشاورزان، اولویت‌های منطقه و وضعیت پاسخ‌گویی؛ گردش کار داخلی سازمان در CRM خود سازمان باقی می‌ماند.":isExpert?"ارجاعات مرتبط با جهاد، دستورالعمل‌های معتبر و اقدام بعدی در کنار پرونده‌های تخصصی شما.":"درخواست‌های مرتبط با جهاد را در کنار سایر درخواست‌هایتان ببینید و بدانید اکنون چه مرحله‌ای هستند و قدم بعدی چیست.";
 return <section className="jihad-service-layer" dir="rtl">
  <style>{`
   .jihad-service-layer{color:#20392b;display:grid;gap:15px;font-family:inherit}
   .jihad-service-layer *{box-sizing:border-box}
   .jsl-hero{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:20px 22px;border:1px solid #dce9dc;border-radius:18px;background:linear-gradient(115deg,#f0f7ef,#fbf8ed)}
   .jsl-kicker{display:flex;align-items:center;gap:7px;color:#507b59;font-size:11px;font-weight:800}
   .jsl-hero h2{font-size:clamp(18px,2.5vw,24px);margin:8px 0;color:#1d442d}
   .jsl-hero p{font-size:12px;line-height:1.9;color:#66776a;margin:0;max-width:720px}
   .jsl-demo{white-space:nowrap;border:1px solid #ead6a9;background:#fff7e7;color:#8a6829;border-radius:999px;padding:7px 11px;font-size:10px;font-weight:800}
   .jsl-notice{display:flex;gap:9px;padding:11px 13px;border:1px solid #eadfbe;background:#fffaf0;color:#755c2c;border-radius:12px;font-size:11px;line-height:1.8}
   .jsl-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
   .jsl-stat{border:1px solid #e3ebe3;background:#fff;border-radius:14px;padding:13px}
   .jsl-stat small{display:block;color:#78877c;font-size:10px;margin-bottom:8px}
   .jsl-stat strong{font-size:22px;color:#285238}
   .jsl-stat em{display:block;color:#8a968d;font-size:9px;font-style:normal;margin-top:4px}
   .jsl-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(260px,.85fr);gap:12px}
   .jsl-panel{background:#fff;border:1px solid #e3eae3;border-radius:15px;padding:15px;min-width:0}
   .jsl-panel-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}
   .jsl-panel h3{font-size:14px;margin:0;color:#2b5037}
   .jsl-muted{font-size:10px;color:#829087}
   .jsl-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:11px}
   .jsl-search{display:flex;align-items:center;gap:7px;flex:1;min-width:150px;border:1px solid #e4eae4;border-radius:10px;padding:8px 10px;color:#859187}
   .jsl-search input{border:0;outline:0;width:100%;font:inherit;font-size:11px;background:transparent;color:#314638}
   .jsl-filter{border:1px solid #e4eae4;border-radius:10px;padding:8px 10px;background:#fff;color:#53675a;font:inherit;font-size:11px}
   .jsl-list{display:grid;gap:8px}
   .jsl-item{width:100%;text-align:right;border:1px solid #e7ede7;background:#fff;border-radius:12px;padding:11px;cursor:pointer;color:#314638;font:inherit}
   .jsl-item.active{border-color:#8db795;background:#f5faf5}
   .jsl-item-top{display:flex;justify-content:space-between;align-items:center;gap:7px}
   .jsl-item strong{font-size:12px;line-height:1.7}
   .jsl-item small{display:block;color:#849087;font-size:10px;margin-top:5px}
   .jsl-priority{font-size:9px;border-radius:99px;padding:4px 7px;background:#f5f1e7;color:#856a32;white-space:nowrap}
   .jsl-detail{border:1px solid #e5ece4;background:#f8faf7;border-radius:12px;padding:13px}
   .jsl-detail h4{font-size:13px;line-height:1.8;margin:8px 0;color:#254b33}
   .jsl-detail p{font-size:11px;line-height:1.9;color:#6c7c70;margin:7px 0}
   .jsl-row{display:flex;justify-content:space-between;gap:10px;border-top:1px solid #e5ece4;padding:8px 0;font-size:10px}
   .jsl-row span{color:#829087}.jsl-row b{text-align:left}
   .jsl-timeline{display:grid;gap:8px;margin-top:11px}
   .jsl-step{display:flex;gap:8px;align-items:center;font-size:10px;color:#5f7164}
   .jsl-step i{width:19px;height:19px;display:grid;place-items:center;border-radius:50%;background:#e8f1e7;color:#4c7956;font-style:normal;font-size:9px}
   .jsl-step.current{font-weight:800;color:#2b603a}
   .jsl-bottom{display:grid;grid-template-columns:1fr 1fr;gap:10px}
   .jsl-mini{border:1px solid #e5ece5;border-radius:12px;padding:12px;background:#fbfcfa}
   .jsl-mini b{display:block;font-size:11px;color:#34543d;margin:6px 0}
   .jsl-mini p{font-size:10px;color:#7b897f;line-height:1.8;margin:0}
   .jsl-cta{display:flex;gap:7px;align-items:center;color:#47744f;font-size:10px;font-weight:800;margin-top:10px}
   .jsl-empty{padding:20px;text-align:center;color:#829087;font-size:11px}
   @media(max-width:760px){.jsl-grid{grid-template-columns:1fr}.jsl-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
   @media(max-width:480px){.jsl-hero{display:block;padding:15px}.jsl-demo{display:inline-flex;margin-top:12px}.jsl-panel{padding:12px}.jsl-bottom{grid-template-columns:1fr}.jsl-stat strong{font-size:19px}}
  `}</style>
  <header className="jsl-hero"><div><span className="jsl-kicker"><Building2 size={15}/> SARINA · Jihad Agriculture Services</span><h2>{title}</h2><p>{description}</p></div><span className="jsl-demo">پیش‌نمایش غیرعملیاتی · آبادان</span></header>
  <div className="jsl-notice"><ShieldCheck size={16}/><div><b>داده‌های کاملاً نمایشی</b> · این نمونه برای طراحی تجربه پایلوت خوزستان/آبادان است. هیچ پرونده واقعی خوانده یا تغییر داده نمی‌شود، هیچ تقاضایی ارسال نمی‌شود و CRM سازمان متصل نیست.</div></div>
  <div className="jsl-stats">
   <article className="jsl-stat"><small>{isOrg?"تقاضاهای قابل پیگیری":isExpert?"ارجاعات نمونه مرتبط":"درخواست‌های نمونه جهاد"}</small><strong>{faNum(isOrg?24:isExpert?3:2)}</strong><em>عدد نمایشی</em></article>
   <article className="jsl-stat"><small>{isOrg?"نیازمند اقدام":isExpert?"نیازمند بررسی":"در انتظار پاسخ"}</small><strong>{faNum(isOrg?7:isExpert?2:1)}</strong><em>عدد نمایشی</em></article>
   <article className="jsl-stat"><small>{isOrg?"میانگین زمان پاسخ":isExpert?"اقدام‌های امروز":"آخرین به‌روزرسانی"}</small><strong>{isOrg?"۲٫۴":isExpert?"۲":"امروز"}</strong><em>{isOrg?"روز · نمونه":isExpert?"مورد · نمونه":"نمونه"}</em></article>
   <article className="jsl-stat"><small>{isOrg?"نیازهای پرتکرار منطقه":isExpert?"دستورالعمل‌های مرتبط":"مراجع پاسخ‌گو"}</small><strong>{faNum(isOrg?5:isExpert?2:3)}</strong><em>عدد نمایشی</em></article>
  </div>
  <div className="jsl-grid">
   <section className="jsl-panel">
    <div className="jsl-panel-head"><div><h3>{isOrg?"صندوق تقاضاهای منطقه":isExpert?"ارجاعات مرتبط با جهاد":"درخواست‌های مرتبط با جهاد"}</h3><span className="jsl-muted">{isOrg?"اولویت‌بندی، زمان انتظار و موضوع":isExpert?"فقط مأموریت‌های ارجاع‌شده به شما": "وضعیت، آخرین اقدام و قدم بعدی"}</span></div><Activity size={17} color="#5e8968"/></div>
    <div className="jsl-toolbar"><label className="jsl-search"><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="جست‌وجوی موضوع یا شناسه..."/></label><select className="jsl-filter" value={filter} onChange={e=>setFilter(e.target.value)}><option>همه</option><option>فوری</option><option>بالا</option><option>عادی</option></select></div>
    <div className="jsl-list">{visible.map(item=><button type="button" key={item.id} className={selected===item.id?"jsl-item active":"jsl-item"} onClick={()=>setSelected(item.id)}><div className="jsl-item-top"><strong>{item.title}</strong><span className="jsl-priority">{item.priority}</span></div><small>{item.id} · {item.category} · {item.age} پیش</small><small>وضعیت: {item.status}</small></button>)}{visible.length===0&&<div className="jsl-empty">موردی با این فیلتر پیدا نشد.</div>}</div>
   </section>
   <aside className="jsl-panel">
    <div className="jsl-panel-head"><h3>{isOrg?"نمای جزئیات و پیگیری":isExpert?"جزئیات مأموریت":"جزئیات درخواست انتخاب‌شده"}</h3><FileText size={17} color="#5e8968"/></div>
    <div className="jsl-detail"><span className="jsl-muted">{current.id}</span><h4>{current.title}</h4><p>{current.summary}</p><div className="jsl-row"><span>وضعیت</span><b>{current.status}</b></div><div className="jsl-row"><span>مسئول پاسخ‌گویی</span><b>{current.owner}</b></div><div className="jsl-row"><span>اقدام بعدی</span><b>{current.next}</b></div><div className="jsl-row"><span>زمان انتظار</span><b>{current.age}</b></div></div>
    <div className="jsl-timeline">{current.steps.map((step,i)=><div key={step} className={i===current.steps.length-1?"jsl-step current":"jsl-step"}><i>{i+1}</i>{step}</div>)}</div>
   </aside>
  </div>
  <div className="jsl-bottom">
   {isOrg?<><article className="jsl-mini"><MapPinned size={17}/><b>نیازهای پرتکرار منطقه آبادان</b><p>تنش آبی نخیلات، پایش آفات، بهبود بهره‌وری آب و دسترسی به خدمات حمایتی؛ نمونه‌های نمایشی و فاقد آمار واقعی.</p><span className="jsl-cta"><TrendingUp size={13}/> تحلیل نیاز و ظرفیت منطقه</span></article><article className="jsl-mini"><Building2 size={17}/><b>اتصال CRM سازمان</b><p>وضعیت: متصل نیست · در نسخه عملیاتی، اتصال اختیاری و از طریق Adapter مستقل و قرارداد داده نسخه‌دار انجام می‌شود.</p><span className="jsl-cta"><ShieldCheck size={13}/> گردش کار داخلی در CRM باقی می‌ماند</span></article></>:isExpert?<><article className="jsl-mini"><FileText size={17}/><b>دستورالعمل‌های مرتبط</b><p>{directives.map(x=>x.title).join(" · ")}</p><span className="jsl-cta"><ShieldCheck size={13}/> اعتبار و نسخه باید از مرجع صادرکننده تأیید شود</span></article><article className="jsl-mini"><CalendarClock size={17}/><b>ثبت اقدام کارشناسی</b><p>در نسخه عملیاتی، ثبت اقدام و نتیجه فقط در پرونده مجاز و با ثبت زمان و مسئول انجام می‌شود.</p><span className="jsl-cta"><CheckCircle2 size={13}/> بدون ثبت نمایشی در این نسخه</span></article></>:<><article className="jsl-mini"><MessageCircle size={17}/><b>ارتباط و پیگیری</b><p>پیام‌ها و پاسخ‌ها در پرونده همان درخواست ثبت می‌شوند؛ مسیر مکالمه متخصص در SARINA حفظ می‌شود.</p><span className="jsl-cta"><ArrowLeft size={13}/> مشاهده قدم بعدی از همین صفحه</span></article><article className="jsl-mini"><Sprout size={17}/><b>دستورالعمل‌های کشاورزی</b><p>راهنماهای رسمی با تاریخ اعتبار، مرجع صادرکننده و منطقه کاربرد در دسترس قرار می‌گیرند.</p><span className="jsl-cta"><ShieldCheck size={13}/> فقط نسخه معتبر و تأییدشده</span></article></>}
  </div>
 </section>;
}
