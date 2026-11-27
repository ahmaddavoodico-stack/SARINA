-- SARINA approved FAQ and reusable answer knowledge layer V1.
-- Reuses ai_conversations/ai_messages for private conversation history.
-- Shared FAQ content is separately versioned, evidence-backed and review-gated.
-- Question signals contain redacted templates only; raw personal/farm messages are not copied here.

BEGIN;

CREATE TABLE public.sarina_faq_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sarina_faq_topics_slug_check
    CHECK (topic_slug ~ '^[a-z0-9][a-z0-9._-]{1,79}$'),
  CONSTRAINT sarina_faq_topics_status_check
    CHECK (status IN ('active','inactive','retired'))
);

CREATE TABLE public.sarina_faq_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.sarina_faq_topics(id) ON DELETE RESTRICT,
  entry_slug text NOT NULL,
  risk_level text NOT NULL DEFAULT 'low',
  answer_mode text NOT NULL DEFAULT 'auto_answer',
  scope_type text NOT NULL DEFAULT 'global',
  scope_key text NULL,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sarina_faq_entries_topic_slug_key UNIQUE (topic_id, entry_slug),
  CONSTRAINT sarina_faq_entries_slug_check
    CHECK (entry_slug ~ '^[a-z0-9][a-z0-9._-]{1,119}$'),
  CONSTRAINT sarina_faq_entries_risk_check
    CHECK (risk_level IN ('low','medium','high','critical')),
  CONSTRAINT sarina_faq_entries_answer_mode_check
    CHECK (answer_mode IN ('auto_answer','answer_with_caution','must_escalate')),
  CONSTRAINT sarina_faq_entries_risk_answer_mode_check CHECK (
    (risk_level IN ('high','critical') AND answer_mode = 'must_escalate')
    OR (risk_level = 'medium' AND answer_mode IN ('answer_with_caution','must_escalate'))
    OR (risk_level = 'low' AND answer_mode IN ('auto_answer','answer_with_caution','must_escalate'))
  ),
  CONSTRAINT sarina_faq_entries_scope_check
    CHECK (
      (scope_type = 'global' AND scope_key IS NULL)
      OR (scope_type IN ('country','region','crop','variety') AND scope_key IS NOT NULL AND length(btrim(scope_key)) BETWEEN 1 AND 120)
    ),
  CONSTRAINT sarina_faq_entries_status_check
    CHECK (status IN ('draft','active','retired'))
);

