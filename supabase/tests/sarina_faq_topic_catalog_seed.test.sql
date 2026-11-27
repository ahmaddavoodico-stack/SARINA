-- Read-only check that the core FAQ taxonomy is present.
DO $$
DECLARE
  v_missing text[];
BEGIN
  SELECT array_agg(expected.topic_slug)
  INTO v_missing
  FROM unnest(ARRAY[
    'soil-water','irrigation','plant-nutrition','plant-health',
    'climate-weather','crop-management','farm-map','farm-registration',
    'account-support','market-intelligence','marketplace','expert-services',
    'payments-contracts','education','privacy-data','general'
  ]) AS expected(topic_slug)
  LEFT JOIN public.sarina_faq_topics t
    ON t.topic_slug=expected.topic_slug AND t.status='active'
  WHERE t.id IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing active FAQ topics: %', array_to_string(v_missing, ', ');
  END IF;
END;
$$;
