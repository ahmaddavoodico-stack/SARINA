-- SARINA education module (compatible with the current marketplace schema)
-- Generated after inspecting the live SARINA database on 2026-11-19.
-- Scope: education tables only. Existing marketplace tables are intentionally untouched.
-- Access: RLS is enabled on every table with no client policies yet; access remains
-- backend/service-role only until explicit public-content and owner-progress policies
-- are designed and reviewed. Do not add broad policies as a shortcut.

BEGIN;

CREATE TABLE IF NOT EXISTS public.educational_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES public.educational_categories(id) ON DELETE SET NULL,
    code VARCHAR(80) NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.educational_category_localizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.educational_categories(id) ON DELETE CASCADE,
    language_code VARCHAR(12) NOT NULL,
    name VARCHAR(180) NOT NULL,
    description TEXT,
    UNIQUE (category_id, language_code)
);

CREATE TABLE IF NOT EXISTS public.educational_content_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    provider_name VARCHAR(180) NOT NULL,
    provider_type VARCHAR(32) NOT NULL DEFAULT 'organization'
        CHECK (provider_type IN ('organization', 'expert', 'Sarina', 'external')),
    website_url TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.educational_contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES public.educational_categories(id) ON DELETE SET NULL,
    provider_id UUID REFERENCES public.educational_content_providers(id) ON DELETE SET NULL,
    content_type VARCHAR(24) NOT NULL
        CHECK (content_type IN ('article', 'video', 'course', 'podcast', 'guide')),
    status VARCHAR(24) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'pending_review', 'published', 'rejected', 'archived')),
    difficulty_level VARCHAR(20)
        CHECK (difficulty_level IS NULL OR difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    estimated_duration_minutes INTEGER
        CHECK (estimated_duration_minutes IS NULL OR estimated_duration_minutes >= 0),
    thumbnail_storage_key TEXT,
    external_provider VARCHAR(80),
    external_content_reference TEXT,
    age_min SMALLINT CHECK (age_min IS NULL OR age_min >= 0),
    age_max SMALLINT CHECK (age_max IS NULL OR age_max >= 0),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (age_min IS NULL OR age_max IS NULL OR age_max >= age_min)
);

CREATE TABLE IF NOT EXISTS public.educational_content_localizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES public.educational_contents(id) ON DELETE CASCADE,
    language_code VARCHAR(12) NOT NULL,
    title VARCHAR(240) NOT NULL,
    summary VARCHAR(600),
    body TEXT,
    transcript TEXT,
    UNIQUE (content_id, language_code)
);

CREATE TABLE IF NOT EXISTS public.educational_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES public.educational_contents(id) ON DELETE CASCADE,
    lesson_order INTEGER NOT NULL,
    duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
    external_content_reference TEXT,
    is_preview BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (content_id, lesson_order)
);

CREATE TABLE IF NOT EXISTS public.educational_lesson_localizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID NOT NULL REFERENCES public.educational_lessons(id) ON DELETE CASCADE,
    language_code VARCHAR(12) NOT NULL,
    title VARCHAR(240) NOT NULL,
    body TEXT,
    UNIQUE (lesson_id, language_code)
);

CREATE TABLE IF NOT EXISTS public.user_content_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES public.educational_contents(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES public.educational_lessons(id) ON DELETE SET NULL,
    progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0
        CHECK (progress_percent >= 0 AND progress_percent <= 100),
    last_position_seconds INTEGER
        CHECK (last_position_seconds IS NULL OR last_position_seconds >= 0),
    completed_at TIMESTAMPTZ,
    last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE NULLS NOT DISTINCT (user_id, content_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS public.user_content_bookmarks (
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES public.educational_contents(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, content_id)
);

CREATE TABLE IF NOT EXISTS public.educational_content_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES public.educational_contents(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_text TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'visible'
        CHECK (status IN ('visible', 'hidden', 'under_review')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, content_id)
);

CREATE INDEX IF NOT EXISTS idx_education_category_status
    ON public.educational_contents (category_id, status);
CREATE INDEX IF NOT EXISTS idx_education_provider
    ON public.educational_contents (provider_id);
CREATE INDEX IF NOT EXISTS idx_learning_progress_user
    ON public.user_content_progress (user_id, last_accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_education_reviews_content_status
    ON public.educational_content_reviews (content_id, status, created_at DESC);

ALTER TABLE public.educational_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.educational_category_localizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.educational_content_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.educational_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.educational_content_localizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.educational_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.educational_lesson_localizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_content_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_content_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.educational_content_reviews ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.educational_contents IS
'Education content catalog. RLS enabled; client policies intentionally deferred pending explicit publication and role-access rules.';
COMMENT ON TABLE public.user_content_progress IS
'Per-user learning progress. RLS enabled; client policies intentionally deferred pending verified ownership rules.';

COMMIT;
