-- SARINA | Migration 005: Central admin console read access
-- Allows only authenticated global SARINA administrators to list user profiles.
-- A private SECURITY DEFINER helper avoids RLS recursion and is not exposed through the Data API.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_sarina_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.users AS u
    JOIN public.user_roles AS ur ON ur.user_id = u.id
    JOIN public.roles AS r ON r.id = ur.role_id
    WHERE u.auth_user_id = (SELECT auth.uid())
      AND ur.scope_type = 'global'
      AND ur.scope_id IS NULL
      AND r.code = 'admin'
  );
$function$;

REVOKE ALL ON FUNCTION private.is_sarina_admin() FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_sarina_admin() TO authenticated;

GRANT SELECT ON TABLE public.users TO authenticated;

DROP POLICY IF EXISTS "sarina_admin_read_all_users" ON public.users;
CREATE POLICY "sarina_admin_read_all_users"
ON public.users
FOR SELECT
TO authenticated
USING (
  auth_user_id = (SELECT auth.uid())
  OR (SELECT private.is_sarina_admin())
);

COMMIT;
