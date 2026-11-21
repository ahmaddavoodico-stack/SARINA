import {useMemo,useState} from "react";
import {Activity,ArrowUpLeft,Building2,Clock3,FileText,MapPinned,ShieldCheck,Users} from "lucide-react";

type Level="national"|"province"|"county"|"center";
type DemoCase={id:string;title:string;area:string;level:string;status:string;age:string;priority:"بالا"|"متوسط"|"عادی";summary:string;next:string};
const cases:DemoCase[]=[
 {id:"DEMO-ABADAN-001",title:"بررسی تنش آبی در مزارع نمونه آبادان",area:"پایلوت نمایشی: استان خوزستان / شهرستان آبادان",level:"شهرستان",status:"در انتظار بررسی استان",age:"۲ روز",priority:"بالا",summary:"سناریوی ساختگی برای آزمون جمع‌بندی شهرستان و ارجاع به سطح استان؛ فاقد اطلاعات کشاورز و مزرعه واقعی",next:"بررسی و اعلام نظر سازمان جهاد کشاورزی خوزستان"},
 {id:"DEMO-ABADAN-002",title:"درخواست پایش آفت در محصول نمونه",area:"پایلوت نمایشی: استان خوزستان / شهرستان آبادان",level:"مرکز خدمات",status:"در حال رسیدگی محلی",age:"۵ ساعت",priority:"متوسط",summary:"سناریوی ساختگی مرکز خدمات؛ نام و محدوده دقیق مرکز عمداً تعیین نشده تا فهرست رسمی تأیید شود",next:"ثبت جمع‌بندی کارشناس مرکز خدمات"},
 {id:"DEMO-ABADAN-003",title:"جمع‌بندی نیازهای نهاده‌ای فصل کشت",area:"پایلوت نمایشی: استان خوزستان / شهرستان آبادان",level:"شهرستان",status:"ارجاع‌شده به سطح استان",age:"۴ روز",priority:"عادی",summary:"گزارش فرضی و تجمیعی برای آزمون ارجاع رو به بالا؛ داده واقعی استفاده نشده است",next:"بررسی و تصمیم در سطح استان"},
 {id:"DEMO-ABADAN-004",title:"پیگیری خسارت ناشی از رخداد اقلیمی",area:"پایلوت نمایشی: استان خوزستان / شهرستان آبادان",level:"مرکز خدمات",status:"منتظر تکمیل اطلاعات",age:"۱ روز",priority:"متوسط",summary:"نمایش وضعیت انتظار اطلاعات تکمیلی از واحد محلی فرضی",next:"دریافت و اعتبارسنجی مستندات در مرکز خدمات"}
];
const levelLabels:Record<Level,string>={national:"ملی",province:"استان",county:"شهرستان",center:"مرکز خدمات / پهنه"};
const levelNotes:Record<Level,string>={
 national:"نمای کلان و شاخص‌های تجمیعی؛ بدون نمایش پرونده خام یا اطلاعات هویتی کشاورزان.",
 province:"پایلوت در سازمان جهاد کشاورزی استان خوزستان؛ تمرکز این مرحله بر پرونده‌های نمونه شهرستان آبادان است.",
 county:"پایلوت در مدیریت جهاد کشاورزی شهرستان آبادان؛ پیگیری پرونده‌ها و جمع‌بندی موضوعات محلی.",
 center:"میز کار اجرایی مراکز خدمات و کارشناسان آبادان؛ نام و مرز هر مرکز تا دریافت فهرست رسمی تأیید نمی‌شود."
};
const hierarchy:Record<Level,string[]>={national:["سطح ملی","استان‌ها","شهرستان‌ها","مراکز خدمات و پهنه‌ها"],province:["سازمان جهاد کشاورزی استان خوزستان","مدیریت جهاد کشاورزی شهرستان آبادان","مراکز خدمات و پهنه‌های آبادان (فهرست در انتظار تأیید)","کارشناسان دارای مأموریت مصوب"],county:["مدیریت جهاد کشاورزی شهرستان آبادان","مراکز خدمات تابعه (نام‌گذاری پس از تأیید رسمی)","پهنه‌های عملیاتی مصوب","کارشناسان دارای مأموریت در آبادان"],center:["مرکز خدمات منتخب پایلوت (پس از تأیید رسمی)","پهنه‌های تحت پوشش مصوب","کارشناسان مسئول","پرونده‌های جاری مجاز"]};
export default function JihadRegionalWorkspacePreview(){
 const[level,setLevel]=useState<Level>("province");
 const[selected,setSelected]=useState(cases[0].id);
 const[tab,setTab]=useState<"overview"|"referrals">("overview");
 const current=useMemo(()=>cases.find(item=>item.id===selected)??cases[0],[selected]);
 const visible=useMemo(()=>level==="national"?cases:level==="province"||level==="county"?cases:cases.filter(item=>item.level==="مرکز خدمات"),[level]);
 return <main className="jihad-preview" dir="rtl">
  <style>{`
   .jihad-preview{color:#20372b;max-width:1240px;margin:0 auto;padding:8px 0 32px;font-family:inherit}
   .jihad-preview *{box-sizing:border-box}
   .jihad-hero{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;background:linear-gradient(120deg,#f0f7ef,#fbf8ed);border:1px solid #dce9dc;border-radius:22px;padding:24px;margin-bottom:18px}
   .jihad-kicker{display:inline-flex;gap:7px;align-items:center;color:#4c7959;font-size:12px;font-weight:800}
   .jihad-hero h1{font-size:clamp(22px,3vw,30px);margin:10px 0 8px;color:#183c2a}
   .jihad-hero p{margin:0;color:#617466;line-height:1.9;max-width:680px;font-size:13px}
   .jihad-demo-tag{white-space:nowrap;background:#fff5df;color:#91661c;border:1px solid #ead6a9;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:800}
   .jihad-warning{display:flex;gap:10px;align-items:flex-start;background:#fff8e9;border:1px solid #efdfb8;color:#775a24;border-radius:14px;padding:13px 15px;margin-bottom:18px;font-size:12px;line-height:1.8}
   .jihad-levels{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:18px}
   .jihad-level{border:1px solid #e1e9e2;background:#fff;border-radius:14px;padding:13px;text-align:right;cursor:pointer;color:#53665a;display:flex;align-items:center;gap:9px;font:inherit;font-size:13px}
   .jihad-level.active{border-color:#76a783;background:#f1f8f1;color:#205936;box-shadow:0 0 0 2px #e0efe2}
   .jihad-level span{display:flex;width:28px;height:28px;align-items:center;justify-content:center;border-radius:9px;background:#edf3ed;font-size:12px;font-weight:800}
   .jihad-level.active span{background:#dceedd}
   .jihad-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px}
   .jihad-stat{background:#fff;border:1px solid #e4ebe4;border-radius:16px;padding:16px}
   .jihad-stat small{display:block;color:#78877c;font-size:11px;margin-bottom:9px}
   .jihad-stat strong{font-size:25px;color:#254b33}
   .jihad-stat em{display:block;font-style:normal;color:#89968d;font-size:10px;margin-top:5px}
   .jihad-layout{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(270px,.8fr);gap:14px}
   .jihad-panel{background:#fff;border:1px solid #e3eae3;border-radius:17px;padding:17px;min-width:0}
   .jihad-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
   .jihad-panel h2{font-size:16px;margin:0;color:#234631}
   .jihad-muted{font-size:11px;color:#849187}
   .jihad-tabs{display:flex;gap:7px;margin-bottom:13px}
   .jihad-tab{border:1px solid #e2e9e2;background:#fff;color:#68786c;border-radius:10px;padding:8px 12px;font:inherit;font-size:12px;cursor:pointer}
   .jihad-tab.active{background:#edf6ee;border-color:#c9dfcc;color:#285d38;font-weight:800}
   .jihad-case-list{display:grid;gap:9px}
   .jihad-case{width:100%;text-align:right;border:1px solid #e8eee8;background:#fff;border-radius:13px;padding:13px;cursor:pointer;font:inherit;color:#2a4031}
   .jihad-case.active{border-color:#8bb495;background:#f7fbf7}
   .jihad-case-top{display:flex;justify-content:space-between;gap:8px;align-items:center}
   .jihad-case strong{font-size:13px;line-height:1.7}
   .jihad-case small{font-size:10px;color:#7f8d82;display:block;margin-top:5px}
   .jihad-pill{font-size:10px;padding:4px 8px;border-radius:999px;background:#f3f3eb;color:#7c6c3d;white-space:nowrap}
   .jihad-priority{font-size:10px;color:#a05b3d;margin-top:8px;display:inline-block}
   .jihad-detail{background:#f8faf7;border:1px solid #e4ebe2;border-radius:13px;padding:14px}
   .jihad-detail h3{font-size:14px;margin:9px 0;color:#254b33;line-height:1.8}
   .jihad-detail p{font-size:12px;color:#6c7b70;line-height:1.9;margin:8px 0}
   .jihad-detail-row{display:flex;justify-content:space-between;gap:12px;border-top:1px solid #e5ece4;padding:9px 0;font-size:11px}
   .jihad-detail-row span:first-child{color:#879388}
   .jihad-hierarchy{display:grid;gap:8px}
   .jihad-hierarchy-item{display:flex;align-items:center;gap:10px;border:1px solid #e7eee7;background:#fbfcfa;border-radius:11px;padding:10px;font-size:12px;color:#526558}
   .jihad-hierarchy-item b{width:23px;height:23px;display:grid;place-items:center;background:#eaf2e9;color:#3e7048;border-radius:7px;font-size:10px}
   .jihad-flow{display:flex;align-items:center;justify-content:space-between;gap:6px;margin:14px 0;flex-wrap:wrap}
   .jihad-flow span{font-size:10px;background:#eef5ee;color:#41684a;padding:7px 9px;border-radius:9px}
   .jihad-foot{color:#849187;font-size:10px;line-height:1.8;margin-top:14px}
   @media(max-width:850px){.jihad-layout{grid-template-columns:1fr}.jihad-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
   @media(max-width:560px){.jihad-preview{padding:0 0 22px}.jihad-hero{padding:17px;display:block}.jihad-demo-tag{display:inline-flex;margin-top:14px}.jihad-levels{grid-template-columns:repeat(2,minmax(0,1fr))}.jihad-level{font-size:11px;padding:10px}.jihad-stats{gap:8px}.jihad-stat{padding:12px}.jihad-stat strong{font-size:21px}.jihad-panel{padding:13px}}
  `}</style>
  <section className="jihad-hero">
   <div><span className="jihad-kicker"><Building2 size={16}/> SARINA Institutional Operations Workspace</span><h1>فضای عملیات منطقه‌ای جهاد کشاورزی</h1><p>پایلوت منتخب: سازمان جهاد کشاورزی استان خوزستان و مدیریت جهاد کشاورزی شهرستان آبادان؛ از رسیدگی محلی تا جمع‌بندی استانی.</p></div>
   <span className="jihad-demo-tag">پیش‌نمایش غیرعملیاتی</span>
  </section>
  <div className="jihad-warning"><ShieldCheck size={19}/><div><b>محیط آزمایشی با داده ساختگی</b><br/>این صفحه فقط برای ارزیابی تجربه کاربری پایلوت خوزستان/آبادان است. تمام آمار و پرونده‌ها ساختگی‌اند؛ هیچ داده واقعی از کشاورزان یا سازمان‌ها خوانده یا تغییر داده نمی‌شود و هیچ ارجاعی ارسال نمی‌شود. نام مراکز خدمات و پهنه‌ها تا تأیید ساختار رسمی، قطعی نیست.</div></div>
  <div className="jihad-levels">{(["national","province","county","center"] as Level[]).map((item,index)=><button key={item} className={level===item?"jihad-level active":"jihad-level"} onClick={()=>setLevel(item)}><span>{index+1}</span>{levelLabels[item]}</button>)}</div>
  <div className="jihad-stats">
   <article className="jihad-stat"><small>پرونده‌های نمونه در این نما</small><strong>{visible.length.toLocaleString("fa-IR")}</strong><em>صرفاً داده ساختگی</em></article>
   <article className="jihad-stat"><small>نیازمند اقدام فوری</small><strong>۱</strong><em>شاخص نمایشی</em></article>
   <article className="jihad-stat"><small>در انتظار سطح بالاتر</small><strong>۲</strong><em>شاخص نمایشی</em></article>
   <article className="jihad-stat"><small>میانگین زمان انتظار</small><strong>۱٫۸</strong><em>روز · مقدار نمونه</em></article>
  </div>
  <div className="jihad-layout">
   <section className="jihad-panel">
    <div className="jihad-panel-head"><div><h2>میز کار و بسته‌های ارجاع</h2><span className="jihad-muted">سطح انتخاب‌شده: {levelLabels[level]}</span></div><Activity size={19} color="#5e8968"/></div>
    <div className="jihad-tabs"><button className={tab==="overview"?"jihad-tab active":"jihad-tab"} onClick={()=>setTab("overview")}>پرونده‌های نمونه</button><button className={tab==="referrals"?"jihad-tab active":"jihad-tab"} onClick={()=>setTab("referrals")}>مسیر ارجاع</button></div>
    {tab==="overview"?<div className="jihad-case-list">{visible.map(item=><button key={item.id} className={selected===item.id?"jihad-case active":"jihad-case"} onClick={()=>setSelected(item.id)}><div className="jihad-case-top"><strong>{item.title}</strong><span className="jihad-pill">{item.status}</span></div><small>{item.area} · انتظار: {item.age}</small><span className="jihad-priority">اولویت {item.priority}</span></button>)}</div>:<><div className="jihad-flow"><span>مرکز خدمات</span><ArrowUpLeft size={15}/><span>شهرستان</span><ArrowUpLeft size={15}/><span>استان</span><ArrowUpLeft size={15}/><span>ملی</span></div><div className="jihad-detail"><h3>بسته ارجاع نمونه</h3><p>خلاصه تأییدشده، علت ارجاع، سطح محرمانگی، مبنای مجوز/رضایت، مهلت پاسخ و فهرست شواهد مجاز در بسته قرار می‌گیرند.</p><div className="jihad-detail-row"><span>نوع ارجاع</span><b>برای بررسی و تصمیم</b></div><div className="jihad-detail-row"><span>انتقال مسئولیت</span><b>فقط پس از پذیرش مقصد</b></div><div className="jihad-detail-row"><span>ثبت رویداد</span><b>دریافت، پذیرش، پاسخ و بازگشت</b></div></div></>}
    <p className="jihad-foot">در نسخه عملیاتی، هر ردیف فقط با مجوز سمت سرور و در قلمرو مأموریت کاربر نمایش داده می‌شود. این پیش‌نمایش هیچ endpoint یا RPC را فراخوانی نمی‌کند.</p>
   </section>
   <aside className="jihad-panel">
    <div className="jihad-panel-head"><h2>ساختار قلمرو انتخاب‌شده</h2><MapPinned size={18} color="#5e8968"/></div>
    <div className="jihad-detail"><b>{levelLabels[level]}</b><p>{levelNotes[level]}</p></div>
    <div className="jihad-hierarchy" style={{marginTop:13}}>{hierarchy[level].map((item,index)=><div className="jihad-hierarchy-item" key={item}><b>{index+1}</b>{item}</div>)}</div>
    <div className="jihad-panel-head" style={{marginTop:18}}><h2>جزئیات پرونده انتخاب‌شده</h2><FileText size={18} color="#5e8968"/></div>
    <div className="jihad-detail"><span className="jihad-muted">{current.id}</span><h3>{current.title}</h3><p>{current.summary}</p><div className="jihad-detail-row"><span>محدوده نمونه</span><b>{current.area.replace("نمونه: ","")}</b></div><div className="jihad-detail-row"><span>وضعیت</span><b>{current.status}</b></div><div className="jihad-detail-row"><span>اقدام بعدی</span><b>{current.next}</b></div><div className="jihad-detail-row"><span>زمان انتظار</span><b>{current.age}</b></div></div>
    <div className="jihad-foot"><Users size={13} style={{verticalAlign:"middle",marginLeft:5}}/> اطلاعات هویتی و تماس در این نما وجود ندارد.</div>
   </aside>
  </div>
  <div className="jihad-foot"><Clock3 size={13} style={{verticalAlign:"middle",marginLeft:5}}/> طراحی نمایشی · بدون اتصال به پایگاه داده · بدون امکان ثبت یا ارجاع واقعی</div>
 </main>;
}
