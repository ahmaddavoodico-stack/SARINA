-- Read-only structural/security checks for SARINA FAQ knowledge layer V1.
DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'sarina_faq_topics','sarina_faq_entries','sarina_faq_versions',
    'sarina_faq_source_references','sarina_faq_review_events',
    'sarina_faq_question_signals','sarina_faq_usage_events'
  ] LOOP
    IF to_regclass(format('public.%I',v_table)) IS NULL THEN
      RAISE EXCEPTION 'Missing public.%',v_table;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=v_table AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'RLS disabled on public.%',v_table;
    END IF;
    IF has_table_privilege('anon',format('public.%I',v_table),'SELECT')
       OR has_table_privilege('anon',format('public.%I',v_table),'INSERT')
       OR has_table_privilege('anon',format('public.%I',v_table),'UPDATE')
       OR has_table_privilege('anon',format('public.%I',v_table),'DELETE') THEN
      RAISE EXCEPTION 'anon has direct privileges on public.%',v_table;
    END IF;
  END LOOP;

  IF NOT has_table_privilege('authenticated','public.sarina_faq_versions','SELECT')
     OR has_table_privilege('authenticated','public.sarina_faq_versions','INSERT')
     OR has_table_privilege('authenticated','public.sarina_faq_versions','UPDATE')
     OR has_table_privilege('authenticated','public.sarina_faq_versions','DELETE') THEN
    RAISE EXCEPTION 'FAQ versions must be client read-only';
  END IF;

  IF has_table_privilege('authenticated','public.sarina_faq_question_signals','SELECT')
     OR has_table_privilege('authenticated','public.sarina_faq_question_signals','INSERT')
     OR has_table_privilege('authenticated','public.sarina_faq_review_events','SELECT')
     OR has_table_privilege('authenticated','public.sarina_faq_usage_events','SELECT') THEN
    RAISE EXCEPTION 'Internal FAQ curation/usage signals must not be directly exposed';
  END IF;

  IF NOT has_function_privilege('authenticated','public.search_sarina_faq(text,text,text,text,integer)','EXECUTE')
     OR has_function_privilege('anon','public.search_sarina_faq(text,text,text,text,integer)','EXECUTE') THEN
    RAISE EXCEPTION 'FAQ retrieval RPC grants are incorrect';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='sarina_faq_versions_search_gin'
  ) THEN
    RAISE EXCEPTION 'FAQ full-text search GIN index is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.sarina_faq_versions'::regclass
      AND tgname='sarina_faq_versions_publication_guard' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'FAQ publication evidence/reviewer guard is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.sarina_faq_review_events'::regclass
      AND tgname='sarina_faq_review_events_append_only' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'FAQ review audit must be append-only';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name IN ('sarina_faq_question_signals','sarina_faq_usage_events')
      AND column_name IN ('user_id','farm_id','conversation_id','message_id')
  ) THEN
    RAISE EXCEPTION 'Aggregated FAQ telemetry must not carry direct user/farm/conversation identifiers';
  END IF;
END;
$$;
