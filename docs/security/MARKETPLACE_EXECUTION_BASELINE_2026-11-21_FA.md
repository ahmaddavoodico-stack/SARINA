# مبنای اجرایی مرحله صفر بازارگاه SARINA
تاریخ snapshot: 2026-11-21
نوع بررسی: فقط‌خواندنی؛ هیچ تغییری در Supabase اعمال نشده است.

## 1. مبنای کد و شاخه‌ها
- شاخه `main` در زمان بررسی روی commit `6e0e95ddc843b2fad42ee4abca554e4de5658872` قرار داشت.
- شاخه پیش‌فرض مخزن `feature/farmer-portal-foundation` است؛ نسبت به `main` واگرا و 1 commit جلو / 135 commit عقب است. بنابراین آن را بدون تصمیم جداگانه، مبنای ادغام یا انتشار بازارگاه فرض نمی‌کنیم.
- شاخه قدیمی `integration/marketplace-and-communications-workspace` نسبت به `main`، 37 commit جلو و 70 commit عقب است؛ انتقال مستقیم یا merge کامل آن توصیه نمی‌شود.
- PR #84 برای اولین workspace بازارگاه بر پایه `main` ساخته شده و فقط کاتالوگ خواندنی را اضافه می‌کند.

## 2. وضعیت schema و migrationهای زنده
پروژه Supabase: `wwgkiclcpgpdktneovrx`، PostgreSQL `17.11.0.019`.

Snapshot فعلی:
- 19 جدول با پیشوند `marketplace_` وجود دارد و RLS روی هر 19 جدول فعال است.
- 14 دسته‌بندی فعال وجود دارد.
- در زمان بررسی: فروشنده، محصول، سبد، سفارش، درخواست قیمت و درخواست تغییر فروشنده همگی صفر رکورد داشتند.
- هیچ migration یا داده‌ای در این مرحله تغییر نکرد.

Migration history زنده شامل این گروه‌هاست:
- 019 تا 027: هسته بازارگاه، policy hardening، quote workflow، compliance/reservations، performance، organization membership، seller verification و column privilege hardening.
- 035 تا 042: individual sellers/change requests، approval workflow، sales intelligence، external links، farm-planner linkage و trade planning/price intelligence.

وضعیت منبع کد:
- فایل‌های migration مربوط به 019 تا 027 در شاخه قدیمی integration مشاهده شدند؛ فایل‌های متناظر در snapshot شاخه `main` پیدا نشدند.
- فایل‌های migration مربوط به 035 تا 042 در شاخه `main`، شاخه پیش‌فرض و شاخه قدیمی integration بررسی‌شده پیدا نشدند؛ migration history زنده آن‌ها را ثبت کرده است.
- بنابراین schema زنده و تاریخچه migration، از نظر اجرا با Git هماهنگ‌تر از آن چیزی است که در شاخه‌های فعلی می‌توان از روی فایل‌های SQL بازسازی کرد؛ اما source-of-truth قابل بازتولید هنوز کامل نیست.
- فایل migration جدید یا migration ساختگی برای جبران این فاصله نباید ساخته یا اجرا شود. ابتدا باید منبع اصلی بازیابی شود یا یک schema snapshot مستند و قابل بازبینی تولید گردد که صریحاً «بازسازی‌شده از وضعیت زنده» باشد، نه migration اصلی تاریخی.

## 3. یافته‌های دسترسی بازارگاه
### کنترل‌های مثبت
- RLS روی همه 19 جدول بازارگاه فعال است.
- خواندن دسته‌بندی‌ها به دسته فعال محدود شده است.
- خواندن محصولات از مسیر policy به محصولات منتشرشده فروشنده تأییدشده یا محصول متعلق به خود فروشنده محدود شده است.
- ایجاد فروشنده فقط در وضعیت pending مجاز است؛ فروشنده شرکتی به عضویت سازمانی فعال وابسته است.
- RPCهای بررسی‌شده برای سفارش، quote، لغو سفارش و تغییر فروشنده برای anon قابل اجرا نبودند و برای authenticated قابل اجرا بودند؛ بدنه توابع نیز کنترل auth/profile و در مسیرهای مدیریتی کنترل مالکیت/نقش مدیر دارد.

