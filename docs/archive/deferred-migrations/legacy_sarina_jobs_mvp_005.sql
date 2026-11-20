-- SARINA Migration 005: Agricultural Jobs MVP
-- PostgreSQL 17 / Supabase
-- Depends on the existing public.users, public.farms and public.countries tables.
-- Creates an isolated employment module; does not alter the SARINA core schema.

BEGIN;

CREATE TABLE IF NOT EXISTS public.job_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  headline TEXT,
  bio TEXT,
  skills TEXT[] NOT NULL DEFAULT '{}',
  experience_years NUMERIC(4,1) CHECK (experience_years IS NULL OR experience_years >= 0),
  worker_type TEXT NOT NULL DEFAULT 'individual'
    CHECK (worker_type IN ('individual','team','specialist','operator')),
  availability TEXT NOT NULL DEFAULT 'available'
    CHECK (availability IN ('available','seasonal','unavailable')),
  employment_preferences TEXT[] NOT NULL DEFAULT '{}',
  expected_pay_min NUMERIC(12,2) CHECK (expected_pay_min IS NULL OR expected_pay_min >= 0),
  expected_pay_max NUMERIC(12,2) CHECK (expected_pay_max IS NULL OR expected_pay_max >= 0),
  pay_currency CHAR(3),
  country_id UUID REFERENCES public.countries(id),
  region TEXT,
  city TEXT,
  location_label TEXT,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT job_profiles_pay_range_check
    CHECK (expected_pay_min IS NULL OR expected_pay_max IS NULL OR expected_pay_max >= expected_pay_min)
);

CREATE TABLE IF NOT EXISTS public.job_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  farm_id UUID REFERENCES public.farms(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 160),
  description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 10 AND 10000),
  category TEXT NOT NULL,
  employment_type TEXT NOT NULL
    CHECK (employment_type IN ('daily','seasonal','permanent','contract','project')),
  worker_count INTEGER NOT NULL DEFAULT 1 CHECK (worker_count BETWEEN 1 AND 10000),
  required_skills TEXT[] NOT NULL DEFAULT '{}',
  experience_min_years NUMERIC(4,1) CHECK (experience_min_years IS NULL OR experience_min_years >= 0),
  pay_type TEXT NOT NULL DEFAULT 'negotiable'
    CHECK (pay_type IN ('hourly','daily','monthly','fixed','negotiable')),
  pay_min NUMERIC(12,2) CHECK (pay_min IS NULL OR pay_min >= 0),
  pay_max NUMERIC(12,2) CHECK (pay_max IS NULL OR pay_max >= 0),
  pay_currency CHAR(3),
  country_id UUID REFERENCES public.countries(id),
  region TEXT,
  city TEXT,
  location_label TEXT,
  starts_on DATE,
  ends_on DATE,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('draft','open','paused','filled','closed')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT job_listings_pay_range_check
    CHECK (pay_min IS NULL OR pay_max IS NULL OR pay_max >= pay_min),
  CONSTRAINT job_listings_date_range_check
    CHECK (starts_on IS NULL OR ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE IF NOT EXISTS public.job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.job_listings(id) ON DELETE CASCADE,
  applicant_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cover_message TEXT,
  proposed_pay NUMERIC(12,2) CHECK (proposed_pay IS NULL OR proposed_pay >= 0),
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','viewed','shortlisted','accepted','rejected','withdrawn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, applicant_user_id)
);

CREATE INDEX IF NOT EXISTS job_profiles_discovery_idx
  ON public.job_profiles (country_id, region, city, availability) WHERE is_published = TRUE;
CREATE INDEX IF NOT EXISTS job_profiles_skills_gin_idx
  ON public.job_profiles USING GIN (skills);
CREATE INDEX IF NOT EXISTS job_listings_discovery_idx
  ON public.job_listings (status, country_id, region, city, employment_type, created_at DESC);
CREATE INDEX IF NOT EXISTS job_listings_skills_gin_idx
  ON public.job_listings USING GIN (required_skills);
