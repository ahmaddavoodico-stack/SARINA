-- SARINA farm-map spatial model V1.
-- Branch-only migration. Do not apply to the connected/live Supabase project
-- without separate explicit authorization and a reviewed non-production target.
-- Requires 20261127160000_farmer_confirmed_farm_asset_locations.sql first.

BEGIN;

-- Composite keys make same-farm references enforceable by PostgreSQL.
CREATE UNIQUE INDEX IF NOT EXISTS crop_cycles_id_farm_id_uidx
  ON public.crop_cycles (id, farm_id);

-- Individual tree registry. Crop/variety identity remains canonical in crop_cycles.
CREATE TABLE public.farm_trees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  field_id uuid NULL,
  crop_cycle_id uuid NULL,
  tree_code text NULL,
  location public.geometry(Point, 4326) NULL,
  location_source text NULL,
  position_accuracy_m numeric(10,2) NULL,
  is_location_confirmed boolean NOT NULL DEFAULT false,
  location_confirmed_at timestamptz NULL,
  planting_date date NULL,
  age_years numeric(6,2) NULL,
  age_source text NULL,
  age_observed_at timestamptz NULL,
  lifecycle_status text NOT NULL DEFAULT 'unknown',
  death_date date NULL,
  death_cause text NULL,
  death_evidence_source text NULL,
  replaced_by_tree_id uuid NULL,
  notes text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT farm_trees_id_farm_id_key UNIQUE (id, farm_id),
  CONSTRAINT farm_trees_field_farm_fkey
    FOREIGN KEY (field_id, farm_id)
    REFERENCES public.farm_fields(id, farm_id)
    ON DELETE RESTRICT,
  CONSTRAINT farm_trees_crop_cycle_farm_fkey
    FOREIGN KEY (crop_cycle_id, farm_id)
    REFERENCES public.crop_cycles(id, farm_id)
    ON DELETE RESTRICT,
  CONSTRAINT farm_trees_replacement_same_farm_fkey
    FOREIGN KEY (replaced_by_tree_id, farm_id)
    REFERENCES public.farm_trees(id, farm_id)
    ON DELETE RESTRICT,
  CONSTRAINT farm_trees_not_self_replaced_check
    CHECK (replaced_by_tree_id IS NULL OR replaced_by_tree_id <> id),
  CONSTRAINT farm_trees_code_check
    CHECK (tree_code IS NULL OR length(btrim(tree_code)) BETWEEN 1 AND 80),
  CONSTRAINT farm_trees_location_source_check
    CHECK (location_source IS NULL OR location_source IN ('farmer_pin', 'device_gps', 'surveyed', 'imported_verified')),
  CONSTRAINT farm_trees_accuracy_check
    CHECK (position_accuracy_m IS NULL OR position_accuracy_m BETWEEN 0 AND 10000),
  CONSTRAINT farm_trees_location_geometry_check
    CHECK (
      location IS NULL OR (
        public.ST_SRID(location) = 4326
        AND NOT public.ST_IsEmpty(location)
        AND public.ST_X(location) BETWEEN -180 AND 180
        AND public.ST_Y(location) BETWEEN -90 AND 90
      )
    ),
  CONSTRAINT farm_trees_confirmation_check
    CHECK (
      (is_location_confirmed = false AND location_confirmed_at IS NULL)
      OR (is_location_confirmed = true AND location IS NOT NULL AND location_confirmed_at IS NOT NULL)
    ),
  CONSTRAINT farm_trees_age_check CHECK (age_years IS NULL OR age_years BETWEEN 0 AND 200),
  CONSTRAINT farm_trees_lifecycle_check
    CHECK (lifecycle_status IN ('alive', 'dead', 'removed', 'unknown')),
  CONSTRAINT farm_trees_death_source_check
    CHECK (death_evidence_source IS NULL OR death_evidence_source IN ('farmer_reported', 'specialist_assessed', 'unknown')),
  CONSTRAINT farm_trees_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE UNIQUE INDEX farm_trees_farm_tree_code_uidx
  ON public.farm_trees (farm_id, tree_code)
  WHERE tree_code IS NOT NULL;
CREATE INDEX farm_trees_farm_field_idx ON public.farm_trees (farm_id, field_id);
CREATE INDEX farm_trees_crop_cycle_idx ON public.farm_trees (crop_cycle_id, farm_id)
  WHERE crop_cycle_id IS NOT NULL;
