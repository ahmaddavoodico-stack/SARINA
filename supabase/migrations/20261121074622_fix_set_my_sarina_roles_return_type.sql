CREATE OR REPLACE FUNCTION public.set_my_sarina_roles(p_role_codes text[])
 RETURNS TABLE(role_code text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_requested text[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT u.id INTO v_user_id
  FROM public.users AS u
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'SARINA profile not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT array_agg(DISTINCT code ORDER BY code)
  INTO v_requested
  FROM unnest(COALESCE(p_role_codes, ARRAY[]::text[])) AS requested(code)
  WHERE code IS NOT NULL AND btrim(code) <> '';

  IF v_requested IS NULL OR cardinality(v_requested) = 0 THEN
    RAISE EXCEPTION 'Select at least one activity';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(v_requested) AS requested(code)
    WHERE code NOT IN ('farmer', 'livestock_keeper', 'expert', 'organization')
  ) THEN
    RAISE EXCEPTION 'One or more roles cannot be self-assigned' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(v_requested) AS requested(code)
    LEFT JOIN public.roles AS r ON r.code = requested.code
    WHERE r.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Requested role is not available';
  END IF;

  DELETE FROM public.user_roles AS ur
  USING public.roles AS r
  WHERE ur.role_id = r.id
    AND ur.user_id = v_user_id
    AND ur.scope_type = 'global'
    AND ur.scope_id IS NULL
    AND r.code <> 'admin'
    AND r.code IN ('farmer', 'livestock_keeper', 'expert', 'organization');

  INSERT INTO public.user_roles (user_id, role_id, scope_type, scope_id, granted_by)
  SELECT v_user_id, r.id, 'global', NULL, v_user_id
  FROM public.roles AS r
  WHERE r.code = ANY(v_requested)
  ON CONFLICT (user_id, role_id) WHERE scope_type = 'global' AND scope_id IS NULL
  DO NOTHING;

  RETURN QUERY
  SELECT r.code::text
  FROM public.user_roles AS ur
  JOIN public.roles AS r ON r.id = ur.role_id
  WHERE ur.user_id = v_user_id AND ur.scope_type = 'global' AND ur.scope_id IS NULL
  ORDER BY r.code;
END;
$function$;
