-- Privacy-preserving aggregation of recurring FAQ question signals.
-- Stores a keyed fingerprint and aggregate count only; no raw message or redacted sample text.

BEGIN;

CREATE OR REPLACE FUNCTION public.record_sarina_faq_question_signal(
  p_language_code text,
  p_question_fingerprint text,
  p_topic_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_language_code !~ '^[a-z]{2}(-[A-Z]{2})?$' THEN
    RAISE EXCEPTION 'Invalid FAQ signal language code' USING ERRCODE = '22023';
  END IF;
  IF p_question_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid FAQ question fingerprint' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.sarina_faq_question_signals (
    language_code,
    question_fingerprint,
    normalized_question_redacted,
    topic_id,
    occurrence_count,
    signal_status,
    privacy_redacted,
    first_seen_at,
    last_seen_at,
    updated_at
  ) VALUES (
    p_language_code,
    p_question_fingerprint,
    NULL,
    p_topic_id,
    1,
    'candidate',
    true,
    now(),
    now(),
    now()
  )
  ON CONFLICT (language_code, question_fingerprint)
  DO UPDATE SET
    occurrence_count = public.sarina_faq_question_signals.occurrence_count + 1,
    topic_id = coalesce(EXCLUDED.topic_id, public.sarina_faq_question_signals.topic_id),
    last_seen_at = now(),
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.record_sarina_faq_question_signal(text, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_sarina_faq_question_signal(text, text, uuid)
  TO service_role;

COMMENT ON FUNCTION public.record_sarina_faq_question_signal(text, text, uuid) IS
  'Server-only upsert of a privacy-preserving HMAC question fingerprint and aggregate occurrence count. Never stores raw question text.';

COMMIT;