CREATE INDEX farm_trees_confirmed_location_gix
  ON public.farm_trees USING gist (location)
  WHERE is_location_confirmed = true AND lifecycle_status IN ('alive', 'unknown');

COMMENT ON TABLE public.farm_trees IS
  'Stable individual tree identities. Dead/removed trees remain registered; replacements receive new IDs.';
COMMENT ON COLUMN public.farm_trees.age_years IS
  'Observed or estimated age; age_source and age_observed_at preserve provenance.';
COMMENT ON COLUMN public.farm_trees.death_cause IS
  'Reported cause only. death_evidence_source distinguishes farmer report from specialist assessment.';

-- Append-only tree history. Updates/deletes are deliberately not granted to clients.
CREATE TABLE public.farm_tree_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  tree_id uuid NOT NULL,
  event_type text NOT NULL,
  event_source text NOT NULL DEFAULT 'system',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  event_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT farm_tree_events_tree_farm_fkey
    FOREIGN KEY (tree_id, farm_id)
    REFERENCES public.farm_trees(id, farm_id)
    ON DELETE RESTRICT,
  CONSTRAINT farm_tree_events_type_check
    CHECK (event_type IN ('tree_created', 'lifecycle_changed', 'location_changed', 'replacement_linked', 'tree_details_changed')),
  CONSTRAINT farm_tree_events_source_check
    CHECK (event_source IN ('system', 'farmer_reported', 'specialist_assessed', 'imported')),
  CONSTRAINT farm_tree_events_details_object_check CHECK (jsonb_typeof(event_details) = 'object')
);
CREATE INDEX farm_tree_events_tree_time_idx
  ON public.farm_tree_events (tree_id, occurred_at DESC);

-- Non-point features: line and polygon geometry only.
CREATE TABLE public.farm_map_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  field_id uuid NULL,
  crop_cycle_id uuid NULL,
  feature_type text NOT NULL,
  geometry public.geometry(Geometry, 4326) NOT NULL,
  geometry_source text NOT NULL DEFAULT 'farmer_drawn',
  position_accuracy_m numeric(10,2) NULL,
  is_geometry_confirmed boolean NOT NULL DEFAULT false,
  geometry_confirmed_at timestamptz NULL,
  status text NOT NULL DEFAULT 'active',
  width_m numeric(12,3) NULL,
  depth_m numeric(12,3) NULL,
  length_m numeric(12,3) NULL,
  capacity_value numeric(14,3) NULL,
  capacity_unit text NULL,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT farm_map_features_id_farm_id_key UNIQUE (id, farm_id),
  CONSTRAINT farm_map_features_field_farm_fkey
    FOREIGN KEY (field_id, farm_id)
    REFERENCES public.farm_fields(id, farm_id)
    ON DELETE RESTRICT,
  CONSTRAINT farm_map_features_crop_cycle_farm_fkey
    FOREIGN KEY (crop_cycle_id, farm_id)
    REFERENCES public.crop_cycles(id, farm_id)
    ON DELETE RESTRICT,
  CONSTRAINT farm_map_features_type_check CHECK (
    feature_type IN (
      'pond', 'reservoir', 'greenhouse', 'building', 'crop_plot', 'irrigation_zone',
      'drain', 'canal', 'irrigation_pipe', 'irrigation_main', 'irrigation_lateral',
      'fence', 'farm_route'
    )
  ),
  CONSTRAINT farm_map_features_geometry_family_check CHECK (
    public.GeometryType(geometry) IN ('LINESTRING', 'MULTILINESTRING', 'POLYGON', 'MULTIPOLYGON')
    AND (
      (feature_type IN ('drain', 'canal', 'irrigation_pipe', 'irrigation_main', 'irrigation_lateral', 'fence', 'farm_route')
        AND public.GeometryType(geometry) IN ('LINESTRING', 'MULTILINESTRING'))
      OR
      (feature_type IN ('pond', 'reservoir', 'greenhouse', 'building', 'crop_plot', 'irrigation_zone')
        AND public.GeometryType(geometry) IN ('POLYGON', 'MULTIPOLYGON'))
    )
  ),
  CONSTRAINT farm_map_features_geometry_valid_check
    CHECK (NOT public.ST_IsEmpty(geometry) AND public.ST_IsValid(geometry)),
  CONSTRAINT farm_map_features_confirmation_check
    CHECK (
      (is_geometry_confirmed = false AND geometry_confirmed_at IS NULL)
      OR (is_geometry_confirmed = true AND geometry_confirmed_at IS NOT NULL)
    ),
  CONSTRAINT farm_map_features_crop_cycle_role_check
    CHECK (
      (feature_type = 'crop_plot' AND crop_cycle_id IS NOT NULL)
      OR (feature_type <> 'crop_plot' AND crop_cycle_id IS NULL)
    ),
  CONSTRAINT farm_map_features_accuracy_check
    CHECK (position_accuracy_m IS NULL OR position_accuracy_m BETWEEN 0 AND 10000),
  CONSTRAINT farm_map_features_dimensions_check
    CHECK (
      (width_m IS NULL OR width_m >= 0)
      AND (depth_m IS NULL OR depth_m >= 0)
      AND (length_m IS NULL OR length_m >= 0)
      AND (capacity_value IS NULL OR capacity_value >= 0)
    ),
  CONSTRAINT farm_map_features_source_check
    CHECK (geometry_source IN ('farmer_drawn', 'device_gps', 'surveyed', 'imported_verified', 'specialist_drawn')),
  CONSTRAINT farm_map_features_status_check CHECK (status IN ('active', 'inactive', 'retired', 'removed')),
  CONSTRAINT farm_map_features_attributes_object_check CHECK (jsonb_typeof(attributes) = 'object')
);
CREATE INDEX farm_map_features_farm_type_status_idx
  ON public.farm_map_features (farm_id, feature_type, status);
