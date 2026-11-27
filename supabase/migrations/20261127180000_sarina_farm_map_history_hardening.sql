-- SARINA farm-map audit history hardening V1.
-- Depends on 20261127160000 and 20261127170000.
-- Additive only: preserves existing rows and blocks client hard-deletes in favor of lifecycle/status changes.

BEGIN;

-- Preserve exact previous/current coordinates for individual-tree history.
ALTER TABLE public.farm_tree_events
  ADD COLUMN IF NOT EXISTS previous_location public.geometry(Point, 4326),
  ADD COLUMN IF NOT EXISTS new_location public.geometry(Point, 4326);

CREATE TABLE public.farm_asset_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL,
  event_type text NOT NULL,
  event_source text NOT NULL DEFAULT 'system',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_location public.geometry(Point, 4326),
  new_location public.geometry(Point, 4326),
  event_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT farm_asset_events_asset_farm_fkey
    FOREIGN KEY (asset_id, farm_id)
    REFERENCES public.farm_assets(id, farm_id) ON DELETE RESTRICT,
  CONSTRAINT farm_asset_events_type_check
    CHECK (event_type IN ('asset_created','location_changed','confirmation_changed','status_changed','asset_details_changed')),
  CONSTRAINT farm_asset_events_source_check
    CHECK (event_source IN ('system','farmer_reported','specialist_assessed','imported')),
  CONSTRAINT farm_asset_events_details_object_check
    CHECK (jsonb_typeof(event_details) = 'object')
);
CREATE INDEX farm_asset_events_asset_time_idx
  ON public.farm_asset_events (asset_id, occurred_at DESC);
CREATE INDEX farm_asset_events_farm_time_idx
  ON public.farm_asset_events (farm_id, occurred_at DESC);

CREATE TABLE public.farm_map_feature_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE RESTRICT,
  feature_id uuid NOT NULL,
  event_type text NOT NULL,
  event_source text NOT NULL DEFAULT 'system',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_geometry public.geometry(Geometry, 4326),
  new_geometry public.geometry(Geometry, 4326),
  event_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT farm_map_feature_events_feature_farm_fkey
    FOREIGN KEY (feature_id, farm_id)
    REFERENCES public.farm_map_features(id, farm_id) ON DELETE RESTRICT,
  CONSTRAINT farm_map_feature_events_type_check
    CHECK (event_type IN ('feature_created','geometry_changed','confirmation_changed','status_changed','feature_details_changed')),
  CONSTRAINT farm_map_feature_events_source_check
    CHECK (event_source IN ('system','farmer_reported','specialist_assessed','imported')),
  CONSTRAINT farm_map_feature_events_details_object_check
    CHECK (jsonb_typeof(event_details) = 'object')
);
CREATE INDEX farm_map_feature_events_feature_time_idx
  ON public.farm_map_feature_events (feature_id, occurred_at DESC);
CREATE INDEX farm_map_feature_events_farm_time_idx
  ON public.farm_map_feature_events (farm_id, occurred_at DESC);

CREATE TABLE public.irrigation_network_edge_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE RESTRICT,
  edge_id uuid NOT NULL,
  event_type text NOT NULL,
  event_source text NOT NULL DEFAULT 'system',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_state jsonb,
  new_state jsonb,
  event_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT irrigation_network_edge_events_edge_farm_fkey
    FOREIGN KEY (edge_id, farm_id)
    REFERENCES public.irrigation_network_edges(id, farm_id) ON DELETE RESTRICT,
  CONSTRAINT irrigation_network_edge_events_type_check
    CHECK (event_type IN ('edge_created','connection_changed','confirmation_changed','status_changed','edge_details_changed')),
  CONSTRAINT irrigation_network_edge_events_source_check
    CHECK (event_source IN ('system','farmer_reported','specialist_assessed','imported')),
  CONSTRAINT irrigation_network_edge_events_state_object_check
    CHECK (
      (previous_state IS NULL OR jsonb_typeof(previous_state) = 'object')
      AND (new_state IS NULL OR jsonb_typeof(new_state) = 'object')
      AND jsonb_typeof(event_details) = 'object'
    )
);
CREATE INDEX irrigation_network_edge_events_edge_time_idx
  ON public.irrigation_network_edge_events (edge_id, occurred_at DESC);
CREATE INDEX irrigation_network_edge_events_farm_time_idx
  ON public.irrigation_network_edge_events (farm_id, occurred_at DESC);

