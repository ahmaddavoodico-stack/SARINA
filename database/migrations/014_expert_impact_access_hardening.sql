-- Tighten client grants for expert impact and recognition data.
-- Supabase default privileges may have granted table access to anon; RLS alone is not a substitute for SQL privileges.
REVOKE ALL PRIVILEGES ON TABLE public.expert_impact_records FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.expert_impact_records TO authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.expert_impact_assessments FROM PUBLIC,anon,authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.expert_recognition_awards FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.expert_recognition_awards TO authenticated;