CREATE INDEX farm_map_features_field_idx
  ON public.farm_map_features (field_id, farm_id) WHERE field_id IS NOT NULL;
CREATE INDEX farm_map_features_crop_cycle_idx
  ON public.farm_map_features (crop_cycle_id, farm_id) WHERE crop_cycle_id IS NOT NULL;
CREATE INDEX farm_map_features_geometry_gix
  ON public.farm_map_features USING gist (geometry);

-- Explicit irrigation graph edges. Geometry proximity never creates a connection.
CREATE TABLE public.irrigation_network_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  line_feature_id uuid NOT NULL,
  from_asset_id uuid NULL,
  to_asset_id uuid NULL,
  irrigation_zone_feature_id uuid NULL,
  flow_direction text NOT NULL DEFAULT 'unknown',
  network_role text NOT NULL DEFAULT 'distribution',
  status text NOT NULL DEFAULT 'draft',
  is_connection_confirmed boolean NOT NULL DEFAULT false,
  connection_confirmed_at timestamptz NULL,
  connection_source text NOT NULL DEFAULT 'farmer_reported',
  notes text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT irrigation_network_edges_line_farm_fkey
    FOREIGN KEY (line_feature_id, farm_id)
    REFERENCES public.farm_map_features(id, farm_id)
    ON DELETE RESTRICT,
  CONSTRAINT irrigation_network_edges_from_asset_farm_fkey
    FOREIGN KEY (from_asset_id, farm_id)
    REFERENCES public.farm_assets(id, farm_id)
    ON DELETE RESTRICT,
  CONSTRAINT irrigation_network_edges_to_asset_farm_fkey
    FOREIGN KEY (to_asset_id, farm_id)
    REFERENCES public.farm_assets(id, farm_id)
    ON DELETE RESTRICT,
  CONSTRAINT irrigation_network_edges_zone_farm_fkey
    FOREIGN KEY (irrigation_zone_feature_id, farm_id)
    REFERENCES public.farm_map_features(id, farm_id)
    ON DELETE RESTRICT,
  CONSTRAINT irrigation_network_edges_endpoint_check
    CHECK (from_asset_id IS NOT NULL OR to_asset_id IS NOT NULL),
  CONSTRAINT irrigation_network_edges_distinct_endpoints_check
    CHECK (from_asset_id IS NULL OR to_asset_id IS NULL OR from_asset_id <> to_asset_id),
  CONSTRAINT irrigation_network_edges_flow_check
    CHECK (flow_direction IN ('forward', 'reverse', 'bidirectional', 'unknown')),
  CONSTRAINT irrigation_network_edges_role_check
    CHECK (network_role IN ('supply', 'distribution', 'drainage', 'other')),
  CONSTRAINT irrigation_network_edges_status_check
    CHECK (status IN ('draft', 'active', 'inactive', 'retired')),
  CONSTRAINT irrigation_network_edges_confirmation_check
    CHECK (
      (is_connection_confirmed = false AND connection_confirmed_at IS NULL)
      OR (is_connection_confirmed = true AND connection_confirmed_at IS NOT NULL)
    ),
  CONSTRAINT irrigation_network_edges_source_check
    CHECK (connection_source IN ('farmer_reported', 'specialist_assessed', 'surveyed', 'imported_verified')),
  CONSTRAINT irrigation_network_edges_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);