-- Replace the tree event trigger body so location history retains exact WGS84 points.
CREATE OR REPLACE FUNCTION public.append_farm_tree_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_type text;
  v_details jsonb;
  v_previous_location public.geometry(Point, 4326);
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_type := 'tree_created';
    v_details := jsonb_build_object(
      'lifecycle_status', NEW.lifecycle_status,
      'field_id', NEW.field_id,
      'crop_cycle_id', NEW.crop_cycle_id
    );
  ELSE
    v_previous_location := OLD.location;
    IF OLD.lifecycle_status IS DISTINCT FROM NEW.lifecycle_status THEN
      v_type := 'lifecycle_changed';
    ELSIF OLD.location IS DISTINCT FROM NEW.location
       OR OLD.is_location_confirmed IS DISTINCT FROM NEW.is_location_confirmed THEN
      v_type := 'location_changed';
    ELSIF OLD.replaced_by_tree_id IS DISTINCT FROM NEW.replaced_by_tree_id THEN
      v_type := 'replacement_linked';
    ELSE
      v_type := 'tree_details_changed';
    END IF;
    v_details := jsonb_build_object(
      'old_lifecycle_status', OLD.lifecycle_status,
      'new_lifecycle_status', NEW.lifecycle_status,
      'old_location_confirmed', OLD.is_location_confirmed,
      'new_location_confirmed', NEW.is_location_confirmed,
      'old_replaced_by_tree_id', OLD.replaced_by_tree_id,
      'new_replaced_by_tree_id', NEW.replaced_by_tree_id
    );
  END IF;

  INSERT INTO public.farm_tree_events (
    farm_id, tree_id, event_type, event_source, actor_auth_user_id,
    previous_location, new_location, event_details
  ) VALUES (
    NEW.farm_id, NEW.id, v_type, 'system', auth.uid(),
    v_previous_location, NEW.location, v_details
  );

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.append_farm_tree_event() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.append_farm_asset_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_type text;
  v_previous_location public.geometry(Point, 4326);
  v_details jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_type := 'asset_created';
  ELSE
    v_previous_location := OLD.location;
    IF OLD.location IS DISTINCT FROM NEW.location THEN
      v_type := 'location_changed';
    ELSIF OLD.is_location_confirmed IS DISTINCT FROM NEW.is_location_confirmed THEN
      v_type := 'confirmation_changed';
    ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
      v_type := 'status_changed';
    ELSE
      v_type := 'asset_details_changed';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_details := jsonb_build_object('asset_type', NEW.asset_type, 'status', NEW.status);
  ELSE
    v_details := jsonb_build_object(
      'old_status', OLD.status, 'new_status', NEW.status,
      'old_type', OLD.asset_type, 'new_type', NEW.asset_type,
      'old_field_id', OLD.field_id, 'new_field_id', NEW.field_id,
      'old_location_confirmed', OLD.is_location_confirmed,
      'new_location_confirmed', NEW.is_location_confirmed
    );
  END IF;

  INSERT INTO public.farm_asset_events (
    farm_id, asset_id, event_type, event_source, actor_auth_user_id,
    previous_location, new_location, event_details
  ) VALUES (
    NEW.farm_id, NEW.id, v_type, 'system', auth.uid(),
    v_previous_location, NEW.location, v_details
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.append_farm_asset_event() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.append_farm_map_feature_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_type text;
  v_previous_geometry public.geometry(Geometry, 4326);
  v_details jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_type := 'feature_created';
  ELSE
    v_previous_geometry := OLD.geometry;
    IF OLD.geometry IS DISTINCT FROM NEW.geometry THEN
      v_type := 'geometry_changed';
    ELSIF OLD.is_geometry_confirmed IS DISTINCT FROM NEW.is_geometry_confirmed THEN
      v_type := 'confirmation_changed';
    ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
      v_type := 'status_changed';
    ELSE
      v_type := 'feature_details_changed';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_details := jsonb_build_object('feature_type', NEW.feature_type, 'status', NEW.status);
  ELSE
    v_details := jsonb_build_object(
      'old_status', OLD.status, 'new_status', NEW.status,
      'old_feature_type', OLD.feature_type, 'new_feature_type', NEW.feature_type,
      'old_field_id', OLD.field_id, 'new_field_id', NEW.field_id,
      'old_geometry_confirmed', OLD.is_geometry_confirmed,
      'new_geometry_confirmed', NEW.is_geometry_confirmed
    );
  END IF;

  INSERT INTO public.farm_map_feature_events (
    farm_id, feature_id, event_type, event_source, actor_auth_user_id,
    previous_geometry, new_geometry, event_details
  ) VALUES (
    NEW.farm_id, NEW.id, v_type, 'system', auth.uid(),
    v_previous_geometry, NEW.geometry, v_details
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.append_farm_map_feature_event() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.append_irrigation_network_edge_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_type text;
  v_previous_state jsonb;
  v_new_state jsonb;
BEGIN
  v_new_state := jsonb_build_object(
    'line_feature_id', NEW.line_feature_id,
    'from_asset_id', NEW.from_asset_id,
    'to_asset_id', NEW.to_asset_id,
    'irrigation_zone_feature_id', NEW.irrigation_zone_feature_id,
    'flow_direction', NEW.flow_direction,
    'network_role', NEW.network_role,
    'status', NEW.status,
    'is_connection_confirmed', NEW.is_connection_confirmed
  );

  IF TG_OP = 'INSERT' THEN
    v_type := 'edge_created';
  ELSE
    v_previous_state := jsonb_build_object(
      'line_feature_id', OLD.line_feature_id,
      'from_asset_id', OLD.from_asset_id,
      'to_asset_id', OLD.to_asset_id,
      'irrigation_zone_feature_id', OLD.irrigation_zone_feature_id,
      'flow_direction', OLD.flow_direction,
      'network_role', OLD.network_role,
      'status', OLD.status,
      'is_connection_confirmed', OLD.is_connection_confirmed
    );
    IF OLD.from_asset_id IS DISTINCT FROM NEW.from_asset_id
       OR OLD.to_asset_id IS DISTINCT FROM NEW.to_asset_id
       OR OLD.line_feature_id IS DISTINCT FROM NEW.line_feature_id
       OR OLD.irrigation_zone_feature_id IS DISTINCT FROM NEW.irrigation_zone_feature_id THEN
      v_type := 'connection_changed';
    ELSIF OLD.is_connection_confirmed IS DISTINCT FROM NEW.is_connection_confirmed THEN
      v_type := 'confirmation_changed';
    ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
      v_type := 'status_changed';
    ELSE
      v_type := 'edge_details_changed';
    END IF;
  END IF;

  INSERT INTO public.irrigation_network_edge_events (
    farm_id, edge_id, event_type, event_source, actor_auth_user_id,
    previous_state, new_state
  ) VALUES (
    NEW.farm_id, NEW.id, v_type, 'system', auth.uid(),
    v_previous_state, v_new_state
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.append_irrigation_network_edge_event() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.prevent_sarina_spatial_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'SARINA spatial history is append-only; create a correction event instead'
    USING ERRCODE = '55000';
END;
$$;
REVOKE ALL ON FUNCTION public.prevent_sarina_spatial_event_mutation() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER farm_assets_append_history
  AFTER INSERT OR UPDATE ON public.farm_assets
  FOR EACH ROW EXECUTE FUNCTION public.append_farm_asset_event();
CREATE TRIGGER farm_map_features_append_history
  AFTER INSERT OR UPDATE ON public.farm_map_features
  FOR EACH ROW EXECUTE FUNCTION public.append_farm_map_feature_event();
CREATE TRIGGER irrigation_network_edges_append_history
  AFTER INSERT OR UPDATE ON public.irrigation_network_edges
  FOR EACH ROW EXECUTE FUNCTION public.append_irrigation_network_edge_event();

CREATE TRIGGER farm_asset_events_append_only
  BEFORE UPDATE OR DELETE ON public.farm_asset_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_sarina_spatial_event_mutation();
CREATE TRIGGER farm_map_feature_events_append_only
  BEFORE UPDATE OR DELETE ON public.farm_map_feature_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_sarina_spatial_event_mutation();
CREATE TRIGGER irrigation_network_edge_events_append_only
  BEFORE UPDATE OR DELETE ON public.irrigation_network_edge_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_sarina_spatial_event_mutation();
CREATE TRIGGER farm_tree_events_append_only
  BEFORE UPDATE OR DELETE ON public.farm_tree_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_sarina_spatial_event_mutation();

-- Retire records through status/lifecycle; client hard-deletes are not allowed.
REVOKE DELETE ON TABLE public.farm_assets FROM authenticated;
REVOKE DELETE ON TABLE public.farm_trees FROM authenticated;
REVOKE DELETE ON TABLE public.farm_map_features FROM authenticated;
REVOKE DELETE ON TABLE public.irrigation_network_edges FROM authenticated;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'farm_asset_events', 'farm_map_feature_events', 'irrigation_network_edge_events'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', v_table);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', v_table);
    EXECUTE format('GRANT SELECT, INSERT ON TABLE public.%I TO authenticated', v_table);
  END LOOP;
END;
$$;

-- Farmer read/append and contracted-expert/organization read follow existing farm scope.
CREATE POLICY farmer_read_farm_asset_events ON public.farm_asset_events
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.farms f JOIN public.users u ON u.id = f.owner_user_id
    WHERE f.id = farm_asset_events.farm_id AND u.auth_user_id = (SELECT auth.uid())
  ));
