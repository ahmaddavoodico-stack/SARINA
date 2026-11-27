-- SARINA spatial/FAQ least-privilege and advisor hardening V1.
-- Additive indexes and policy consolidation only; no user data is rewritten.

BEGIN;

-- Cover foreign-key lookups used by history, ownership and replacement paths.
CREATE INDEX IF NOT EXISTS farm_assets_created_by_auth_user_id_idx
  ON public.farm_assets (created_by_auth_user_id) WHERE created_by_auth_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS farm_trees_created_by_auth_user_id_idx
  ON public.farm_trees (created_by_auth_user_id) WHERE created_by_auth_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS farm_trees_field_farm_idx
  ON public.farm_trees (field_id, farm_id) WHERE field_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS farm_trees_replacement_farm_idx
  ON public.farm_trees (replaced_by_tree_id, farm_id) WHERE replaced_by_tree_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS farm_tree_events_actor_idx
  ON public.farm_tree_events (actor_auth_user_id) WHERE actor_auth_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS farm_tree_events_farm_idx
  ON public.farm_tree_events (farm_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS farm_tree_events_tree_farm_idx
  ON public.farm_tree_events (tree_id, farm_id);

CREATE INDEX IF NOT EXISTS farm_map_features_created_by_auth_user_id_idx
  ON public.farm_map_features (created_by_auth_user_id) WHERE created_by_auth_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS farm_asset_events_actor_idx
  ON public.farm_asset_events (actor_auth_user_id) WHERE actor_auth_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS farm_asset_events_asset_farm_idx
  ON public.farm_asset_events (asset_id, farm_id);
CREATE INDEX IF NOT EXISTS farm_map_feature_events_actor_idx
  ON public.farm_map_feature_events (actor_auth_user_id) WHERE actor_auth_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS farm_map_feature_events_feature_farm_idx
  ON public.farm_map_feature_events (feature_id, farm_id);
CREATE INDEX IF NOT EXISTS irrigation_network_edges_created_by_auth_user_id_idx
  ON public.irrigation_network_edges (created_by_auth_user_id) WHERE created_by_auth_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS irrigation_network_edges_zone_farm_idx
  ON public.irrigation_network_edges (irrigation_zone_feature_id, farm_id)
  WHERE irrigation_zone_feature_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS irrigation_network_edge_events_actor_idx
  ON public.irrigation_network_edge_events (actor_auth_user_id) WHERE actor_auth_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS irrigation_network_edge_events_edge_farm_idx
  ON public.irrigation_network_edge_events (edge_id, farm_id);

CREATE INDEX IF NOT EXISTS sarina_faq_entries_created_by_idx
  ON public.sarina_faq_entries (created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS sarina_faq_versions_approved_by_idx
  ON public.sarina_faq_versions (approved_by) WHERE approved_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS sarina_faq_versions_created_by_idx
  ON public.sarina_faq_versions (created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS sarina_faq_review_events_reviewer_idx
  ON public.sarina_faq_review_events (reviewer_user_id) WHERE reviewer_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sarina_faq_question_signals_topic_idx
  ON public.sarina_faq_question_signals (topic_id) WHERE topic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sarina_faq_question_signals_linked_entry_idx
  ON public.sarina_faq_question_signals (linked_faq_entry_id) WHERE linked_faq_entry_id IS NOT NULL;

-- Consolidate farm-scoped SELECT checks into one policy per table.
-- Writes remain owner-only, with UPDATE using both USING and WITH CHECK.
DROP POLICY IF EXISTS "farmer owns farm_assets" ON public.farm_assets;
DROP POLICY IF EXISTS expert_contract_read_farm_assets ON public.farm_assets;
DROP POLICY IF EXISTS organization_scoped_read_farm_assets ON public.farm_assets;
CREATE POLICY farm_assets_scoped_read ON public.farm_assets
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.farms f JOIN public.users u ON u.id=f.owner_user_id
      WHERE f.id=farm_assets.farm_id AND u.auth_user_id=(SELECT auth.uid())
    )
    OR public.is_current_user_active_expert_for_farm(farm_id)
    OR public.is_sarina_admin()
    OR EXISTS (
      SELECT 1 FROM public.farms f JOIN public.organization_members om ON true
      WHERE f.id=farm_assets.farm_id
        AND public.organization_has_scoped_access(
          om.organization_id,'oversight.farm.read',f.owner_user_id,f.country_id,f.id
        )
    )
  );
CREATE POLICY farmer_insert_farm_assets ON public.farm_assets
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM public.farms f JOIN public.users u ON u.id=f.owner_user_id
    WHERE f.id=farm_assets.farm_id AND u.auth_user_id=(SELECT auth.uid())
  ));
CREATE POLICY farmer_update_farm_assets ON public.farm_assets
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.farms f JOIN public.users u ON u.id=f.owner_user_id
    WHERE f.id=farm_assets.farm_id AND u.auth_user_id=(SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.farms f JOIN public.users u ON u.id=f.owner_user_id
    WHERE f.id=farm_assets.farm_id AND u.auth_user_id=(SELECT auth.uid())
  ));