CREATE INDEX irrigation_network_edges_farm_status_idx
  ON public.irrigation_network_edges (farm_id, status);
CREATE INDEX irrigation_network_edges_line_idx
  ON public.irrigation_network_edges (line_feature_id, farm_id);
CREATE INDEX irrigation_network_edges_from_asset_idx
  ON public.irrigation_network_edges (from_asset_id, farm_id) WHERE from_asset_id IS NOT NULL;
CREATE INDEX irrigation_network_edges_to_asset_idx
  ON public.irrigation_network_edges (to_asset_id, farm_id) WHERE to_asset_id IS NOT NULL;

-- Geometry and topology validation. A confirmed child must fit within a confirmed field.
CREATE OR REPLACE FUNCTION public.validate_farm_tree_spatial_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_boundary public.geometry;
  v_boundary_confirmed_at timestamptz;
  v_cursor uuid;
BEGIN
  NEW.updated_at := now();

  IF NEW.is_location_confirmed AND NEW.field_id IS NOT NULL THEN
    SELECT ff.boundary, ff.boundary_confirmed_at
      INTO v_boundary, v_boundary_confirmed_at
    FROM public.farm_fields ff
    WHERE ff.id = NEW.field_id AND ff.farm_id = NEW.farm_id;

    IF v_boundary IS NULL OR v_boundary_confirmed_at IS NULL THEN
      RAISE EXCEPTION 'A confirmed field boundary is required before confirming a tree location'
        USING ERRCODE = '23514';
    END IF;
    IF NOT public.ST_Covers(v_boundary, NEW.location) THEN
      RAISE EXCEPTION 'Confirmed tree location must be covered by its confirmed field boundary'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.replaced_by_tree_id IS NOT NULL THEN
    IF NEW.lifecycle_status NOT IN ('dead', 'removed') THEN
      RAISE EXCEPTION 'Only a dead or removed tree can link to a replacement tree'
        USING ERRCODE = '23514';
    END IF;

    WITH RECURSIVE replacement_chain(id) AS (
      SELECT NEW.replaced_by_tree_id
      UNION
      SELECT t.replaced_by_tree_id
      FROM public.farm_trees t
      JOIN replacement_chain rc ON t.id = rc.id
      WHERE t.farm_id = NEW.farm_id AND t.replaced_by_tree_id IS NOT NULL
    )
    SELECT id INTO v_cursor FROM replacement_chain WHERE id = NEW.id LIMIT 1;

    IF v_cursor IS NOT NULL THEN
      RAISE EXCEPTION 'Tree replacement links cannot create a cycle'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER farm_trees_validate_spatial_state
  BEFORE INSERT OR UPDATE ON public.farm_trees
  FOR EACH ROW EXECUTE FUNCTION public.validate_farm_tree_spatial_state();

CREATE OR REPLACE FUNCTION public.validate_farm_map_feature_spatial_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_boundary public.geometry;
  v_boundary_confirmed_at timestamptz;
  v_cycle_field_id uuid;
BEGIN
  NEW.updated_at := now();

  IF NEW.feature_type = 'crop_plot' THEN
    SELECT cc.field_id INTO v_cycle_field_id
    FROM public.crop_cycles cc
    WHERE cc.id = NEW.crop_cycle_id AND cc.farm_id = NEW.farm_id;

    IF v_cycle_field_id IS NOT NULL AND NEW.field_id IS DISTINCT FROM v_cycle_field_id THEN
      RAISE EXCEPTION 'Crop plot field must match the field assigned to its crop cycle'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.is_geometry_confirmed AND NEW.field_id IS NOT NULL THEN
    SELECT ff.boundary, ff.boundary_confirmed_at
      INTO v_boundary, v_boundary_confirmed_at
    FROM public.farm_fields ff
    WHERE ff.id = NEW.field_id AND ff.farm_id = NEW.farm_id;

    IF v_boundary IS NULL OR v_boundary_confirmed_at IS NULL THEN
      RAISE EXCEPTION 'A confirmed field boundary is required before confirming a map feature'
        USING ERRCODE = '23514';
    END IF;
    IF NOT public.ST_Covers(v_boundary, NEW.geometry) THEN
      RAISE EXCEPTION 'Confirmed feature geometry must be covered by its confirmed field boundary'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER farm_map_features_validate_spatial_state
  BEFORE INSERT OR UPDATE ON public.farm_map_features
  FOR EACH ROW EXECUTE FUNCTION public.validate_farm_map_feature_spatial_state();

