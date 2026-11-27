-- Read-only structural/security checks for SARINA farm-map history hardening.
DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'farm_asset_events','farm_map_feature_events','irrigation_network_edge_events'
  ] LOOP
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      RAISE EXCEPTION 'Missing public.%', v_table;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=v_table AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'RLS disabled on public.%', v_table;
    END IF;
    IF has_table_privilege('anon', format('public.%I',v_table), 'SELECT')
       OR has_table_privilege('anon', format('public.%I',v_table), 'INSERT') THEN
      RAISE EXCEPTION 'anon has unexpected access to public.%', v_table;
    END IF;
    IF has_table_privilege('authenticated', format('public.%I',v_table), 'UPDATE')
       OR has_table_privilege('authenticated', format('public.%I',v_table), 'DELETE') THEN
      RAISE EXCEPTION 'Spatial event table public.% must be append-only for clients', v_table;
    END IF;
  END LOOP;

  IF has_table_privilege('authenticated','public.farm_assets','DELETE')
     OR has_table_privilege('authenticated','public.farm_trees','DELETE')
     OR has_table_privilege('authenticated','public.farm_map_features','DELETE')
     OR has_table_privilege('authenticated','public.irrigation_network_edges','DELETE') THEN
    RAISE EXCEPTION 'Farm spatial records must be retired, not hard-deleted by clients';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='farm_tree_events'
      AND column_name='previous_location' AND udt_name='geometry'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='farm_tree_events'
      AND column_name='new_location' AND udt_name='geometry'
  ) THEN
    RAISE EXCEPTION 'Tree history must retain previous and new coordinates';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgrelid='public.farm_assets'::regclass
      AND tgname='farm_assets_append_history' AND NOT tgisinternal
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgrelid='public.farm_map_features'::regclass
      AND tgname='farm_map_features_append_history' AND NOT tgisinternal
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgrelid='public.irrigation_network_edges'::regclass
      AND tgname='irrigation_network_edges_append_history' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'One or more spatial history triggers are missing';
  END IF;

  IF has_function_privilege('anon','public.append_farm_asset_event()','EXECUTE')
     OR has_function_privilege('authenticated','public.append_farm_asset_event()','EXECUTE')
     OR has_function_privilege('anon','public.append_farm_map_feature_event()','EXECUTE')
     OR has_function_privilege('authenticated','public.append_farm_map_feature_event()','EXECUTE')
     OR has_function_privilege('anon','public.append_irrigation_network_edge_event()','EXECUTE')
     OR has_function_privilege('authenticated','public.append_irrigation_network_edge_event()','EXECUTE') THEN
    RAISE EXCEPTION 'Trigger-only history functions are executable by a client role';
  END IF;
END;
$$;
