-- Historical compatibility marker.
-- This migration was applied directly to the live SARINA database before the
-- education schema migration was added to the repository. Keep this version
-- as a no-op for clean installs; the actual policies are created after the
-- education tables by 20261120020000_education_public_read_and_owner_activity_policies.sql.
DO $$
BEGIN
  IF to_regclass('public.educational_contents') IS NULL THEN
    RAISE NOTICE 'Education schema is not present yet; policies will be created by the later migration.';
  END IF;
END
$$;
