-- SARINA expert impact, innovation and recognition foundation (v1)
-- Submitted evidence is owned by the expert; assessment and awards are system-controlled.
CREATE TABLE IF NOT EXISTS public.expert_impact_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 expert_profile_id uuid NOT NULL REFERENCES public.expert_profiles(id) ON DELETE CASCADE,
 consultation_id uuid REFERENCES public.expert_consultations(id) ON DELETE SET NULL,
 record_kind text NOT NULL CHECK (record_kind IN ('case_outcome','innovation')),
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 180),
 summary text NOT NULL CHECK (length(btrim(summary)) BETWEEN 10 AND 5000),
 problem_context jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(problem_context)='object'),
 baseline_metrics jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(baseline_metrics)='object'),
 outcome_metrics jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(outcome_metrics)='object'),
 expert_contribution text,
 innovation_details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(innovation_details)='object'),
 evidence_refs text[] NOT NULL DEFAULT ARRAY[]::text[],
 beneficiary_consent_at timestamptz,
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','withdrawn')),
 submitted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (status <> 'submitted' OR submitted_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS expert_impact_records_profile_status_idx ON public.expert_impact_records(expert_profile_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS expert_impact_records_consultation_idx ON public.expert_impact_records(consultation_id) WHERE consultation_id IS NOT NULL;
ALTER TABLE public.expert_impact_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS expert_impact_records_owner_select ON public.expert_impact_records;
CREATE POLICY expert_impact_records_owner_select ON public.expert_impact_records FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.expert_profiles ep WHERE ep.id=expert_impact_records.expert_profile_id AND ep.user_id=public.current_sarina_user_id()));
DROP POLICY IF EXISTS expert_impact_records_owner_insert ON public.expert_impact_records;
CREATE POLICY expert_impact_records_owner_insert ON public.expert_impact_records FOR INSERT TO authenticated WITH CHECK (status='draft' AND submitted_at IS NULL AND EXISTS (SELECT 1 FROM public.expert_profiles ep WHERE ep.id=expert_impact_records.expert_profile_id AND ep.user_id=public.current_sarina_user_id()));
DROP POLICY IF EXISTS expert_impact_records_owner_update_draft ON public.expert_impact_records;
CREATE POLICY expert_impact_records_owner_update_draft ON public.expert_impact_records FOR UPDATE TO authenticated USING (status='draft' AND EXISTS (SELECT 1 FROM public.expert_profiles ep WHERE ep.id=expert_impact_records.expert_profile_id AND ep.user_id=public.current_sarina_user_id())) WITH CHECK (status='draft' AND submitted_at IS NULL AND EXISTS (SELECT 1 FROM public.expert_profiles ep WHERE ep.id=expert_impact_records.expert_profile_id AND ep.user_id=public.current_sarina_user_id()));
GRANT SELECT,INSERT,UPDATE ON public.expert_impact_records TO authenticated;
REVOKE DELETE ON public.expert_impact_records FROM anon,authenticated;
CREATE TABLE IF NOT EXISTS public.expert_impact_assessments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 impact_record_id uuid NOT NULL REFERENCES public.expert_impact_records(id) ON DELETE CASCADE,
 assessment_version integer NOT NULL DEFAULT 1 CHECK (assessment_version > 0),
 technical_score numeric(5,2) CHECK (technical_score BETWEEN 0 AND 100),
 economic_score numeric(5,2) CHECK (economic_score BETWEEN 0 AND 100),
 innovation_score numeric(5,2) CHECK (innovation_score BETWEEN 0 AND 100),
 social_score numeric(5,2) CHECK (social_score BETWEEN 0 AND 100),
 sustainability_score numeric(5,2) CHECK (sustainability_score BETWEEN 0 AND 100),
 attribution_confidence text NOT NULL DEFAULT 'insufficient' CHECK (attribution_confidence IN ('insufficient','low','moderate','high')),
 confounding_factors jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(confounding_factors)='array'),
 reviewer_notes text,
 assessed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
 assessed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(impact_record_id,assessment_version)
);
ALTER TABLE public.expert_impact_assessments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.expert_impact_assessments FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS public.expert_recognition_awards (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 expert_profile_id uuid NOT NULL REFERENCES public.expert_profiles(id) ON DELETE CASCADE,
 impact_record_id uuid REFERENCES public.expert_impact_records(id) ON DELETE SET NULL,
 award_code text NOT NULL UNIQUE,
 award_level text NOT NULL CHECK (award_level IN ('professional_appreciation','impact','innovation','special_honor')),
 title text NOT NULL, citation text NOT NULL,
 issuer_type text NOT NULL CHECK (issuer_type IN ('sarina','independent_panel','partner_organization')),
 issuer_name text NOT NULL, issuer_authorization_ref text,
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','revoked')),
 issued_at timestamptz, revoked_at timestamptz,
 public_verification_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (status <> 'issued' OR issued_at IS NOT NULL),
 CHECK (issuer_type <> 'partner_organization' OR issuer_authorization_ref IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS expert_recognition_awards_profile_idx ON public.expert_recognition_awards(expert_profile_id,status,issued_at DESC);
ALTER TABLE public.expert_recognition_awards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS expert_recognition_awards_owner_select ON public.expert_recognition_awards;
CREATE POLICY expert_recognition_awards_owner_select ON public.expert_recognition_awards FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.expert_profiles ep WHERE ep.id=expert_recognition_awards.expert_profile_id AND ep.user_id=public.current_sarina_user_id()));
GRANT SELECT ON public.expert_recognition_awards TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.expert_recognition_awards FROM PUBLIC,anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.expert_impact_assessments FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE public.expert_impact_records IS 'Expert-owned draft evidence for measurable case outcomes and innovations. Evidence is not an award and is not publicly visible by default.';
COMMENT ON TABLE public.expert_impact_assessments IS 'Internal assessment records. Scores must consider baseline, outcomes, attribution confidence and confounding factors; not writable by client roles.';
COMMENT ON TABLE public.expert_recognition_awards IS 'System-issued recognition. Partner-organization issuer claims require a recorded authorization reference; only issued awards may be presented as credentials.';