CREATE POLICY farmer_append_farm_asset_events ON public.farm_asset_events
  FOR INSERT TO authenticated WITH CHECK (
    event_source = 'farmer_reported' AND EXISTS (
      SELECT 1 FROM public.farms f JOIN public.users u ON u.id = f.owner_user_id
      WHERE f.id = farm_asset_events.farm_id AND u.auth_user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY expert_read_farm_asset_events ON public.farm_asset_events
  FOR SELECT TO authenticated USING (public.is_current_user_active_expert_for_farm(farm_id));
CREATE POLICY organization_read_farm_asset_events ON public.farm_asset_events
  FOR SELECT TO authenticated USING (public.is_sarina_admin() OR EXISTS (
    SELECT 1 FROM public.farms f JOIN public.organization_members om ON true
    WHERE f.id = farm_asset_events.farm_id
      AND public.organization_has_scoped_access(
        om.organization_id, 'oversight.farm.read', f.owner_user_id, f.country_id, f.id
      )
  ));

CREATE POLICY farmer_read_farm_map_feature_events ON public.farm_map_feature_events
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.farms f JOIN public.users u ON u.id = f.owner_user_id
    WHERE f.id = farm_map_feature_events.farm_id AND u.auth_user_id = (SELECT auth.uid())
  ));
