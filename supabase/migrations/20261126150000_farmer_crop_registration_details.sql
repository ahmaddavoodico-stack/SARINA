-- Farmer crop details captured during farm registration.
-- The farmer may provide approximate age and yield; unknown values remain NULL.
BEGIN;

ALTER TABLE public.crop_cycles
  ADD COLUMN IF NOT EXISTS variety_label text,
  ADD COLUMN IF NOT EXISTS tree_age_years numeric(6,2),
  ADD COLUMN IF NOT EXISTS yield_quantity numeric(14,3),
  ADD COLUMN IF NOT EXISTS yield_unit text,
  ADD COLUMN IF NOT EXISTS yield_period text;

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

INSERT INTO public.crop_catalog (common_name, local_names, crop_category, perennial, is_active)
SELECT v.common_name, jsonb_build_object('fa', v.fa_name), v.crop_category, true, true
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
  ('Other perennial crop','سایر درختان و کشت‌های دائمی','other')
) AS v(common_name, fa_name, crop_category)
WHERE NOT EXISTS (
  SELECT 1 FROM public.crop_catalog c WHERE lower(c.common_name) = lower(v.common_name)
);

COMMIT;
