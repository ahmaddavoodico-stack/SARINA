# برنامه اصلاح حداقل‌سازی مجوزهای بازارگاه SARINA
تاریخ snapshot: 2026-11-21
پروژه بررسی‌شده: `wwgkiclcpgpdktneovrx`، PostgreSQL 17.11
وضعیت: پیشنهاد اصلاح و آزمون؛ هیچ SQL تغییردهنده‌ای اجرا نشده است.

## 1. یافته قطعی: مجوزهای سطح جدول فراتر از نیاز
در snapshot زنده، برای هر دو نقش `anon` و `authenticated` روی این 8 جدول، مجوزهای `TRUNCATE`, `MAINTAIN`, `REFERENCES` و `TRIGGER` وجود دارد و grantor در ACL برابر `postgres` است:
- `marketplace_cart_items`
- `marketplace_categories`
- `marketplace_order_items`
- `marketplace_orders`
- `marketplace_products`
- `marketplace_quote_requests`
- `marketplace_sellers`
- `marketplace_shipments`

`has_table_privilege` نیز برای هر دو نقش روی هر 8 جدول، TRUNCATE را مؤثر گزارش می‌کند. RLS این مجوز را محدود نمی‌کند؛ پس این موضوع صرفاً هشدار Advisor نیست، بلکه مجوز مؤثر PostgreSQL است.

در همین snapshot، مجوزهای DML غیرضروری دیگری نیز وجود دارد:
- `anon`: دسترسی INSERT/UPDATE/DELETE سطح جدول روی برخی جداول مانند categories، products، quote requests، sellers، shipments و cart items؛ policyهای فعلی برای anon مسیر نوشتن مجاز تعریف نمی‌کنند، اما این grantها غیرضروری‌اند.
- `authenticated`: DML سطح جدول روی categories، quote requests و shipments بیش از policyهای فعلی است؛ مثلاً categories فقط policy خواندن دارد، quoteها از RPC ایجاد می‌شوند و shipmentها policy حذف ندارند.
- فروشنده و محصول به column-level grants محدود شده‌اند؛ این محدودیت باید حفظ شود و با REVOKE سطح جدول ناخواسته حذف نشود.

## 2. علت زمینه‌ای و مرز اصلاح
`pg_default_acl` در schema عمومی برای مالک‌های `postgres` و `supabase_admin`، مجوزهای گسترده پیش‌فرض برای `anon`, `authenticated` و `service_role` نشان می‌دهد. این تنظیم سراسری می‌تواند روی جدول‌های آینده در کل `public` اثر بگذارد.

**در این مرحله default privileges سراسری تغییر نمی‌کند.** تغییر آن ممکن است سایر ماژول‌های SARINA را مختل کند. اصلاح باید به‌صورت صریح و محدود به جدول‌های بازارگاه باشد؛ برای هر جدول جدید بازارگاه نیز پس از ایجاد، RLS و grantهای حداقلی همان جدول در همان migration تعیین شوند.

## 3. ماتریس دسترسی هدف
| جدول/گروه | anon | authenticated |
|---|---|---|
| categories | SELECT | SELECT |
| sellers | بدون دسترسی | SELECT + INSERT/UPDATE محدود به ستون‌های مجاز؛ بدون DELETE |
| products | SELECT | SELECT + INSERT/UPDATE محدود به ستون‌های مجاز + DELETE فقط draft طبق RLS |
| cart_items | بدون دسترسی | SELECT/INSERT/UPDATE/DELETE با RLS مالکیت خریدار |
| orders, order_items, invoices | بدون دسترسی | SELECT مشارکت‌کننده طبق RLS |
| payment_events | بدون دسترسی | بدون دسترسی مستقیم |
| shipments | بدون دسترسی | SELECT/INSERT/UPDATE طبق RLS؛ بدون DELETE |
| quote_requests | بدون دسترسی | SELECT + UPDATE فقط ستون‌های status و seller_response؛ ایجاد از RPC |
| product_external_links | SELECT با policy عمومی is_public | CRUD طبق مالکیت فروشنده |
| price_observations, product_service_needs, sales_leads, sales_tasks, trade_cost_models, trade_routes, trade_checklist_items | بدون دسترسی | CRUD طبق policy مالکیت فروشنده |
| seller_change_requests | بدون دسترسی مستقیم | بدون دسترسی مستقیم؛ RPCهای مالک/مدیر |

