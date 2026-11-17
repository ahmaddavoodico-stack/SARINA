import {CalendarDays,Gift,Leaf,MessageCircle,ShieldCheck,Sparkles} from "lucide-react";

type GreenCreditCardProps={onShop:()=>void};

export default function GreenCreditCard({onShop}:GreenCreditCardProps){
  // Illustrative values only. Live balances must come from a future authenticated
  // credit ledger; never treat these preview values as a farmer's real balance.
  const remaining=720;
  const base=1000;
  const used=base-remaining;
  const percent=Math.round((remaining/base)*100);

  return <section className="green-credit" aria-labelledby="green-credit-title" dir="rtl">
    <div className="green-credit-top">
      <div className="green-credit-brand">
        <span className="green-credit-mark"><Leaf size={22}/></span>
        <div><span className="green-credit-kicker">همراه هوشمند مزرعه</span><h2 id="green-credit-title">اعتبار سبز من</h2></div>
      </div>
      <span className="green-credit-preview"><Sparkles size={13}/> پیش‌نمایش</span>
    </div>

    <div className="green-credit-main">
      <div className="green-credit-balance">
        <span>اعتبار باقی‌مانده این ماه</span>
        <strong>{remaining.toLocaleString("fa-IR")} <small>واحد</small></strong>
        <span className="green-credit-renew"><CalendarDays size={14}/> تمدید در ۱۲ روز آینده</span>
      </div>
      <div className="green-credit-ring" role="img" aria-label={percent+" درصد اعتبار باقی‌مانده"}>
        <div><strong>{percent.toLocaleString("fa-IR")}٪</strong><span>باقی‌مانده</span></div>
      </div>
    </div>

    <div className="green-credit-progress" aria-label="میزان اعتبار باقی‌مانده">
      <div style={{width:percent+"%"}}/>
    </div>
    <div className="green-credit-progress-labels">
      <span>مصرف‌شده: {used.toLocaleString("fa-IR")} واحد</span>
      <span>اعتبار پایه: {base.toLocaleString("fa-IR")} واحد</span>
    </div>

    <div className="green-credit-stats">
      <div><MessageCircle size={19}/><span>گفت‌وگوهای این ماه</span><strong>۴۸</strong></div>
      <div><CalendarDays size={19}/><span>تا تمدید اعتبار</span><strong>۱۲ روز</strong></div>
    </div>

    <div className="green-credit-benefits">
      <div className="green-credit-free">
        <ShieldCheck size={22}/>
        <div><strong>اعتبار پایه رایگان</strong><span>دسترسی به راهنمایی هوشمند پایه</span></div>
      </div>
      <div className="green-credit-gift">
        <Gift size={23}/>
        <div><strong>اعتبار هدیه</strong><span>مثلاً +۲۰۰ واحد با خرید محصول منتخب</span></div>
      </div>
    </div>

    <div className="green-credit-shop">
      <div className="green-credit-shop-art"><SproutMark/></div>
      <div className="green-credit-shop-copy">
        <strong>با محصولات برند SARINA، اعتبار هدیه بگیر</strong>
        <span>مقدار هدیه و شرایط آن پیش از خرید شفاف نمایش داده می‌شود.</span>
        <button type="button" onClick={onShop}>مشاهده محصولات <span aria-hidden="true">←</span></button>
      </div>
    </div>
    <p className="green-credit-note">اعداد این کارت نمایشی‌اند؛ اعتبار واقعی پس از اتصال سامانه اعتبار و ثبت مصرف نمایش داده می‌شود. خرید محصول برای دریافت اعتبار پایه رایگان الزامی نیست.</p>
  </section>;
}

function SproutMark(){return <div className="green-credit-sprout"><SproutIcon/><span>SARINA</span></div>;}
function SproutIcon(){return <Leaf size={34}/>;}
