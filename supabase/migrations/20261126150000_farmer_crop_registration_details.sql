-- Farmer crop details captured during farm registration.
-- The farmer may provide approximate age and yield; unknown values remain NULL.
BEGIN;

ALTER TABLE public.farms
  ADD COLUMN IF NOT EXISTS water_structures jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS irrigation_systems jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.farms
  DROP CONSTRAINT IF EXISTS farms_water_structures_array_check,
  ADD CONSTRAINT farms_water_structures_array_check CHECK (jsonb_typeof(water_structures) = 'array'),
  DROP CONSTRAINT IF EXISTS farms_irrigation_systems_array_check,
  ADD CONSTRAINT farms_irrigation_systems_array_check CHECK (jsonb_typeof(irrigation_systems) = 'array');

ALTER TABLE public.crop_cycles
  ADD COLUMN IF NOT EXISTS crop_label text,
  ADD COLUMN IF NOT EXISTS variety_label text,
  ADD COLUMN IF NOT EXISTS tree_age_years numeric(6,2),
  ADD COLUMN IF NOT EXISTS yield_quantity numeric(14,3),
  ADD COLUMN IF NOT EXISTS yield_unit text,
  ADD COLUMN IF NOT EXISTS yield_period text,
  ADD COLUMN IF NOT EXISTS crop_role text NOT NULL DEFAULT 'main_crop';

ALTER TABLE public.crop_cycles
  DROP CONSTRAINT IF EXISTS crop_cycles_tree_age_years_check,
  ADD CONSTRAINT crop_cycles_tree_age_years_check
    CHECK (tree_age_years IS NULL OR tree_age_years BETWEEN 0 AND 200),
  DROP CONSTRAINT IF EXISTS crop_cycles_yield_quantity_check,
  ADD CONSTRAINT crop_cycles_yield_quantity_check
    CHECK (yield_quantity IS NULL OR yield_quantity >= 0),
  DROP CONSTRAINT IF EXISTS crop_cycles_yield_unit_check,
  ADD CONSTRAINT crop_cycles_yield_unit_check
    CHECK (yield_unit IS NULL OR yield_unit IN ('kg_per_tree','ton_per_hectare','ton_total')),
  DROP CONSTRAINT IF EXISTS crop_cycles_yield_period_check,
  ADD CONSTRAINT crop_cycles_yield_period_check
    CHECK (yield_period IS NULL OR yield_period IN ('per_year','last_season','average'));
  
ALTER TABLE public.crop_cycles
  DROP CONSTRAINT IF EXISTS crop_cycles_crop_role_check,
  ADD CONSTRAINT crop_cycles_crop_role_check
    CHECK (crop_role IN ('main_crop','intercrop','forage','cover_crop','other'));

INSERT INTO public.crop_catalog (common_name, local_names, crop_category, perennial, is_active)
SELECT v.common_name, jsonb_build_object('fa', v.fa_name), v.crop_category, v.perennial, true
FROM (VALUES
  ('Date palm','نخل خرما','fruit_tree'),
  ('Citrus','مرکبات','fruit_tree'),
  ('Olive','زیتون','fruit_tree'),
  ('Grape','انگور','fruit_tree'),
  ('Pomegranate','انار','fruit_tree'),
  ('Apple','سیب','fruit_tree'),
  ('Pear','گلابی','fruit_tree'),
  ('Peach','هلو','fruit_tree'),
  ('Apricot','زردآلو','fruit_tree'),
  ('Almond','بادام','nut_tree'),
  ('Pistachio','پسته','nut_tree'),
  ('Walnut','گردو','nut_tree'),
  ('Fig','انجیر','fruit_tree'),
  ('Banana','موز','fruit_tree'),
  ('Mango','انبه','fruit_tree'),
  ('Other perennial crop','سایر درختان و کشت‌های دائمی','other',true),
  ('Alfalfa','یونجه','forage',false),
  ('Berseem clover','شبدر برسیم','forage',false),
  ('Ryegrass','چچم','forage',false),
  ('Forage sorghum','سورگوم علوفه‌ای','forage',false),
  ('Forage maize','ذرت علوفه‌ای','forage',false),
  ('Cowpea','لوبیا چشم‌بلبلی','legume',false),
  ('Barley','جو','cereal',false),
  ('Oat','جو دوسر','cereal',false),
  ('Sudan grass','سودان گراس','forage',false),
  ('Annual clover','شبدر یک‌ساله','forage',false)
) AS v(common_name, fa_name, crop_category, perennial)
WHERE NOT EXISTS (
  SELECT 1 FROM public.crop_catalog c WHERE lower(c.common_name) = lower(v.common_name)
);

COMMIT;
