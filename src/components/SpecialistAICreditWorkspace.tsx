import {AlertCircle,ArrowUpRight,Clock3,CreditCard,History,Sparkles,Wallet} from "lucide-react";

export default function SpecialistAICreditWorkspace(){
 return <section className="specialist-ai-credit" dir="rtl">
  <header className="specialist-ai-credit-heading"><div><span>مدیریت مصرف ابزارهای هوشمند</span><h2><Sparkles size={22}/> اعتبار دستیار هوش مصنوعی</h2><p>موجودی و مصرف خدمات AI باید مستقل از اعتبار سبز حرفه‌ای و درآمد قراردادها مدیریت شود.</p></div><span className="specialist-ai-credit-status">در حال راه‌اندازی</span></header>
  <div className="specialist-ai-credit-stats">
   <article><small>موجودی قابل استفاده</small><strong>قابل دریافت نیست</strong><span>دفترکل اختصاصی AI هنوز متصل نشده است</span></article>
   <article><small>مصرف دوره جاری</small><strong>قابل دریافت نیست</strong><span>گزارش مصرف متخصص هنوز به حساب اعتبار متصل نیست</span></article>
   <article><small>اعتبار هدیه و خریداری‌شده</small><strong>قابل دریافت نیست</strong><span>تفکیک حسابداری هنوز فعال نشده است</span></article>
  </div>
  <div className="specialist-ai-credit-actions">
   <article><CreditCard size={22}/><div><b>افزایش اعتبار AI</b><p>بسته‌های اعتبار پس از تعریف کاتالوگ، قیمت‌گذاری و اتصال پرداخت تأییدشده نمایش داده می‌شوند.</p><button type="button" disabled>افزایش اعتبار <ArrowUpRight size={15}/></button></div></article>
   <article><History size={22}/><div><b>تاریخچه مصرف و شارژ</b><p>سوابق شارژ، مصرف، آزادسازی رزرو و بازپرداخت پس از ایجاد دفترکل اختصاصی قابل مشاهده خواهد بود.</p><button type="button" disabled>مشاهده سوابق <Clock3 size={15}/></button></div></article>
  </div>
  <div className="specialist-ai-credit-warning"><AlertCircle size={18}/><div><b>برای حفظ دقت مالی، عدد تخمینی نمایش داده نمی‌شود.</b><p>دفترکل اعتبار سبز متخصص برای این منظور استفاده نمی‌شود. ابتدا باید حساب و دفترکل مستقل اعتبار AI، کنترل مصرف اتمیک و اتصال پرداخت امن تکمیل شود.</p></div></div>
  <p className="specialist-ai-credit-footnote"><Wallet size={15}/> اعتبار AI با اعتبار سبز متخصص و حق‌الزحمه قراردادها سه حساب مستقل است. شارژ خودکار نیز فقط با رضایت صریح متخصص و پس از آماده‌شدن زیرساخت فعال می‌شود.</p>
 </section>;
}
