-- Canonical, farmer-confirmed point locations for physical farm assets.
-- This migration is branch-only until explicitly reviewed and applied.
-- It does not backfill coordinates or convert approximate farm/field centers into assets.

BEGIN;

CREATE TABLE IF NOT EXISTS public.farm_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  field_id uuid NULL REFERENCES public.farm_fields(id) ON DELETE SET NULL,
  asset_type text NOT NULL,
  asset_name text NOT NULL,
  asset_code text NULL,
  location geometry(Point, 4326) NOT NULL,
  location_source text NOT NULL DEFAULT 'farmer_pin',
  position_accuracy_m numeric(10,2) NULL,
  is_location_confirmed boolean NOT NULL DEFAULT false,
  location_confirmed_at timestamptz NULL,
  status text NOT NULL DEFAULT 'active',
  notes text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT farm_assets_asset_type_check CHECK (
    asset_type IN (
      'tree', 'irrigation_valve', 'irrigation_pump', 'irrigation_line',
      'water_tank', 'canal', 'drainage', 'building', 'sensor', 'other'
    )
  ),
  CONSTRAINT farm_assets_asset_name_check CHECK (length(btrim(asset_name)) BETWEEN 1 AND 120),
  CONSTRAINT farm_assets_location_source_check CHECK (
    location_source IN ('farmer_pin', 'device_gps', 'surveyed', 'imported_verified')
  ),
  CONSTRAINT farm_assets_accuracy_check CHECK (
    position_accuracy_m IS NULL OR position_accuracy_m BETWEEN 0 AND 10000
  ),
  CONSTRAINT farm_assets_location_coordinates_check CHECK (
    ST_X(location) BETWEEN -180 AND 180 AND ST_Y(location) BETWEEN -90 AND 90
  ),
  CONSTRAINT farm_assets_confirmation_timestamp_check CHECK (
    (is_location_confirmed = false AND location_confirmed_at IS NULL)
    OR (is_location_confirmed = true AND location_confirmed_at IS NOT NULL)
  ),
  CONSTRAINT farm_assets_status_check CHECK (status IN ('active', 'inactive', 'retired', 'removed')),
  CONSTRAINT farm_assets_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);

COMMENT ON TABLE public.farm_assets IS
  'Physical assets belonging to a farm. Map locations are explicit farmer-confirmed or verified points; never inferred from field centers.';
COMMENT ON COLUMN public.farm_assets.location IS
  'WGS84 point geometry (longitude, latitude). Only render as a verified map marker when is_location_confirmed is true.';
COMMENT ON COLUMN public.farm_assets.field_id IS
  'Optional containing field. Null means the asset is farm-level or has not been assigned to a field.';

CREATE INDEX IF NOT EXISTS farm_assets_farm_status_idx
  ON public.farm_assets (farm_id, status);
CREATE INDEX IF NOT EXISTS farm_assets_field_idx
  ON public.farm_assets (field_id) WHERE field_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS farm_assets_confirmed_location_gix
  ON public.farm_assets USING gist (location)
  WHERE is_location_confirmed = true AND status = 'active';

ALTER TABLE public.farm_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "farmer owns farm_assets" ON public.farm_assets;
CREATE POLICY "farmer owns farm_assets"
  ON public.farm_assets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.farms f
      JOIN public.users u ON u.id = f.owner_user_id
      WHERE f.id = farm_assets.farm_id
        AND u.auth_user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.farms f
      JOIN public.users u ON u.id = f.owner_user_id
      WHERE f.id = farm_assets.farm_id
        AND u.auth_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS expert_contract_read_farm_assets ON public.farm_assets;
CREATE POLICY expert_contract_read_farm_assets
  ON public.farm_assets
  FOR SELECT
  TO authenticated
  USING (public.is_current_user_active_expert_for_farm(farm_id));

CREATE OR REPLACE FUNCTION public.validate_farm_asset_field_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.field_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.farm_fields ff
    WHERE ff.id = NEW.field_id
      AND ff.farm_id = NEW.farm_id
  ) THEN
    RAISE EXCEPTION 'field_id must belong to the same farm as farm_assets.farm_id'
      USING ERRCODE = '23514';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS farm_assets_validate_field_scope ON public.farm_assets;
CREATE TRIGGER farm_assets_validate_field_scope
  BEFORE INSERT OR UPDATE OF farm_id, field_id, location, asset_type, asset_name,
    asset_code, location_source, position_accuracy_m, is_location_confirmed,
    location_confirmed_at, status, notes, metadata
  ON public.farm_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_farm_asset_field_scope();

COMMIT;