CREATE POLICY farmer_append_farm_map_feature_events ON public.farm_map_feature_events
  FOR INSERT TO authenticated WITH CHECK (
    event_source = 'farmer_reported' AND EXISTS (
      SELECT 1 FROM public.farms f JOIN public.users u ON u.id = f.owner_user_id
      WHERE f.id = farm_map_feature_events.farm_id AND u.auth_user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY expert_read_farm_map_feature_events ON public.farm_map_feature_events
  FOR SELECT TO authenticated USING (public.is_current_user_active_expert_for_farm(farm_id));
CREATE POLICY organization_read_farm_map_feature_events ON public.farm_map_feature_events
  FOR SELECT TO authenticated USING (public.is_sarina_admin() OR EXISTS (
    SELECT 1 FROM public.farms f JOIN public.organization_members om ON true
    WHERE f.id = farm_map_feature_events.farm_id
      AND public.organization_has_scoped_access(
        om.organization_id, 'oversight.farm.read', f.owner_user_id, f.country_id, f.id
      )
  ));

CREATE POLICY farmer_read_irrigation_network_edge_events ON public.irrigation_network_edge_events
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.farms f JOIN public.users u ON u.id = f.owner_user_id
    WHERE f.id = irrigation_network_edge_events.farm_id AND u.auth_user_id = (SELECT auth.uid())
  ));
CREATE POLICY farmer_append_irrigation_network_edge_events ON public.irrigation_network_edge_events
  FOR INSERT TO authenticated WITH CHECK (
    event_source = 'farmer_reported' AND EXISTS (
      SELECT 1 FROM public.farms f JOIN public.users u ON u.id = f.owner_user_id
      WHERE f.id = irrigation_network_edge_events.farm_id AND u.auth_user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY expert_read_irrigation_network_edge_events ON public.irrigation_network_edge_events
  FOR SELECT TO authenticated USING (public.is_current_user_active_expert_for_farm(farm_id));
CREATE POLICY organization_read_irrigation_network_edge_events ON public.irrigation_network_edge_events
  FOR SELECT TO authenticated USING (public.is_sarina_admin() OR EXISTS (
    SELECT 1 FROM public.farms f JOIN public.organization_members om ON true
    WHERE f.id = irrigation_network_edge_events.farm_id
      AND public.organization_has_scoped_access(
        om.organization_id, 'oversight.farm.read', f.owner_user_id, f.country_id, f.id
      )
  ));

COMMIT;