### یافته بحرانی: TRUNCATE
مجوز سطح جدول `TRUNCATE` برای هر دو نقش `anon` و `authenticated` روی این 8 جدول مشاهده شد:
- `marketplace_cart_items`
- `marketplace_categories`
- `marketplace_order_items`
- `marketplace_orders`
- `marketplace_products`
- `marketplace_quote_requests`
- `marketplace_sellers`
- `marketplace_shipments`

RLS ردیفی، مجوز TRUNCATE را محدود نمی‌کند. این مورد باید پیش از فعال‌سازی هر مسیر نوشتن یا checkout با حداقل‌سازی مجوزها اصلاح شود. با این حال، هیچ REVOKE یا GRANT در این snapshot اجرا نشده است؛ ابتدا باید grantor/منشأ ACL، مصرف‌کنندگان و سیاست موردنیاز هر جدول مشخص شوند.

### جدول بدون policy
`marketplace_seller_change_requests` دارای RLS فعال ولی بدون policy مستقیم است. گردش‌های فعلی از RPCهای SECURITY DEFINER استفاده می‌کنند که باید به‌صورت مستقل آزمون شوند؛ افزودن policy عمومی برای رفع هشدار Advisor راه‌حل قابل قبول نیست.

## 4. هشدارهای عمومی Security Advisor
در snapshot فعلی:
- 17 جدول RLS-enabled بدون policy گزارش شده‌اند؛ یکی از آن‌ها `marketplace_seller_change_requests` است.
- `public.spatial_ref_sys` با RLS خاموش گزارش شده است.
- سه overload از `public.st_estimatedextent` به‌عنوان SECURITY DEFINER قابل اجرا برای anon گزارش شده‌اند.
- 19 تابع SECURITY DEFINER قابل اجرا برای authenticated گزارش شده‌اند؛ از جمله چند RPC بازارگاه.
- غیرفعال بودن Leaked Password Protection نیز در snapshot ممیزی قبلی ثبت شده است.

این هشدارها به‌تنهایی اثبات سوءاستفاده یا افشای داده نیستند؛ اما قبل از بهره‌برداری تجاری باید هر تابع و مجوز با سناریوهای واقعی آزموده شود. برای PostGIS نیز فعال‌کردن RLS بدون بررسی وابستگی‌ها و رفتار extension انجام نشود.

## 5. معیارهای عبور از مرحله صفر
1. بازیابی یا مستندسازی منبع حقیقت migrationهای 019–027 و 035–042؛ همراه با ترتیب، checksum و provenance.
2. ثبت schema snapshot از وضعیت زنده و مقایسه آن با فایل‌های Git؛ بدون اعمال DDL.
3. تهیه ماتریس مجوز کمینه برای هر جدول و نقش؛ بررسی جداگانه ACL مستقیم، inherited و column-level grants.
4. طراحی remediation مستقل برای TRUNCATE و سایر مجوزهای غیرضروری؛ اجرای آن فقط پس از بازبینی و تأیید.
5. آزمون نقش‌ها: anon، authenticated buyer، seller owner، سازمان عضو، admin و service_role؛ شامل SELECT/INSERT/UPDATE/DELETE/TRUNCATE و اجرای RPC.
6. بازبینی بدنه، search_path، مالکیت، authorization و EXECUTE grants همه توابع SECURITY DEFINER بازارگاه.
7. تنها پس از عبور از این gate، اتصال سبد، استعلام قیمت، ثبت سفارش و پنل مدیریت آغاز شود.

## 6. مرز تغییرات
- این سند فقط snapshot و معیارهای اجرایی را ثبت می‌کند.
- هیچ schema، migration، row، grant، policy، function، bucket یا تنظیم Supabase تغییر نکرده است.
- PR #84 فقط کاتالوگ خواندنی را اضافه می‌کند و هیچ مسیر سفارش/پرداختی را فعال نمی‌کند.
- ادغام PRها یا اجرای remediation روی پروژه زنده منوط به بازبینی و تأیید صریح است.
