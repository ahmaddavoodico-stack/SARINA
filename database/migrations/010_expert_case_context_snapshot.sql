-- SARINA | Migration 010: consented farm context snapshot for expert cases
ALTER TABLE public.expert_requests
  ADD COLUMN IF NOT EXISTS consented_context_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;
