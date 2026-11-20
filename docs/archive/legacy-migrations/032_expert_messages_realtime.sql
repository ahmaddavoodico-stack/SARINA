-- Enable authenticated, RLS-filtered realtime updates for expert consultation messages.
-- Table-level RLS policies remain the authorization boundary; this only adds the
-- existing table to Supabase's realtime publication.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'expert_consultation_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.expert_consultation_messages;
  END IF;
END
$$;