DROP POLICY IF EXISTS farmer_manage_farm_trees ON public.farm_trees;
DROP POLICY IF EXISTS expert_read_farm_trees ON public.farm_trees;
DROP POLICY IF EXISTS organization_read_farm_trees ON public.farm_trees;
CREATE POLICY farm_trees_scoped_read ON public.farm_trees
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.farms f JOIN public.users u ON u.id=f.owner_user_id
      WHERE f.id=farm_trees.farm_id AND u.auth_user_id=(SELECT auth.uid())
    )
    OR public.is_current_user_active_expert_for_farm(farm_id)
    OR public.is_sarina_admin()
    OR EXISTS (
      SELECT 1 FROM public.farms f JOIN public.organization_members om ON true
      WHERE f.id=farm_trees.farm_id
        AND public.organization_has_scoped_access(
          om.organization_id,'oversight.farm.read',f.owner_user_id,f.country_id,f.id
        )
    )
  );
CREATE POLICY farmer_insert_farm_trees ON public.farm_trees
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM public.farms f JOIN public.users u ON u.id=f.owner_user_id
    WHERE f.id=farm_trees.farm_id AND u.auth_user_id=(SELECT auth.uid())
  ));
CREATE POLICY farmer_update_farm_trees ON public.farm_trees
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.farms f JOIN public.users u ON u.id=f.owner_user_id
    WHERE f.id=farm_trees.farm_id AND u.auth_user_id=(SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.farms f JOIN public.users u ON u.id=f.owner_user_id
    WHERE f.id=farm_trees.farm_id AND u.auth_user_id=(SELECT auth.uid())
  ));

DROP POLICY IF EXISTS farmer_manage_farm_map_features ON public.farm_map_features;
DROP POLICY IF EXISTS expert_read_farm_map_features ON public.farm_map_features;
DROP POLICY IF EXISTS organization_read_farm_map_features ON public.farm_map_features;
CREATE POLICY farm_map_features_scoped_read ON public.farm_map_features
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.farms f JOIN public.users u ON u.id=f.owner_user_id
      WHERE f.id=farm_map_features.farm_id AND u.auth_user_id=(SELECT auth.uid())
    )
    OR public.is_current_user_active_expert_for_farm(farm_id)
    OR public.is_sarina_admin()
    OR EXISTS (
      SELECT 1 FROM public.farms f JOIN public.organization_members om ON true
      WHERE f.id=farm_map_features.farm_id
        AND public.organization_has_scoped_access(
          om.organization_id,'oversight.farm.read',f.owner_user_id,f.country_id,f.id
        )
    )
  );
CREATE POLICY farmer_insert_farm_map_features ON public.farm_map_features
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM public.farms f JOIN public.users u ON u.id=f.owner_user_id
    WHERE f.id=farm_map_features.farm_id AND u.auth_user_id=(SELECT auth.uid())
  ));
CREATE POLICY farmer_update_farm_map_features ON public.farm_map_features
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.farms f JOIN public.users u ON u.id=f.owner_user_id
    WHERE f.id=farm_map_features.farm_id AND u.auth_user_id=(SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.farms f JOIN public.users u ON u.id=f.owner_user_id
    WHERE f.id=farm_map_features.farm_id AND u.auth_user_id=(SELECT auth.uid())
  ));

DROP POLICY IF EXISTS farmer_manage_irrigation_network_edges ON public.irrigation_network_edges;
DROP POLICY IF EXISTS expert_read_irrigation_network_edges ON public.irrigation_network_edges;
DROP POLICY IF EXISTS organization_read_irrigation_network_edges ON public.irrigation_network_edges;
CREATE POLICY irrigation_network_edges_scoped_read ON public.irrigation_network_edges
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.farms f JOIN public.users u ON u.id=f.owner_user_id
      WHERE f.id=irrigation_network_edges.farm_id AND u.auth_user_id=(SELECT auth.uid())
    )
    OR public.is_current_user_active_expert_for_farm(farm_id)
    OR public.is_sarina_admin()
    OR EXISTS (
      SELECT 1 FROM public.farms f JOIN public.organization_members om ON true
      WHERE f.id=irrigation_network_edges.farm_id
        AND public.organization_has_scoped_access(
          om.organization_id,'oversight.farm.read',f.owner_user_id,f.country_id,f.id
        )
    )
  );
CREATE POLICY farmer_insert_irrigation_network_edges ON public.irrigation_network_edges
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM public.farms f JOIN public.users u ON u.id=f.owner_user_id
    WHERE f.id=irrigation_network_edges.farm_id AND u.auth_user_id=(SELECT auth.uid())
  ));