این ماتریس باید با مسیرهای واقعی UI و RPC قبل از اعمال نهایی تطبیق داده شود؛ ستون‌های محدودشده فروشنده/محصول و گردش quote نباید ناخواسته شکسته شوند.

## 4. SQL پیشنهادی برای اصلاح (صرفاً طرح؛ اجرا نشده)
### 4.1 حذف مجوزهای مدیریتی از نقش‌های کلاینت
برای هر 19 جدول بازارگاه، مجوزهای زیر از `anon` و `authenticated` برداشته شوند:
`TRUNCATE, MAINTAIN, REFERENCES, TRIGGER`.

فهرست 19 جدول از snapshot:
`marketplace_categories`, `marketplace_sellers`, `marketplace_products`, `marketplace_cart_items`, `marketplace_orders`, `marketplace_order_items`, `marketplace_invoices`, `marketplace_payment_events`, `marketplace_shipments`, `marketplace_quote_requests`, `marketplace_seller_change_requests`, `marketplace_product_external_links`, `marketplace_sales_leads`, `marketplace_sales_tasks`, `marketplace_product_service_needs`, `marketplace_price_observations`, `marketplace_trade_cost_models`, `marketplace_trade_routes`, `marketplace_trade_checklist_items`.

### 4.2 محدودسازی anon
- ابتدا دسترسی‌های جدول‌محور anon به تمام 19 جدول بازارگاه برداشته شوند.
- سپس فقط SELECT روی `marketplace_categories`, `marketplace_products`, `marketplace_product_external_links` دوباره اعطا شود.
- policyهای RLS موجود تعیین می‌کنند کدام ردیف‌ها قابل مشاهده باشند.
- هیچ RPC سفارش، quote، لغو سفارش، تغییر فروشنده یا بررسی مدیریتی برای anon فعال نشود.

### 4.3 محدودسازی authenticated بدون شکستن ستون‌ها
- categories: فقط SELECT؛ DML برداشته شود.
- sellers: SELECT و column-level INSERT/UPDATE فعلی حفظ شود؛ DELETE برداشته شود.
- products: SELECT، column-level INSERT/UPDATE فعلی و DELETE (draft-only policy) حفظ شود؛ regulatory columns همچنان فقط توسط مسیر بررسی مجاز تغییر کنند.
- quote_requests: SELECT و UPDATE فقط روی `status`, `seller_response` حفظ شود؛ INSERT/DELETE مستقیم برداشته شود؛ ثبت درخواست فقط از RPC مالک‌محور.
- shipments: SELECT/INSERT/UPDATE طبق policy حفظ شود؛ DELETE برداشته شود.
- cart و گروه داده‌های تجاری فروشنده: DML فعلی فقط در جایی حفظ شود که policy مالکیت صریح و لازم وجود دارد.
- orders, order_items, invoices: SELECT مشارکت‌کننده حفظ شود؛ نوشتن از مسیر RPC/سرویس مجاز انجام شود.
- payment_events و seller_change_requests: دسترسی مستقیم کلاینت داده نشود.

REVOKE سطح جدول به‌تنهایی لزوماً column-level grants را حذف نمی‌کند؛ migration باید هر دو سطح را با دقت مدیریت و سپس با `has_any_column_privilege` آزمون کند.

