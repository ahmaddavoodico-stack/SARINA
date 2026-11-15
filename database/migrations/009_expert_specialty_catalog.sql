-- SARINA | Migration 009: initial expert specialty catalogue
-- Bilingual display labels; categories can be expanded without changing the case contract.
INSERT INTO public.expertise_categories(category_code,display_name,is_active)
VALUES
 ('soil_water','خاک و آب | Soil & Water',true),
 ('plant_nutrition','تغذیه گیاه و کودها | Plant Nutrition',true),
 ('plant_protection','آفات و بیماری‌های گیاهی | Plant Protection',true),
 ('horticulture','باغبانی و درختان میوه | Horticulture',true),
 ('date_palm','نخل و خرما | Date Palm',true),
 ('field_crops','زراعت و محصولات مزرعه‌ای | Field Crops',true),
 ('irrigation','آبیاری و مدیریت آب | Irrigation',true),
 ('greenhouse','گلخانه و کشت کنترل‌شده | Greenhouse',true),
 ('livestock','دام و طیور | Livestock',true),
 ('agri_economics','اقتصاد و مدیریت مزرعه | Farm Economics',true),
 ('agri_engineering','ماشین‌آلات و مهندسی کشاورزی | Agricultural Engineering',true),
 ('aquaculture','آبزی‌پروری | Aquaculture',true)
ON CONFLICT (category_code) DO UPDATE
SET display_name=EXCLUDED.display_name,is_active=true;
