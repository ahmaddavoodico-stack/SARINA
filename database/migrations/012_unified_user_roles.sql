-- SARINA unified account roles and post-login onboarding (v1)
-- Ordinary activity roles are self-selectable; privileged roles remain server-controlled.
INSERT INTO public.roles (code,name,description) VALUES
 ('farmer','Farmer','Agricultural production and farm management'),
 ('livestock_keeper','Livestock keeper','Livestock and animal husbandry activities'),
 ('expert','Expert applicant','Human expert profile; professional verification is separate'),
 ('organization','Organization representative','Company or institution workspace applicant')
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description;

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_global_role_unique
 ON public.user_roles(user_id,role_id) WHERE scope_type='global' AND scope_id IS NULL;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sarina_roles_catalog_read ON public.roles;
CREATE POLICY sarina_roles_catalog_read ON public.roles FOR SELECT TO authenticated USING(true);
DROP POLICY IF EXISTS sarina_user_roles_self_read ON public.user_roles;
CREATE POLICY sarina_user_roles_self_read ON public.user_roles FOR SELECT TO authenticated USING (
 user_id=(SELECT u.id FROM public.users u WHERE u.auth_user_id=(SELECT auth.uid()) LIMIT 1)
);
REVOKE ALL PRIVILEGES ON TABLE public.roles,public.user_roles,public.permissions,public.role_permissions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.roles,public.user_roles TO authenticated;

CREATE OR REPLACE FUNCTION public.set_my_sarina_roles(p_role_codes text[])
RETURNS TABLE(role_code text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $function$
DECLARE v_user_id uuid; v_requested text[];
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='28000'; END IF;
 SELECT u.id INTO v_user_id FROM public.users u WHERE u.auth_user_id=auth.uid() LIMIT 1;
 IF v_user_id IS NULL THEN RAISE EXCEPTION 'SARINA profile not found' USING ERRCODE='P0002'; END IF;
 SELECT array_agg(DISTINCT code ORDER BY code) INTO v_requested
 FROM unnest(COALESCE(p_role_codes,ARRAY[]::text[])) requested(code)
 WHERE code IS NOT NULL AND btrim(code)<>'';
 IF v_requested IS NULL OR cardinality(v_requested)=0 THEN RAISE EXCEPTION 'Select at least one activity'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(v_requested) requested(code) WHERE code NOT IN ('farmer','livestock_keeper','expert','organization')) THEN
  RAISE EXCEPTION 'One or more roles cannot be self-assigned' USING ERRCODE='42501';
 END IF;
 IF EXISTS(SELECT 1 FROM unnest(v_requested) requested(code) LEFT JOIN public.roles r ON r.code=requested.code WHERE r.id IS NULL) THEN
  RAISE EXCEPTION 'Requested role is not available';
 END IF;
 DELETE FROM public.user_roles ur USING public.roles r
 WHERE ur.role_id=r.id AND ur.user_id=v_user_id AND ur.scope_type='global' AND ur.scope_id IS NULL
 AND r.code IN ('farmer','livestock_keeper','expert','organization');
 INSERT INTO public.user_roles(user_id,role_id,scope_type,scope_id,granted_by)
 SELECT v_user_id,r.id,'global',NULL,v_user_id FROM public.roles r WHERE r.code=ANY(v_requested)
 ON CONFLICT(user_id,role_id) WHERE scope_type='global' AND scope_id IS NULL DO NOTHING;
 RETURN QUERY SELECT r.code FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id
 WHERE ur.user_id=v_user_id AND ur.scope_type='global' AND ur.scope_id IS NULL ORDER BY r.code;
END;$function$;
REVOKE ALL ON FUNCTION public.set_my_sarina_roles(text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_my_sarina_roles(text[]) TO authenticated;
COMMENT ON FUNCTION public.set_my_sarina_roles(text[]) IS
'Allows authenticated users to select ordinary SARINA activity roles only. Administrative and professional verification privileges remain server-controlled.';