CREATE OR REPLACE FUNCTION public.validate_irrigation_network_edge()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_line_type text;
  v_line_confirmed boolean;
  v_from_confirmed boolean;
  v_to_confirmed boolean;
  v_zone_type text;
  v_zone_confirmed boolean;
BEGIN
  SELECT feature_type, is_geometry_confirmed
    INTO v_line_type, v_line_confirmed
  FROM public.farm_map_features
  WHERE id = NEW.line_feature_id AND farm_id = NEW.farm_id;

  IF v_line_type NOT IN ('canal', 'irrigation_pipe', 'irrigation_main', 'irrigation_lateral') THEN
    RAISE EXCEPTION 'Irrigation network edge must reference a canal or irrigation-line feature'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.from_asset_id IS NOT NULL THEN
    SELECT is_location_confirmed INTO v_from_confirmed
    FROM public.farm_assets WHERE id = NEW.from_asset_id AND farm_id = NEW.farm_id;
  END IF;
  IF NEW.to_asset_id IS NOT NULL THEN
    SELECT is_location_confirmed INTO v_to_confirmed
    FROM public.farm_assets WHERE id = NEW.to_asset_id AND farm_id = NEW.farm_id;
  END IF;

  IF NEW.irrigation_zone_feature_id IS NOT NULL THEN
    SELECT feature_type, is_geometry_confirmed
      INTO v_zone_type, v_zone_confirmed
    FROM public.farm_map_features
    WHERE id = NEW.irrigation_zone_feature_id AND farm_id = NEW.farm_id;

    IF v_zone_type <> 'irrigation_zone' THEN
      RAISE EXCEPTION 'Network zone reference must point to an irrigation_zone feature'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.is_connection_confirmed THEN
    IF NOT v_line_confirmed THEN
      RAISE EXCEPTION 'The irrigation line geometry must be confirmed first'
        USING ERRCODE = '23514';
    END IF;
    IF (NEW.from_asset_id IS NOT NULL AND NOT COALESCE(v_from_confirmed, false))
       OR (NEW.to_asset_id IS NOT NULL AND NOT COALESCE(v_to_confirmed, false)) THEN
      RAISE EXCEPTION 'All declared endpoint asset locations must be confirmed'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.irrigation_zone_feature_id IS NOT NULL AND NOT COALESCE(v_zone_confirmed, false) THEN
      RAISE EXCEPTION 'The irrigation zone geometry must be confirmed first'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER irrigation_network_edges_validate
  BEFORE INSERT OR UPDATE ON public.irrigation_network_edges
  FOR EACH ROW EXECUTE FUNCTION public.validate_irrigation_network_edge();

-- Automatically append a minimal history event for creation and meaningful tree edits.
CREATE OR REPLACE FUNCTION public.append_farm_tree_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_type text;
  v_details jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_type := 'tree_created';
    v_details := jsonb_build_object(
      'lifecycle_status', NEW.lifecycle_status,
      'location_confirmed', NEW.is_location_confirmed,
      'field_id', NEW.field_id,
      'crop_cycle_id', NEW.crop_cycle_id
    );
  ELSE
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
    farm_id, tree_id, event_type, event_source, actor_auth_user_id, event_details
  ) VALUES (
    NEW.farm_id, NEW.id, v_type, 'system', auth.uid(), v_details
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER farm_trees_append_history
  AFTER INSERT OR UPDATE ON public.farm_trees
  FOR EACH ROW EXECUTE FUNCTION public.append_farm_tree_event();

-- RLS: farmers manage only their own farm; active contracted experts and
-- explicitly scoped oversight organizations receive read-only access.
DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'farm_trees', 'farm_tree_events', 'farm_map_features', 'irrigation_network_edges'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', v_table);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', v_table);
  END LOOP;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.farm_trees TO authenticated;
GRANT SELECT, INSERT ON TABLE public.farm_tree_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.farm_map_features TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.irrigation_network_edges TO authenticated;