CREATE TABLE public.sarina_faq_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faq_entry_id uuid NOT NULL REFERENCES public.sarina_faq_entries(id) ON DELETE RESTRICT,
  version_no integer NOT NULL,
  language_code text NOT NULL,
  canonical_question text NOT NULL,
  answer_short text NOT NULL,
  answer_markdown text NOT NULL,
  keywords text[] NOT NULL DEFAULT ARRAY[]::text[],
  confidence numeric(4,3) NOT NULL DEFAULT 0.800,
  status text NOT NULL DEFAULT 'draft',
  approval_role text NULL,
  approved_by uuid NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  approved_at timestamptz NULL,
  published_at timestamptz NULL,
  valid_from date NOT NULL DEFAULT current_date,
  valid_until date NULL,
  created_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  search_document tsvector NOT NULL DEFAULT ''::tsvector,
  CONSTRAINT sarina_faq_versions_entry_version_language_key
    UNIQUE (faq_entry_id, version_no, language_code),
  CONSTRAINT sarina_faq_versions_version_check CHECK (version_no > 0),
  CONSTRAINT sarina_faq_versions_language_check
    CHECK (language_code ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  CONSTRAINT sarina_faq_versions_question_check
    CHECK (length(btrim(canonical_question)) BETWEEN 4 AND 500),
  CONSTRAINT sarina_faq_versions_short_answer_check
    CHECK (length(btrim(answer_short)) BETWEEN 1 AND 1200),
  CONSTRAINT sarina_faq_versions_answer_check
    CHECK (length(btrim(answer_markdown)) BETWEEN 1 AND 20000),
  CONSTRAINT sarina_faq_versions_confidence_check
    CHECK (confidence BETWEEN 0 AND 1),
  CONSTRAINT sarina_faq_versions_status_check
    CHECK (status IN ('draft','in_review','approved','published','superseded','withdrawn')),
  CONSTRAINT sarina_faq_versions_approval_role_check
    CHECK (approval_role IS NULL OR approval_role IN ('qualified_specialist','sarina_admin','official_reviewer')),
  CONSTRAINT sarina_faq_versions_published_approval_check
    CHECK (
      status <> 'published'
      OR (approved_by IS NOT NULL AND approved_at IS NOT NULL AND published_at IS NOT NULL AND approval_role IS NOT NULL)
    ),
  CONSTRAINT sarina_faq_versions_validity_check
    CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

CREATE OR REPLACE FUNCTION public.refresh_sarina_faq_search_document()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $
BEGIN
  NEW.search_document := to_tsvector(
    'simple'::regconfig,
    coalesce(NEW.canonical_question, '') || ' ' ||
    coalesce(NEW.answer_short, '') || ' ' ||
    coalesce(NEW.answer_markdown, '') || ' ' ||
    array_to_string(NEW.keywords, ' ')
  );
  RETURN NEW;
END;
$;
REVOKE ALL ON FUNCTION public.refresh_sarina_faq_search_document() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER sarina_faq_versions_refresh_search_document
  BEFORE INSERT OR UPDATE OF canonical_question, answer_short, answer_markdown, keywords
  ON public.sarina_faq_versions
  FOR EACH ROW EXECUTE FUNCTION public.refresh_sarina_faq_search_document();

CREATE UNIQUE INDEX sarina_faq_one_published_version_per_language_uidx
  ON public.sarina_faq_versions (faq_entry_id, language_code)
  WHERE status = 'published';
CREATE INDEX sarina_faq_versions_entry_status_idx
  ON public.sarina_faq_versions (faq_entry_id, status, language_code);
CREATE INDEX sarina_faq_versions_search_gin
  ON public.sarina_faq_versions USING gin (search_document);

CREATE TABLE public.sarina_faq_source_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faq_version_id uuid NOT NULL REFERENCES public.sarina_faq_versions(id) ON DELETE RESTRICT,
  source_type text NOT NULL,
  source_title text NOT NULL,
  source_uri text NOT NULL,
  publisher text NULL,
  source_published_at date NULL,
  accessed_at timestamptz NOT NULL DEFAULT now(),
  valid_until date NULL,
  citation_locator text NULL,
  content_sha256 text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sarina_faq_source_type_check
    CHECK (source_type IN ('official','peer_reviewed','university','manufacturer_label','specialist_assessed_case','verified_internal_case','internal_product_doc','internal_policy','other')),
  CONSTRAINT sarina_faq_source_title_check
    CHECK (length(btrim(source_title)) BETWEEN 1 AND 300),
  CONSTRAINT sarina_faq_source_uri_check
    CHECK (source_uri ~ '^(https?://|internal://)'),
  CONSTRAINT sarina_faq_source_hash_check
    CHECK (content_sha256 IS NULL OR content_sha256 ~ '^[a-f0-9]{64}$')
);
CREATE INDEX sarina_faq_source_version_idx
  ON public.sarina_faq_source_references (faq_version_id);

CREATE TABLE public.sarina_faq_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faq_version_id uuid NOT NULL REFERENCES public.sarina_faq_versions(id) ON DELETE RESTRICT,
  action text NOT NULL,
  reviewer_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  reviewer_role text NOT NULL,
  rationale text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sarina_faq_review_action_check
    CHECK (action IN ('submitted','approved','rejected','revision_requested','published','deprecated','withdrawn')),
  CONSTRAINT sarina_faq_review_role_check
    CHECK (reviewer_role IN ('qualified_specialist','sarina_admin','official_reviewer','system')),
  CONSTRAINT sarina_faq_review_rationale_check
    CHECK (length(btrim(rationale)) BETWEEN 1 AND 3000),
  CONSTRAINT sarina_faq_review_details_check
    CHECK (jsonb_typeof(details) = 'object')
);
CREATE INDEX sarina_faq_review_events_version_time_idx
  ON public.sarina_faq_review_events (faq_version_id, created_at DESC);