CREATE POLICY farmer_update_irrigation_network_edges ON public.irrigation_network_edges
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.farms f JOIN public.users u ON u.id=f.owner_user_id
    WHERE f.id=irrigation_network_edges.farm_id AND u.auth_user_id=(SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.farms f JOIN public.users u ON u.id=f.owner_user_id
    WHERE f.id=irrigation_network_edges.farm_id AND u.auth_user_id=(SELECT auth.uid())
  ));

-- One read policy per history table; farmer-reported inserts remain separate.
DROP POLICY IF EXISTS farmer_read_farm_tree_events ON public.farm_tree_events;
DROP POLICY IF EXISTS expert_read_farm_tree_events ON public.farm_tree_events;
DROP POLICY IF EXISTS organization_read_farm_tree_events ON public.farm_tree_events;
CREATE POLICY farm_tree_events_scoped_read ON public.farm_tree_events
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.farms f JOIN public.users u ON u.id=f.owner_user_id
      WHERE f.id=farm_tree_events.farm_id AND u.auth_user_id=(SELECT auth.uid())
    )
    OR public.is_current_user_active_expert_for_farm(farm_id)
    OR public.is_sarina_admin()
    OR EXISTS (
      SELECT 1 FROM public.farms f JOIN public.organization_members om ON true
      WHERE f.id=farm_tree_events.farm_id
        AND public.organization_has_scoped_access(
          om.organization_id,'oversight.farm.read',f.owner_user_id,f.country_id,f.id
        )
    )
  );

DROP POLICY IF EXISTS farmer_read_farm_asset_events ON public.farm_asset_events;
DROP POLICY IF EXISTS expert_read_farm_asset_events ON public.farm_asset_events;
DROP POLICY IF EXISTS organization_read_farm_asset_events ON public.farm_asset_events;
CREATE POLICY farm_asset_events_scoped_read ON public.farm_asset_events
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.farms f JOIN public.users u ON u.id=f.owner_user_id
      WHERE f.id=farm_asset_events.farm_id AND u.auth_user_id=(SELECT auth.uid())
    )
    OR public.is_current_user_active_expert_for_farm(farm_id)
    OR public.is_sarina_admin()
    OR EXISTS (
      SELECT 1 FROM public.farms f JOIN public.organization_members om ON true
      WHERE f.id=farm_asset_events.farm_id
        AND public.organization_has_scoped_access(
          om.organization_id,'oversight.farm.read',f.owner_user_id,f.country_id,f.id
        )
    )
  );

DROP POLICY IF EXISTS farmer_read_farm_map_feature_events ON public.farm_map_feature_events;
DROP POLICY IF EXISTS expert_read_farm_map_feature_events ON public.farm_map_feature_events;
DROP POLICY IF EXISTS organization_read_farm_map_feature_events ON public.farm_map_feature_events;
CREATE POLICY farm_map_feature_events_scoped_read ON public.farm_map_feature_events
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.farms f JOIN public.users u ON u.id=f.owner_user_id
      WHERE f.id=farm_map_feature_events.farm_id AND u.auth_user_id=(SELECT auth.uid())
    )
    OR public.is_current_user_active_expert_for_farm(farm_id)
    OR public.is_sarina_admin()
    OR EXISTS (
      SELECT 1 FROM public.farms f JOIN public.organization_members om ON true
      WHERE f.id=farm_map_feature_events.farm_id
        AND public.organization_has_scoped_access(
          om.organization_id,'oversight.farm.read',f.owner_user_id,f.country_id,f.id
        )
    )
  );

DROP POLICY IF EXISTS farmer_read_irrigation_network_edge_events ON public.irrigation_network_edge_events;
DROP POLICY IF EXISTS expert_read_irrigation_network_edge_events ON public.irrigation_network_edge_events;
DROP POLICY IF EXISTS organization_read_irrigation_network_edge_events ON public.irrigation_network_edge_events;
CREATE POLICY irrigation_network_edge_events_scoped_read ON public.irrigation_network_edge_events
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.farms f JOIN public.users u ON u.id=f.owner_user_id
      WHERE f.id=irrigation_network_edge_events.farm_id AND u.auth_user_id=(SELECT auth.uid())
    )
    OR public.is_current_user_active_expert_for_farm(farm_id)
    OR public.is_sarina_admin()
    OR EXISTS (
      SELECT 1 FROM public.farms f JOIN public.organization_members om ON true
      WHERE f.id=irrigation_network_edge_events.farm_id
        AND public.organization_has_scoped_access(
          om.organization_id,'oversight.farm.read',f.owner_user_id,f.country_id,f.id
        )
    )
  );

-- Explicit deny policies document the intentional server-only FAQ internals.
CREATE POLICY sarina_faq_review_events_deny_clients ON public.sarina_faq_review_events
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY sarina_faq_question_signals_deny_clients ON public.sarina_faq_question_signals
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY sarina_faq_usage_events_deny_clients ON public.sarina_faq_usage_events
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

COMMIT;