-- Farm trees
CREATE POLICY farmer_manage_farm_trees ON public.farm_trees
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.farms f
    JOIN public.users u ON u.id = f.owner_user_id
    WHERE f.id = farm_trees.farm_id AND u.auth_user_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.farms f
    JOIN public.users u ON u.id = f.owner_user_id
    WHERE f.id = farm_trees.farm_id AND u.auth_user_id = (SELECT auth.uid())
  ));
CREATE POLICY expert_read_farm_trees ON public.farm_trees
  FOR SELECT TO authenticated
  USING (public.is_current_user_active_expert_for_farm(farm_id));
CREATE POLICY organization_read_farm_trees ON public.farm_trees
  FOR SELECT TO authenticated
  USING (public.is_sarina_admin() OR EXISTS (
    SELECT 1 FROM public.farms f
    JOIN public.organization_members om ON true
    WHERE f.id = farm_trees.farm_id
      AND public.organization_has_scoped_access(
        om.organization_id, 'oversight.farm.read', f.owner_user_id, f.country_id, f.id
      )
  ));

-- Tree history: append-only for clients.
CREATE POLICY farmer_read_farm_tree_events ON public.farm_tree_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.farms f
    JOIN public.users u ON u.id = f.owner_user_id
    WHERE f.id = farm_tree_events.farm_id AND u.auth_user_id = (SELECT auth.uid())
  ));
CREATE POLICY farmer_append_farm_tree_events ON public.farm_tree_events
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.farms f
    JOIN public.users u ON u.id = f.owner_user_id
    WHERE f.id = farm_tree_events.farm_id AND u.auth_user_id = (SELECT auth.uid())
  ));
CREATE POLICY expert_read_farm_tree_events ON public.farm_tree_events
  FOR SELECT TO authenticated
  USING (public.is_current_user_active_expert_for_farm(farm_id));
CREATE POLICY organization_read_farm_tree_events ON public.farm_tree_events
  FOR SELECT TO authenticated
  USING (public.is_sarina_admin() OR EXISTS (
    SELECT 1 FROM public.farms f
    JOIN public.organization_members om ON true
    WHERE f.id = farm_tree_events.farm_id
      AND public.organization_has_scoped_access(
        om.organization_id, 'oversight.farm.read', f.owner_user_id, f.country_id, f.id
      )
  ));

-- Spatial features
CREATE POLICY farmer_manage_farm_map_features ON public.farm_map_features
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.farms f
    JOIN public.users u ON u.id = f.owner_user_id
    WHERE f.id = farm_map_features.farm_id AND u.auth_user_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.farms f
    JOIN public.users u ON u.id = f.owner_user_id
    WHERE f.id = farm_map_features.farm_id AND u.auth_user_id = (SELECT auth.uid())
  ));
CREATE POLICY expert_read_farm_map_features ON public.farm_map_features
  FOR SELECT TO authenticated
  USING (public.is_current_user_active_expert_for_farm(farm_id));
CREATE POLICY organization_read_farm_map_features ON public.farm_map_features
  FOR SELECT TO authenticated
  USING (public.is_sarina_admin() OR EXISTS (
    SELECT 1 FROM public.farms f
    JOIN public.organization_members om ON true
    WHERE f.id = farm_map_features.farm_id
      AND public.organization_has_scoped_access(
        om.organization_id, 'oversight.farm.read', f.owner_user_id, f.country_id, f.id
      )
  ));

-- Irrigation network edges
CREATE POLICY farmer_manage_irrigation_network_edges ON public.irrigation_network_edges
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.farms f
    JOIN public.users u ON u.id = f.owner_user_id
    WHERE f.id = irrigation_network_edges.farm_id AND u.auth_user_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.farms f
    JOIN public.users u ON u.id = f.owner_user_id
    WHERE f.id = irrigation_network_edges.farm_id AND u.auth_user_id = (SELECT auth.uid())
  ));
CREATE POLICY expert_read_irrigation_network_edges ON public.irrigation_network_edges
  FOR SELECT TO authenticated
  USING (public.is_current_user_active_expert_for_farm(farm_id));
CREATE POLICY organization_read_irrigation_network_edges ON public.irrigation_network_edges
  FOR SELECT TO authenticated
  USING (public.is_sarina_admin() OR EXISTS (
    SELECT 1 FROM public.farms f
    JOIN public.organization_members om ON true
    WHERE f.id = irrigation_network_edges.farm_id
      AND public.organization_has_scoped_access(
        om.organization_id, 'oversight.farm.read', f.owner_user_id, f.country_id, f.id
      )
  ));

COMMIT;