CREATE TABLE public.sarina_faq_question_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code text NOT NULL,
  question_fingerprint text NOT NULL,
  normalized_question_redacted text NULL,
  topic_id uuid NULL REFERENCES public.sarina_faq_topics(id) ON DELETE SET NULL,
  occurrence_count bigint NOT NULL DEFAULT 1,
  signal_status text NOT NULL DEFAULT 'candidate',
  linked_faq_entry_id uuid NULL REFERENCES public.sarina_faq_entries(id) ON DELETE SET NULL,
  privacy_redacted boolean NOT NULL DEFAULT false,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sarina_faq_question_signal_language_check
    CHECK (language_code ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  CONSTRAINT sarina_faq_question_signal_hash_check
    CHECK (question_fingerprint ~ '^[a-f0-9]{64}$'),
  CONSTRAINT sarina_faq_question_signal_count_check CHECK (occurrence_count > 0),
  CONSTRAINT sarina_faq_question_signal_status_check
    CHECK (signal_status IN ('candidate','in_review','linked','ignored')),
  CONSTRAINT sarina_faq_question_signal_privacy_check
    CHECK (
      privacy_redacted = true
      AND (normalized_question_redacted IS NULL OR length(normalized_question_redacted) BETWEEN 4 AND 500)
    )
);
CREATE UNIQUE INDEX sarina_faq_question_signal_fingerprint_uidx
  ON public.sarina_faq_question_signals (language_code, question_fingerprint);
CREATE INDEX sarina_faq_question_signals_frequency_idx
  ON public.sarina_faq_question_signals (occurrence_count DESC, last_seen_at DESC)
  WHERE signal_status IN ('candidate','in_review');

CREATE TABLE public.sarina_faq_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faq_version_id uuid NOT NULL REFERENCES public.sarina_faq_versions(id) ON DELETE RESTRICT,
  language_code text NOT NULL,
  retrieval_method text NOT NULL,
  retrieval_score numeric(6,5) NULL,
  outcome text NOT NULL DEFAULT 'shown',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sarina_faq_usage_language_check
    CHECK (language_code ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  CONSTRAINT sarina_faq_usage_method_check
    CHECK (retrieval_method IN ('exact','full_text','semantic','manual')),
  CONSTRAINT sarina_faq_usage_score_check
    CHECK (retrieval_score IS NULL OR retrieval_score BETWEEN 0 AND 1),
  CONSTRAINT sarina_faq_usage_outcome_check
    CHECK (outcome IN ('shown','used','helpful','not_helpful','unresolved','escalated'))
);
CREATE INDEX sarina_faq_usage_version_time_idx
  ON public.sarina_faq_usage_events (faq_version_id, created_at DESC);

-- A published answer must have a recorded reviewer and at least one traceable source.
-- High/critical risk answers must be approved through the qualified-specialist workflow.
CREATE OR REPLACE FUNCTION public.guard_sarina_faq_publication()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_risk_level text;
  v_answer_mode text;
