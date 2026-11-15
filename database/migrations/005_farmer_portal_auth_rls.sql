-- SARINA | Migration 005: Farmer portal identity and row-level access
-- Links Supabase Auth identities to the existing application users table.
-- Existing farm and agricultural tables are preserved; no data is dropped.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS users_auth_user_id_idx ON public.users(auth_user_id);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "farmer reads own profile" ON public.users;
CREATE POLICY "farmer reads own profile" ON public.users
  FOR SELECT TO authenticated USING (auth_user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "farmer creates own profile" ON public.users;
CREATE POLICY "farmer creates own profile" ON public.users
  FOR INSERT TO authenticated WITH CHECK (auth_user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "farmer updates own profile" ON public.users;
CREATE POLICY "farmer updates own profile" ON public.users
  FOR UPDATE TO authenticated
  USING (auth_user_id = (SELECT auth.uid()))
  WITH CHECK (auth_user_id = (SELECT auth.uid()));
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "farmers manage own farms" ON public.farms;
CREATE POLICY "farmers manage own farms" ON public.farms
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = farms.owner_user_id AND u.auth_user_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = farms.owner_user_id AND u.auth_user_id = (SELECT auth.uid())
  ));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.farms TO authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'farm_fields','farm_locations','crop_cycles','soil_tests','water_tests',
    'farm_observations','irrigation_events'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'farmer owns ' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
       USING (EXISTS (
         SELECT 1 FROM public.farms f
         JOIN public.users u ON u.id = f.owner_user_id
         WHERE f.id = %I.farm_id AND u.auth_user_id = (SELECT auth.uid())
       ))
       WITH CHECK (EXISTS (
         SELECT 1 FROM public.farms f
         JOIN public.users u ON u.id = f.owner_user_id
         WHERE f.id = %I.farm_id AND u.auth_user_id = (SELECT auth.uid())
       ))',
      'farmer owns ' || t, t, t, t
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END $$;

ALTER TABLE public.farm_recommendations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "farmers read own recommendations" ON public.farm_recommendations;
CREATE POLICY "farmers read own recommendations" ON public.farm_recommendations
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.farms f
    JOIN public.users u ON u.id = f.owner_user_id
    WHERE f.id = farm_recommendations.farm_id AND u.auth_user_id = (SELECT auth.uid())
  ));
GRANT SELECT ON public.farm_recommendations TO authenticated;

ALTER TABLE public.weather_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "farmers read own farm weather" ON public.weather_records;
CREATE POLICY "farmers read own farm weather" ON public.weather_records
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.farms f
    JOIN public.users u ON u.id = f.owner_user_id
    WHERE f.id = weather_records.farm_id AND u.auth_user_id = (SELECT auth.uid())
  ));
GRANT SELECT ON public.weather_records TO authenticated;

ALTER TABLE public.location_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "farmers manage own location consent" ON public.location_permissions;
CREATE POLICY "farmers manage own location consent" ON public.location_permissions
  FOR ALL TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = (SELECT auth.uid())))
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = (SELECT auth.uid())));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.location_permissions TO authenticated;

ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read countries" ON public.countries;
CREATE POLICY "authenticated read countries" ON public.countries
  FOR SELECT TO authenticated USING (is_active = true);
GRANT SELECT ON public.countries TO authenticated;

ALTER TABLE public.crop_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read active crop catalog" ON public.crop_catalog;
CREATE POLICY "authenticated read active crop catalog" ON public.crop_catalog
  FOR SELECT TO authenticated USING (is_active = true);
GRANT SELECT ON public.crop_catalog TO authenticated;

ALTER TABLE public.crop_varieties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read active crop varieties" ON public.crop_varieties;
CREATE POLICY "authenticated read active crop varieties" ON public.crop_varieties
  FOR SELECT TO authenticated USING (is_active = true);
GRANT SELECT ON public.crop_varieties TO authenticated;
