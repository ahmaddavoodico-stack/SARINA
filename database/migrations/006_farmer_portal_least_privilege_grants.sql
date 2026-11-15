-- SARINA | Migration 006: Least-privilege grants for farmer-facing tables
-- RLS controls rows; SQL grants control operations. Remove inherited broad grants first.

REVOKE ALL PRIVILEGES ON TABLE
  public.users, public.farms, public.farm_fields, public.farm_locations,
  public.crop_cycles, public.soil_tests, public.water_tests,
  public.farm_observations, public.irrigation_events,
  public.farm_recommendations, public.weather_records,
  public.location_permissions, public.countries, public.crop_catalog, public.crop_varieties
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.farms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.farm_fields, public.farm_locations, public.crop_cycles,
  public.soil_tests, public.water_tests, public.farm_observations,
  public.irrigation_events, public.location_permissions
TO authenticated;
GRANT SELECT ON public.farm_recommendations, public.weather_records,
  public.countries, public.crop_catalog, public.crop_varieties
TO authenticated;