## 5. آزمون‌های لازم پیش از تأیید migration
1. هیچ‌یک از 19 جدول برای anon/authenticated مجوز TRUNCATE، MAINTAIN، REFERENCES یا TRIGGER نداشته باشد.
2. anon هیچ INSERT/UPDATE/DELETE یا column-level DML روی جداول بازارگاه نداشته باشد.
3. anon فقط SELECT روی categories/products/external_links داشته باشد؛ sellers، orders، quotes و shipmentها برای anon قابل خواندن نباشند.
4. تمام 19 جدول RLS فعال داشته باشند.
5. authenticated نتواند categories را تغییر دهد، seller را حذف کند، quote را مستقیم درج/حذف کند یا shipment را حذف کند.
6. column-level grants فروشنده و محصول دقیقاً مطابق فرم‌های مجاز باقی بمانند؛ ستون‌های verification و regulatory فقط از مسیر بررسی کنترل‌شده تغییر کنند.
7. cart مالک‌محور؛ order/invoice فقط برای خریدار یا فروشنده مرتبط؛ quote فقط برای خریدار/فروشنده مرتبط؛ shipment فقط برای فروشنده سفارش پرداخت‌شده.
8. RPCهای public بازارگاه برای anon قابل اجرا نباشند؛ authenticated فقط RPCهایی را اجرا کند که `auth.uid()`, پروفایل فعال، مالکیت یا نقش مدیر را در بدنه کنترل می‌کنند.
9. private helper `marketplace_seller_is_verified(uuid)` فعلاً برای anon اجراپذیر است و در policy خواندن عمومی محصول استفاده می‌شود؛ پیش از هر تغییر باید exposed بودن یا نبودن schema خصوصی و وابستگی policy بررسی شود. کورکورانه revoke نشود.
10. آزمون‌های منفی با دو حساب خریدار/فروشنده مستقل و یک کاربر فاقد مالکیت انجام شود؛ عدم دسترسی باید با خطای مجوز/صفر ردیف معتبر تأیید شود.

## 6. منبع migration و تصمیم بازسازی
- فایل‌های SQL شماره 019 تا 027 در شاخه قدیمی `integration/marketplace-and-communications-workspace` زیر `supabase/migrations/` پیدا شدند؛ در `main` و شاخه پیش‌فرض فعلی موجود نیستند.
- فایل‌های SQL متناظر با migrationهای 035 تا 042 در درخت‌های Git بررسی‌شده (`main`, `feature/farmer-portal-foundation`, شاخه قدیمی integration) پیدا نشدند، درحالی‌که migration history زنده آن‌ها را ثبت می‌کند.
- PR شماره 1 در فهرست فایل‌های ادغام‌شده، فایل migrationهای بازارگاه را شامل نمی‌شود؛ بنابراین توضیح قدیمی PR مبنی بر tracked بودن آن‌ها در `database/migrations` از فهرست فایل‌های واقعی پشتیبانی نمی‌شود.
- از تاریخچه زنده نمی‌توان SQL اصلی migrationهای گمشده را بازیابی کرد. وضعیت فعلی باید با introspection به‌صورت **schema snapshot بازسازی‌شده از دیتابیس زنده** ثبت شود؛ نباید این snapshot به‌عنوان متن تاریخی migrationهای اصلی معرفی شود.
- تا تکمیل snapshot، ترتیب اجرا، provenance و تطبیق checksumها، هیچ migration جدید یا بازاجرای 019–042 انجام نشود.

## 7. وضعیت اجرا
- این سند و فایل آزمون همراه آن فقط برای بازبینی هستند.
- هیچ `GRANT`, `REVOKE`, `ALTER DEFAULT PRIVILEGES`, policy، schema، row، function یا migration روی Supabase اجرا نشده است.
- آزمون همراه تا پیش از اجرای migration اصلاحی، ممکن است عمداً fail شود؛ این شکست در وضعیت فعلی انتظار می‌رود.
- اجرای اصلاح فقط پس از بازبینی migration، backup مستقل، آزمون staging و تأیید صریح انجام خواهد شد.