BEGIN
  IF NEW.status = 'published' THEN
    SELECT e.risk_level, e.answer_mode INTO v_risk_level, v_answer_mode
    FROM public.sarina_faq_entries e
    WHERE e.id = NEW.faq_entry_id;

    IF NEW.approved_by IS NULL OR NEW.approved_at IS NULL
       OR NEW.published_at IS NULL OR NEW.approval_role IS NULL THEN
      RAISE EXCEPTION 'Published FAQ versions require reviewer identity, approval role and timestamps'
        USING ERRCODE = '23514';
    END IF;

    IF v_risk_level IN ('high','critical') AND v_answer_mode <> 'must_escalate' THEN
      RAISE EXCEPTION 'High/critical risk FAQ entries must use must_escalate answer mode'
        USING ERRCODE = '23514';
    END IF;

    IF v_risk_level IN ('high','critical')
       AND NEW.approval_role <> 'qualified_specialist' THEN
      RAISE EXCEPTION 'High/critical risk FAQ answers require qualified specialist approval'
        USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.sarina_faq_review_events r
      WHERE r.faq_version_id = NEW.id
        AND r.action = 'approved'
        AND r.reviewer_user_id = NEW.approved_by
        AND r.reviewer_role = NEW.approval_role
    ) THEN
      RAISE EXCEPTION 'Published FAQ versions require a matching append-only approval review event'
        USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.sarina_faq_source_references s
      WHERE s.faq_version_id = NEW.id
        AND (s.valid_until IS NULL OR s.valid_until >= current_date)
    ) THEN
      RAISE EXCEPTION 'Published FAQ versions require at least one current evidence/source reference'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_sarina_faq_publication() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER sarina_faq_versions_publication_guard
  BEFORE INSERT OR UPDATE OF status, approved_by, approved_at, published_at, approval_role
  ON public.sarina_faq_versions
  FOR EACH ROW EXECUTE FUNCTION public.guard_sarina_faq_publication();

CREATE OR REPLACE FUNCTION public.prevent_sarina_faq_review_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'SARINA FAQ review events are append-only'
    USING ERRCODE = '55000';
END;
$$;
REVOKE ALL ON FUNCTION public.prevent_sarina_faq_review_mutation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER sarina_faq_review_events_append_only
  BEFORE UPDATE OR DELETE ON public.sarina_faq_review_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_sarina_faq_review_mutation();

-- Published FAQ content is read-only for signed-in users. All curation writes are trusted-server only.
ALTER TABLE public.sarina_faq_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sarina_faq_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sarina_faq_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sarina_faq_source_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sarina_faq_review_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sarina_faq_question_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sarina_faq_usage_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.sarina_faq_topics, public.sarina_faq_entries,
  public.sarina_faq_versions, public.sarina_faq_source_references,
  public.sarina_faq_review_events, public.sarina_faq_question_signals,
  public.sarina_faq_usage_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.sarina_faq_topics, public.sarina_faq_entries,
  public.sarina_faq_versions, public.sarina_faq_source_references TO authenticated;
GRANT ALL ON TABLE public.sarina_faq_topics, public.sarina_faq_entries,
  public.sarina_faq_versions, public.sarina_faq_source_references,
  public.sarina_faq_review_events, public.sarina_faq_question_signals,
  public.sarina_faq_usage_events TO service_role;

CREATE POLICY sarina_faq_topics_published_read ON public.sarina_faq_topics
  FOR SELECT TO authenticated USING (status = 'active');
CREATE POLICY sarina_faq_entries_published_read ON public.sarina_faq_entries
  FOR SELECT TO authenticated USING (status = 'active');
CREATE POLICY sarina_faq_versions_published_read ON public.sarina_faq_versions
  FOR SELECT TO authenticated USING (
    status = 'published'
    AND valid_from <= current_date
    AND (valid_until IS NULL OR valid_until >= current_date)
    AND EXISTS (
      SELECT 1 FROM public.sarina_faq_entries e
      WHERE e.id = faq_entry_id AND e.status = 'active'
    )
  );
CREATE POLICY sarina_faq_sources_published_read ON public.sarina_faq_source_references
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.sarina_faq_versions v
      JOIN public.sarina_faq_entries e ON e.id = v.faq_entry_id
      WHERE v.id = faq_version_id
        AND v.status = 'published'
        AND v.valid_from <= current_date
        AND (v.valid_until IS NULL OR v.valid_until >= current_date)
        AND e.status = 'active'
    )
  );

