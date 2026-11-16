-- SARINA | Migration 034: User communication preferences
-- Stores each user's selected communication channels and notification consent.
-- Existing users table RLS policies scope reads/writes to the authenticated owner.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS communication_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.users.communication_preferences IS
  'Versioned user-selected communication channels and consent preferences. Contains no provider credentials.';
