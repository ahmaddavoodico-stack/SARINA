-- Canonical point-only physical farm assets.
-- This migration is branch-only until explicitly reviewed and applied.
-- No coordinates are backfilled or inferred from farm/field centers.
-- Linear and polygonal infrastructure belongs in farm_map_features.
-- Individual trees belong in farm_trees, not in this point-asset table.

BEGIN;

-- A composite candidate key lets child rows prove both identity and farm scope.
CREATE UNIQUE INDEX IF NOT EXISTS farm_fields_id_farm_id_uidx
  ON public.farm_fields (id, farm_id);

CREATE TABLE IF NOT EXISTS public.farm_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  field_id uuid NULL,
  asset_type text NOT NULL,
  asset_name text NOT NULL,
  asset_code text NULL,
  location public.geometry(Point, 4326) NULL,
  location_source text NULL,
  position_accuracy_m numeric(10,2) NULL,
  is_location_confirmed boolean NOT NULL DEFAULT false,
  location_confirmed_at timestamptz NULL,
  status text NOT NULL DEFAULT 'active',
  notes text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT farm_assets_id_farm_id_key UNIQUE (id, farm_id),
  CONSTRAINT farm_assets_field_farm_fkey
    FOREIGN KEY (field_id, farm_id)
    REFERENCES public.farm_fields(id, farm_id)
    ON DELETE RESTRICT,
  CONSTRAINT farm_assets_asset_type_check CHECK (
    asset_type IN (
      'well', 'water_source', 'irrigation_pump', 'irrigation_valve',
      'water_tank', 'sensor', 'other'
    )
  ),
  CONSTRAINT farm_assets_asset_name_check CHECK (length(btrim(asset_name)) BETWEEN 1 AND 120),
  CONSTRAINT farm_assets_location_source_check CHECK (
    (location IS NULL AND location_source IS NULL)
    OR (location IS NOT NULL AND location_source IN ('farmer_pin', 'device_gps', 'surveyed', 'imported_verified'))
  ),
  CONSTRAINT farm_assets_accuracy_check CHECK (
    position_accuracy_m IS NULL OR position_accuracy_m BETWEEN 0 AND 10000
  ),
  CONSTRAINT farm_assets_location_geometry_check CHECK (
    location IS NULL OR (
      public.ST_SRID(location) = 4326
      AND NOT public.ST_IsEmpty(location)
      AND public.ST_X(location) BETWEEN -180 AND 180
      AND public.ST_Y(location) BETWEEN -90 AND 90
    )
  ),
  CONSTRAINT farm_assets_confirmation_timestamp_check CHECK (
    (is_location_confirmed = false AND location_confirmed_at IS NULL)
    OR (is_location_confirmed = true AND location IS NOT NULL AND location_confirmed_at IS NOT NULL)
  ),
  CONSTRAINT farm_assets_status_check CHECK (status IN ('active', 'inactive', 'retired', 'removed')),
  CONSTRAINT farm_assets_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);

COMMENT ON TABLE public.farm_assets IS
  'Point-like physical farm assets only. Trees use farm_trees; lines and areas use farm_map_features.';
COMMENT ON COLUMN public.farm_assets.location IS
  'Optional WGS84 point. A marker is verified only when is_location_confirmed is true.';
COMMENT ON COLUMN public.farm_assets.field_id IS
  'Optional containing field; composite FK guarantees the field belongs to the same farm.';

CREATE UNIQUE INDEX IF NOT EXISTS farm_assets_farm_asset_code_uidx
  ON public.farm_assets (farm_id, asset_code)
  WHERE asset_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS farm_assets_farm_status_idx
  ON public.farm_assets (farm_id, status);
CREATE INDEX IF NOT EXISTS farm_assets_field_idx
  ON public.farm_assets (field_id, farm_id)
  WHERE field_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS farm_assets_confirmed_location_gix
  ON public.farm_assets USING gist (location)
  WHERE is_location_confirmed = true AND status = 'active';

ALTER TABLE public.farm_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "farmer owns farm_assets" ON public.farm_assets;
CREATE POLICY "farmer owns farm_assets"
  ON public.farm_assets FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.farms f
      JOIN public.users u ON u.id = f.owner_user_id
      WHERE f.id = farm_assets.farm_id
        AND u.auth_user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.farms f
      JOIN public.users u ON u.id = f.owner_user_id
      WHERE f.id = farm_assets.farm_id
        AND u.auth_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS expert_contract_read_farm_assets ON public.farm_assets;
CREATE POLICY expert_contract_read_farm_assets
  ON public.farm_assets FOR SELECT TO authenticated
  USING (public.is_current_user_active_expert_for_farm(farm_id));

DROP POLICY IF EXISTS organization_scoped_read_farm_assets ON public.farm_assets;
CREATE POLICY organization_scoped_read_farm_assets
  ON public.farm_assets FOR SELECT TO authenticated
  USING (
    public.is_sarina_admin()
    OR EXISTS (
      SELECT 1
      FROM public.farms f
      JOIN public.organization_members om ON true
      WHERE f.id = farm_assets.farm_id
        AND public.organization_has_scoped_access(
          om.organization_id,
          'oversight.farm.read',
          f.owner_user_id,
          f.country_id,
          f.id
        )
    )
  );

-- RLS and SQL privileges are separate. Default privileges in this project
-- grant table access to anon; explicitly remove it for this table.
REVOKE ALL ON TABLE public.farm_assets FROM anon;
REVOKE ALL ON TABLE public.farm_assets FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.farm_assets TO authenticated;
GRANT ALL ON TABLE public.farm_assets TO service_role;

CREATE OR REPLACE FUNCTION public.validate_farm_asset_location()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_boundary public.geometry;
  v_boundary_confirmed_at timestamptz;
BEGIN
  NEW.updated_at := now();

  IF NEW.is_location_confirmed AND NEW.field_id IS NOT NULL THEN
    SELECT ff.boundary, ff.boundary_confirmed_at
      INTO v_boundary, v_boundary_confirmed_at
    FROM public.farm_fields ff
    WHERE ff.id = NEW.field_id AND ff.farm_id = NEW.farm_id;

    IF v_boundary IS NULL OR v_boundary_confirmed_at IS NULL THEN
      RAISE EXCEPTION 'A confirmed field boundary is required before confirming an asset location'
        USING ERRCODE = '23514';
    END IF;

    IF NOT public.ST_Covers(v_boundary, NEW.location) THEN
      RAISE EXCEPTION 'Confirmed asset location must be covered by its confirmed field boundary'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_farm_asset_location() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS farm_assets_validate_location ON public.farm_assets;
DROP TRIGGER IF EXISTS farm_assets_validate_field_scope ON public.farm_assets;
CREATE TRIGGER farm_assets_validate_location
  BEFORE INSERT OR UPDATE ON public.farm_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_farm_asset_location();

COMMIT;