-- Lexical retrieval V1. It is provider-neutral and works with Persian, Arabic and English
-- tokenization; semantic/vector retrieval can be added later without changing the FAQ contract.
CREATE OR REPLACE FUNCTION public.search_sarina_faq(
  p_query text,
  p_language_code text DEFAULT 'fa',
  p_fallback_language_code text DEFAULT 'en',
  p_topic_slug text DEFAULT NULL,
  p_limit integer DEFAULT 5,
  p_scope_type text DEFAULT 'global',
  p_scope_key text DEFAULT NULL
)
RETURNS TABLE (
  faq_entry_id uuid,
  faq_version_id uuid,
  topic_slug text,
  language_code text,
  canonical_question text,
  answer_short text,
  answer_markdown text,
  risk_level text,
  answer_mode text,
  confidence numeric,
  retrieval_score real,
  source_references jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH q AS (
    SELECT plainto_tsquery('simple'::regconfig, left(coalesce(p_query, ''), 1000)) AS tsq
  )
  SELECT
    e.id,
    v.id,
    t.topic_slug,
    v.language_code,
    v.canonical_question,
    v.answer_short,
    v.answer_markdown,
    e.risk_level,
    e.answer_mode,
    v.confidence,
    ts_rank_cd(v.search_document, q.tsq)::real,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'source_type', s.source_type,
        'title', s.source_title,
        'uri', s.source_uri,
        'publisher', s.publisher,
        'published_at', s.source_published_at,
        'accessed_at', s.accessed_at,
        'valid_until', s.valid_until,
        'locator', s.citation_locator
      ) ORDER BY s.accessed_at DESC)
      FROM public.sarina_faq_source_references s
      WHERE s.faq_version_id = v.id
        AND (s.valid_until IS NULL OR s.valid_until >= current_date)
    ), '[]'::jsonb)
  FROM public.sarina_faq_versions v
  JOIN public.sarina_faq_entries e ON e.id = v.faq_entry_id
  JOIN public.sarina_faq_topics t ON t.id = e.topic_id
  CROSS JOIN q
  WHERE length(btrim(coalesce(p_query, ''))) BETWEEN 2 AND 1000
    AND v.status = 'published'
    AND v.valid_from <= current_date
    AND (v.valid_until IS NULL OR v.valid_until >= current_date)
    AND e.status = 'active'
    AND t.status = 'active'
    AND v.language_code IN (p_language_code, p_fallback_language_code)
    AND (p_topic_slug IS NULL OR t.topic_slug = p_topic_slug)
    AND (
      (e.scope_type = 'global' AND e.scope_key IS NULL)
      OR (p_scope_type <> 'global' AND e.scope_type = p_scope_type AND e.scope_key = p_scope_key)
    )
    AND v.search_document @@ q.tsq
  ORDER BY
    CASE WHEN v.language_code = p_language_code THEN 0 ELSE 1 END,
    ts_rank_cd(v.search_document, q.tsq) DESC,
    v.published_at DESC
  LIMIT least(greatest(coalesce(p_limit, 5), 1), 10);
$$;
REVOKE ALL ON FUNCTION public.search_sarina_faq(text, text, text, text, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_sarina_faq(text, text, text, text, integer, text, text) TO authenticated;

COMMENT ON TABLE public.sarina_faq_entries IS
  'Stable FAQ knowledge identity; localized approved content lives in immutable version rows.';
COMMENT ON TABLE public.sarina_faq_versions IS
  'Versioned localized SARINA answers. Only reviewed, evidence-backed published versions are retrievable.';
COMMENT ON TABLE public.sarina_faq_question_signals IS
  'Aggregated frequency signals using redacted question templates and one-way fingerprints; no user/farm/message IDs.';
COMMENT ON TABLE public.sarina_faq_usage_events IS
  'Privacy-minimized FAQ retrieval outcomes; no conversation body or farmer identity is stored.';
COMMENT ON FUNCTION public.search_sarina_faq(text, text, text, text, integer, text, text) IS
  'Read-only, RLS-respecting full-text retrieval of published FAQ versions with current evidence references and explicit applicability-scope filtering.';

COMMIT;
