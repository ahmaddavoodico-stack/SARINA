-- Structural/security smoke test for:
-- 20261127160000_farmer_confirmed_farm_asset_locations.sql
-- 20261127170000_sarina_farm_map_spatial_model.sql
--
-- Run only in an isolated Supabase development branch after applying both
-- migrations there. This test is read-only and creates no farm/user data.
-- It verifies schema, RLS enablement, policy presence, and SQL grants.
-- Per-identity authorization behavior must additionally be tested with
-- seeded farmer/expert/organization fixtures in the isolated environment.

DO $$
DECLARE
  v_table text;
  v_definition text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    RAISE EXCEPTION 'PostGIS extension is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'postgis' AND n.nspname = 'public'
  ) THEN
    RAISE EXCEPTION 'Expected PostGIS extension schema public';
  END IF;

  FOREACH v_table IN ARRAY ARRAY[
    'farm_assets', 'farm_trees', 'farm_tree_events',
    'farm_map_features', 'irrigation_network_edges'
  ] LOOP
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      RAISE EXCEPTION 'Required farm map table public.% is missing', v_table;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = v_table AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'RLS is not enabled on public.%', v_table;
    END IF;

    IF has_table_privilege('anon', format('public.%I', v_table), 'SELECT')
       OR has_table_privilege('anon', format('public.%I', v_table), 'INSERT')
       OR has_table_privilege('anon', format('public.%I', v_table), 'UPDATE')
       OR has_table_privilege('anon', format('public.%I', v_table), 'DELETE') THEN
      RAISE EXCEPTION 'anon unexpectedly has direct table privileges on public.%', v_table;
    END IF;
  END LOOP;

  IF NOT has_table_privilege('authenticated', 'public.farm_assets', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.farm_trees', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.farm_map_features', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.irrigation_network_edges', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated is missing required SELECT grants';
  END IF;

  IF has_table_privilege('authenticated', 'public.farm_trees', 'DELETE') THEN
    RAISE EXCEPTION 'Farmers must not hard-delete stable tree identities';
  END IF;

  IF has_table_privilege('authenticated', 'public.farm_tree_events', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.farm_tree_events', 'DELETE') THEN
    RAISE EXCEPTION 'Tree event history must be append-only for authenticated clients';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.farm_tree_events', 'INSERT') THEN
    RAISE EXCEPTION 'Authenticated farmers need the controlled farmer-reported event insert grant';
  END IF;

  IF has_table_privilege('authenticated', 'public.farm_assets', 'TRUNCATE')
     OR has_table_privilege('authenticated', 'public.farm_assets', 'REFERENCES')
     OR has_table_privilege('authenticated', 'public.farm_assets', 'TRIGGER')
     OR has_table_privilege('authenticated', 'public.farm_trees', 'TRUNCATE')
     OR has_table_privilege('authenticated', 'public.farm_map_features', 'TRUNCATE')
     OR has_table_privilege('authenticated', 'public.irrigation_network_edges', 'TRUNCATE') THEN
    RAISE EXCEPTION 'Authenticated has unexpected elevated table privileges';
  END IF;

  IF has_function_privilege('anon', 'public.append_farm_tree_event()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.append_farm_tree_event()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.validate_farm_tree_spatial_state()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.validate_farm_tree_spatial_state()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Trigger-only functions must not be directly executable by client roles';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.geometry_columns
    WHERE f_table_schema = 'public' AND f_table_name = 'farm_assets'
      AND f_geometry_column = 'location' AND srid = 4326 AND type = 'POINT'
  ) THEN
    RAISE EXCEPTION 'farm_assets.location must be WGS84 POINT';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.geometry_columns
    WHERE f_table_schema = 'public' AND f_table_name = 'farm_trees'
      AND f_geometry_column = 'location' AND srid = 4326 AND type = 'POINT'
  ) THEN
    RAISE EXCEPTION 'farm_trees.location must be WGS84 POINT';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.geometry_columns
    WHERE f_table_schema = 'public' AND f_table_name = 'farm_map_features'
      AND f_geometry_column = 'geometry' AND srid = 4326 AND type = 'GEOMETRY'
  ) THEN
    RAISE EXCEPTION 'farm_map_features.geometry must be generic WGS84 geometry with constrained line/polygon families';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.farm_assets'::regclass
      AND conname = 'farm_assets_field_farm_fkey'
      AND pg_get_constraintdef(oid) ILIKE '%(field_id, farm_id)%'
  ) THEN
    RAISE EXCEPTION 'farm_assets must enforce same-farm field references with a composite FK';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.farm_trees'::regclass
      AND conname = 'farm_trees_crop_cycle_farm_fkey'
      AND pg_get_constraintdef(oid) ILIKE '%(crop_cycle_id, farm_id)%'
  ) THEN
    RAISE EXCEPTION 'farm_trees must enforce same-farm crop-cycle references';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.farm_map_features'::regclass
      AND conname = 'farm_map_features_field_farm_fkey'
      AND pg_get_constraintdef(oid) ILIKE '%(field_id, farm_id)%'
  ) THEN
    RAISE EXCEPTION 'farm_map_features must enforce same-farm field references';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.farm_trees'::regclass
      AND tgname = 'farm_trees_append_history' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Tree lifecycle/location history trigger is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.farm_map_features'::regclass
      AND tgname = 'farm_map_features_validate_spatial_state' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Map feature geometry validation trigger is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.irrigation_network_edges'::regclass
      AND tgname = 'irrigation_network_edges_validate' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Irrigation network validation trigger is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'farm_trees'
      AND policyname = 'expert_read_farm_trees' AND cmd = 'SELECT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'farm_map_features'
      AND policyname = 'organization_read_farm_map_features' AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'Expected expert and organization read policies are missing';
  END IF;

  SELECT pg_get_constraintdef(oid) INTO v_definition
  FROM pg_constraint
  WHERE conrelid = 'public.farm_map_features'::regclass
    AND conname = 'farm_map_features_geometry_family_check';

  IF v_definition IS NULL
     OR v_definition NOT ILIKE '%LINESTRING%'
     OR v_definition NOT ILIKE '%POLYGON%' THEN
    RAISE EXCEPTION 'Map feature geometry-family constraint is missing or incomplete';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'append_farm_tree_event'
      AND p.prosecdef = true
  ) THEN
    RAISE EXCEPTION 'Narrow SECURITY DEFINER append-only tree history trigger function is missing';
  END IF;
END;
$$;
