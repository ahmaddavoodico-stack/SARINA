import {Award,Box,ClipboardCheck,Globe2,PackageCheck,Search,ShieldCheck,TrendingUp,Truck} from "lucide-react";

const modules=[
  {icon:Search,title:"تحقیقات و فرصت‌های بازار",en:"Market Research",description:"شناخت تقاضا، روند قیمت، کشورهای واردکننده، رقبا و فرصت‌های فروش هر محصول."},
  {icon:Globe2,title:"بازارها و خریداران جهانی",en:"Global Markets & Buyers",description:"بررسی بازارهای هدف، واردکنندگان، عمده‌فروشان و مسیرهای معتبر دسترسی به خریداران."},
  {icon:ShieldCheck,title:"استانداردها و الزامات",en:"Standards & Compliance",description:"استاندارد کیفیت، ایمنی غذایی، حدود باقی‌مانده سموم، ردیابی و الزامات کشور مقصد."},
  {icon:Box,title:"هوشمندی بسته‌بندی",en:"Packaging Intelligence",description:"انتخاب جنس، اندازه، وزن، لیبل، ماندگاری و بسته‌بندی متناسب با محصول و حمل‌ونقل."},
  {icon:ClipboardCheck,title:"مجوزها و گواهی‌ها",en:"Permits & Certifications",description:"فهرست مجوزهای داخلی، گواهی‌های بهداشتی و قرنطینه‌ای، اسناد گمرکی و مدارک مقصد."},
  {icon:Truck,title:"آمادگی صادرات و تجارت",en:"Export Readiness",description:"ارزیابی مرحله‌به‌مرحله آمادگی محصول، زنجیره سرد، لجستیک، هزینه‌ها و ریسک تجارت."},
];

export default function MarketIntelligenceWorkspace(){
  return <section dir="rtl" style={{display:"grid",gap:22}}>
    <header className="page-heading">
      <span className="eyebrow">SARINA · Market Intelligence</span>
      <h1>هوشمندی بازار و تجارت جهانی</h1>
      <p>از شناخت بازار و خریدار تا استاندارد، بسته‌بندی، مجوز و آماده‌سازی محصول برای فروش داخلی و جهانی؛ همراه کشاورز در مسیر رسیدن محصول به بازار.</p>
    </header>

    <article className="panel" style={{padding:24,background:"linear-gradient(135deg,#f0f8ef 0%,#fbf8ee 100%)",border:"1px solid #dcebd9"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,color:"#2d6a42",fontWeight:700}}><Globe2 size={22}/> از مزرعه تا بازار جهانی</div>
      <h2 style={{fontSize:24,margin:"12px 0 8px",color:"#244d35"}}>محصول خوب، با مسیر درست به دست خریدار می‌رسد.</h2>
      <p style={{lineHeight:1.9,maxWidth:780,margin:0,color:"#45624d"}}>SARINA اطلاعات بازار، مقررات رسمی و الزامات تجاری را کنار هم قرار می‌دهد تا کشاورز بداند برای فروش محصولش چه فرصت‌هایی وجود دارد و چه اقداماتی باید انجام دهد.</p>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:18}}>
        {["بازار داخلی و جهانی","منابع رسمی و قابل ردیابی","تأیید انسانی پیش از انتشار"].map(x=><span key={x} style={{padding:"7px 11px",borderRadius:20,background:"#ffffffc9",color:"#356447",fontSize:12}}>{x}</span>)}
      </div>
    </article>

    <div>
      <div className="section-title"><div><span className="eyebrow">حوزه‌های خدمت</span><h2>چه کمکی به کشاورز می‌کنیم؟</h2></div></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,250px),1fr))",gap:14}}>
        {modules.map(({icon:Icon,title,en,description})=><article className="panel" key={en} style={{padding:18,minHeight:174}}>
          <span className="round-icon"><Icon size={21}/></span>
          <h3 style={{margin:"12px 0 4px"}}>{title}</h3>
          <small style={{color:"var(--muted,#718071)"}}>{en}</small>
          <p style={{lineHeight:1.8,marginBottom:0}}>{description}</p>
        </article>)}
      </div>
    </div>

    <article className="panel" style={{padding:20}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <span className="round-icon"><TrendingUp size={21}/></span>
        <div><span className="eyebrow">آزمایش نخست با Manus</span><h2 style={{margin:"3px 0"}}>ارزیابی آمادگی صادرات یک محصول</h2></div>
      </div>
      <p style={{lineHeight:1.9}}>در آزمون نخست، Manus یک گزارش مستند درباره بازار هدف، الزامات استاندارد و بهداشتی، بسته‌بندی، مجوزها، حمل‌ونقل و برآورد اقتصادی تهیه می‌کند. نتیجه فقط به‌صورت پیش‌نویس خصوصی در SARINA ذخیره می‌شود و تا بررسی انسانی، دانش تأییدشده یا توصیه اجرایی محسوب نمی‌شود.</p>
      <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"center",padding:13,borderRadius:12,background:"#f6f8f5"}}>
        <Award size={19} color="#64804f"/>
        <strong>وضعیت آزمون:</strong>
        <span style={{color:"#657565"}}>آماده تعریف مأموریت · هنوز گزارشی ثبت نشده است</span>
      </div>
    </article>

    <div className="notice" role="note" style={{lineHeight:1.9}}>
      <strong>اصل اعتماد SARINA:</strong> هر ادعای مربوط به قانون، مجوز، استاندارد یا قیمت باید همراه منبع، تاریخ بررسی، کشور و محصول مرتبط باشد. الزامات اجباری از گواهی‌های داوطلبانه جدا می‌شوند و هیچ پیش‌نویسی بدون ارزیابی انسانی منتشر یا به دانش معتبر تبدیل نمی‌شود.
    </div>
  </section>;
}
