-- Read-only checks for SARINA spatial/FAQ policy and index hardening.
DO $$
DECLARE
  v_table text;
  v_count integer;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'farm_assets','farm_trees','farm_map_features','irrigation_network_edges',
    'farm_tree_events','farm_asset_events','farm_map_feature_events','irrigation_network_edge_events'
  ] LOOP
    SELECT count(*) INTO v_count
    FROM pg_policies
    WHERE schemaname='public' AND tablename=v_table
      AND cmd='SELECT' AND 'authenticated'=ANY(roles);
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'Expected exactly one authenticated SELECT policy on public.%, found %',v_table,v_count;
    END IF;
  END LOOP;

  FOREACH v_table IN ARRAY ARRAY[
    'sarina_faq_review_events','sarina_faq_question_signals','sarina_faq_usage_events'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename=v_table
        AND policyname LIKE '%deny_clients%'
        AND cmd='ALL'
    ) THEN
      RAISE EXCEPTION 'Explicit deny-client policy missing on public.%',v_table;
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='farm_trees_field_farm_idx')
     OR NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='sarina_faq_versions_approved_by_idx')
     OR NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='irrigation_network_edges_zone_farm_idx') THEN
    RAISE EXCEPTION 'One or more foreign-key covering indexes are missing';
  END IF;

  IF has_table_privilege('authenticated','public.farm_assets','DELETE')
     OR has_table_privilege('authenticated','public.farm_trees','DELETE')
     OR has_table_privilege('authenticated','public.farm_map_features','DELETE')
     OR has_table_privilege('authenticated','public.irrigation_network_edges','DELETE') THEN
    RAISE EXCEPTION 'Client hard-delete privilege must remain revoked';
  END IF;
END;
$$;
