-- Read-only checks for server-only, privacy-preserving FAQ signal aggregation.
DO $$
BEGIN
  IF NOT has_function_privilege(
    'service_role',
    'public.record_sarina_faq_question_signal(text,text,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'service_role must be able to aggregate FAQ question signals';
  END IF;

  IF has_function_privilege(
    'anon',
    'public.record_sarina_faq_question_signal(text,text,uuid)',
    'EXECUTE'
  ) OR has_function_privilege(
    'authenticated',
    'public.record_sarina_faq_question_signal(text,text,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'FAQ signal aggregation must not be callable by client roles';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
      AND p.proname='record_sarina_faq_question_signal'
      AND p.prosecdef=true
  ) THEN
    RAISE EXCEPTION 'Server-only FAQ signal aggregation function is missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='sarina_faq_question_signals'
      AND column_name IN ('user_id','farm_id','conversation_id','message_id','raw_question')
  ) THEN
    RAISE EXCEPTION 'FAQ question signals must not store direct identity or raw message references';
  END IF;
END;
$$;
