-- SARINA | Migration 007: allow pond and reservoir assets in farm observations
-- Preserve all existing observation types and the existing owner-scoped RLS model.
ALTER TABLE public.farm_observations
  DROP CONSTRAINT IF EXISTS farm_observations_observation_type_check;
ALTER TABLE public.farm_observations
  ADD CONSTRAINT farm_observations_observation_type_check
  CHECK (observation_type::text = ANY (ARRAY[
    'growth','pest','disease','water_stress','nutrient_deficiency',
    'weather_damage','soil_condition','crop_layout','pond_asset',
    'yield','general'
  ]::text[]));
