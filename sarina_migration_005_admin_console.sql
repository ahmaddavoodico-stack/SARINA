-- SARINA | Migration 005: Central admin console read access
-- Allows only authenticated global SARINA administrators to list user profiles.
-- Authorization is enforced in PostgreSQL through the existing is_sarina_admin() function.

BEGIN;

GRANT SELECT ON TABLE public.users TO authenticated;

DROP POLICY IF EXISTS "sarina_admin_read_all_users" ON public.users;
CREATE POLICY "sarina_admin_read_all_users"
ON public.users
FOR SELECT
TO authenticated
USING (public.is_sarina_admin());

COMMIT;