CREATE INDEX IF NOT EXISTS job_listings_employer_idx
  ON public.job_listings (employer_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS job_applications_job_idx
  ON public.job_applications (job_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS job_applications_applicant_idx
  ON public.job_applications (applicant_user_id, created_at DESC);

ALTER TABLE public.job_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_profiles_read_published_or_own
ON public.job_profiles FOR SELECT TO authenticated
USING (
  is_published = TRUE
  OR user_id = (SELECT u.id FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) LIMIT 1)
);
CREATE POLICY job_profiles_insert_own
ON public.job_profiles FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT u.id FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) LIMIT 1)
);
CREATE POLICY job_profiles_update_own
ON public.job_profiles FOR UPDATE TO authenticated
USING (
  user_id = (SELECT u.id FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) LIMIT 1)
)
WITH CHECK (
  user_id = (SELECT u.id FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) LIMIT 1)
);
CREATE POLICY job_profiles_delete_own
ON public.job_profiles FOR DELETE TO authenticated
USING (
  user_id = (SELECT u.id FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) LIMIT 1)
);

CREATE POLICY job_listings_read_open_or_own
ON public.job_listings FOR SELECT TO authenticated
USING (
  (status = 'open' AND (expires_at IS NULL OR expires_at > NOW()))
  OR employer_user_id = (SELECT u.id FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) LIMIT 1)
);
CREATE POLICY job_listings_insert_own
ON public.job_listings FOR INSERT TO authenticated
WITH CHECK (
  employer_user_id = (SELECT u.id FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) LIMIT 1)
  AND (
    farm_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.farms f
      WHERE f.id = farm_id AND f.owner_user_id = employer_user_id
    )
  )
);
CREATE POLICY job_listings_update_own
ON public.job_listings FOR UPDATE TO authenticated
USING (
  employer_user_id = (SELECT u.id FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) LIMIT 1)
)
WITH CHECK (
  employer_user_id = (SELECT u.id FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) LIMIT 1)
);
CREATE POLICY job_listings_delete_own
ON public.job_listings FOR DELETE TO authenticated
USING (
  employer_user_id = (SELECT u.id FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) LIMIT 1)
);

CREATE POLICY job_applications_read_applicant_or_employer
ON public.job_applications FOR SELECT TO authenticated
USING (
  applicant_user_id = (SELECT u.id FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) LIMIT 1)
  OR EXISTS (
    SELECT 1 FROM public.job_listings jl
    WHERE jl.id = job_id
      AND jl.employer_user_id = (SELECT u.id FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) LIMIT 1)
  )
);
CREATE POLICY job_applications_insert_own
ON public.job_applications FOR INSERT TO authenticated
WITH CHECK (
  applicant_user_id = (SELECT u.id FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) LIMIT 1)
  AND EXISTS (
    SELECT 1 FROM public.job_listings jl
    WHERE jl.id = job_id
      AND jl.status = 'open'
      AND jl.employer_user_id <> applicant_user_id
      AND (jl.expires_at IS NULL OR jl.expires_at > NOW())
  )
);
CREATE POLICY job_applications_update_applicant_or_employer
ON public.job_applications FOR UPDATE TO authenticated
USING (
  applicant_user_id = (SELECT u.id FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) LIMIT 1)
  OR EXISTS (
    SELECT 1 FROM public.job_listings jl
    WHERE jl.id = job_id
      AND jl.employer_user_id = (SELECT u.id FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) LIMIT 1)
  )
)
WITH CHECK (
  (
    applicant_user_id = (SELECT u.id FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) LIMIT 1)
    AND status = 'withdrawn'
  )
  OR EXISTS (
    SELECT 1 FROM public.job_listings jl
    WHERE jl.id = job_id
      AND jl.employer_user_id = (SELECT u.id FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) LIMIT 1)
  )
);

REVOKE ALL ON public.job_profiles, public.job_listings, public.job_applications FROM anon, PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_listings TO authenticated;
GRANT SELECT, INSERT ON public.job_applications TO authenticated;
REVOKE UPDATE ON public.job_applications FROM authenticated;
GRANT UPDATE (status) ON public.job_applications TO authenticated;

COMMIT;
