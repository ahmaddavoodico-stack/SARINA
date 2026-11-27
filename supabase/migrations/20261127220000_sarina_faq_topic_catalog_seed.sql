-- Stable, language-neutral FAQ topic catalog.
-- Only taxonomy is seeded; no answer content is published without review/evidence.

BEGIN;

INSERT INTO public.sarina_faq_topics (topic_slug, sort_order)
VALUES
  ('soil-water', 10),
  ('irrigation', 20),
  ('plant-nutrition', 30),
  ('plant-health', 40),
  ('climate-weather', 50),
  ('crop-management', 60),
  ('farm-map', 70),
  ('farm-registration', 80),
  ('account-support', 90),
  ('market-intelligence', 100),
  ('marketplace', 110),
  ('expert-services', 120),
  ('payments-contracts', 130),
  ('education', 140),
  ('privacy-data', 150),
  ('general', 999)
ON CONFLICT (topic_slug) DO NOTHING;

COMMIT;
