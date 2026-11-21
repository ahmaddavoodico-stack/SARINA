# گزارش اجرای اصلاح مجوزهای بازارگاه SARINA
تاریخ اجرا: 2026-11-21
پروژه Supabase: `wwgkiclcpgpdktneovrx`
نسخه PostgreSQL: 17.11

## تغییر اجرایی
Migration `20261121195239_marketplace_client_privilege_hardening` با موفقیت روی پایگاه داده متصل اعمال شد.

- روی هر 19 جدول بازارگاه، مجوزهای `TRUNCATE`, `MAINTAIN`, `REFERENCES` و `TRIGGER` از `anon` و `authenticated` برداشته شد.
- دسترسی مستقیم `anon` به جداول بازارگاه حذف شد و فقط `SELECT` روی `marketplace_categories`, `marketplace_products` و `marketplace_product_external_links` دوباره اعطا شد؛ policyهای RLS موجود همچنان محدودیت ردیف‌ها را اعمال می‌کنند.
- دسترسی نوشتن `authenticated` به دسته‌بندی‌ها حذف شد.
- حذف مستقیم فروشنده و محموله برای `authenticated` بسته شد.
- ایجاد و حذف مستقیم درخواست قیمت و UPDATE عمومی آن بسته شد؛ UPDATE فقط روی ستون‌های `status` و `seller_response` باقی ماند.
- column-level INSERT/UPDATE موجود برای فروشندگان و محصولات حفظ شد.
- هیچ داده‌ای حذف یا تغییر نکرد؛ هیچ policy، تابع، schema یا default privilege سراسری تغییر نکرد.

## نتیجه آزمون
فایل `supabase/tests/marketplace_privilege_regression.sql` پس از اعمال migration روی دیتابیس اجرا شد و بدون exception پایان یافت.

یک query مستقل نیز روی تمام 19 جدول و هر دو نقش اجرا شد:
- تعداد دسترسی‌های مؤثر TRUNCATE: صفر
- تعداد دسترسی‌های مؤثر MAINTAIN: صفر
- تعداد دسترسی‌های مؤثر REFERENCES: صفر
- تعداد دسترسی‌های مؤثر TRIGGER: صفر

## موارد باقی‌مانده
این migration فقط hardening مجوزهای جدول بازارگاه است و به معنی رفع تمام هشدارهای Security Advisor یا تکمیل آزمون end-to-end برنامه نیست.

موارد زیر همچنان نیازمند بررسی مستقل‌اند:
- 17 جدول دارای RLS فعال بدون policy؛ برای هر جدول باید مشخص شود آیا عمداً فقط از RPC/service-role قابل دسترسی است یا policy لازم دارد.
- `public.spatial_ref_sys` بدون RLS و PostGIS در schema عمومی؛ انتقال extension یا تغییر RLS باید با بررسی وابستگی‌های PostGIS انجام شود.
- توابع SECURITY DEFINER قابل اجرا توسط نقش‌های client؛ هر تابع باید از نظر auth.uid، مالکیت، نقش، search_path و مسیرهای فراخوانی بررسی شود. توابع لازم برای محصول نباید کورکورانه revoke شوند.
- حفاظت در برابر گذرواژه‌های افشاشده در تنظیمات Auth فعال نیست.
- آزمون‌های منفی end-to-end با حساب‌های واقعی مستقل خریدار، فروشنده و کاربر فاقد مالکیت هنوز انجام نشده‌اند.

این گزارش نتیجه اجرای واقعی migration و آزمون SQL را ثبت می‌کند؛ گواهی امنیت کامل یا تأیید نهایی تمام گردش‌های محصول نیست.
