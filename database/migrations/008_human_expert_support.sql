-- SARINA | Migration 008: Human expert support pilot
-- Reuses the existing expert domain tables; adds only the missing case workflow records.
-- All farmer/expert access is participant-scoped. No service-role key is exposed to the app.

CREATE OR REPLACE FUNCTION public.current_sarina_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id
  FROM public.users u
  WHERE u.auth_user_id = (SELECT auth.uid())
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.current_sarina_user_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_sarina_user_id() TO authenticated;

ALTER TABLE public.expert_requests
  ADD COLUMN IF NOT EXISTS requested_mode varchar(32) NOT NULL DEFAULT 'in_app_message',
  ADD COLUMN IF NOT EXISTS consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_scope jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'expert_requests_requested_mode_check'
      AND conrelid = 'public.expert_requests'::regclass
  ) THEN
    ALTER TABLE public.expert_requests
      ADD CONSTRAINT expert_requests_requested_mode_check
      CHECK (requested_mode IN ('in_app_message','voice','video','field_visit'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.expert_request_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.expert_requests(id) ON DELETE CASCADE,
  expert_profile_id uuid NOT NULL REFERENCES public.expert_profiles(id) ON DELETE RESTRICT,
  assignment_status varchar(24) NOT NULL DEFAULT 'offered'
    CHECK (assignment_status IN ('offered','accepted','declined','revoked')),
  offered_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  UNIQUE (request_id, expert_profile_id, offered_at)
);

CREATE INDEX IF NOT EXISTS expert_request_assignments_expert_idx
  ON public.expert_request_assignments(expert_profile_id, assignment_status);
CREATE INDEX IF NOT EXISTS expert_request_assignments_request_idx
  ON public.expert_request_assignments(request_id, offered_at DESC);

CREATE TABLE IF NOT EXISTS public.expert_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.expert_requests(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  event_type varchar(64) NOT NULL,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS expert_request_events_request_idx
  ON public.expert_request_events(request_id, created_at);

CREATE TABLE IF NOT EXISTS public.expert_request_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.expert_requests(id) ON DELETE CASCADE,
  consultation_id uuid NOT NULL REFERENCES public.expert_consultations(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  summary text NOT NULL CHECK (length(trim(summary)) BETWEEN 10 AND 12000),
  recommendations text,
  limitations text,
  evidence_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS expert_request_reports_request_idx
  ON public.expert_request_reports(request_id, created_at DESC);

-- Keep an immutable record of initial assignment and request lifecycle changes.
CREATE OR REPLACE FUNCTION public.record_expert_request_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := public.current_sarina_user_id();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.expert_request_events(request_id, actor_user_id, event_type, event_payload)
    VALUES (NEW.id, v_actor, 'request_submitted',
      jsonb_build_object('status', NEW.status, 'request_type', NEW.request_type));
    IF NEW.assigned_expert_profile_id IS NOT NULL THEN
      INSERT INTO public.expert_request_assignments(request_id, expert_profile_id, created_by_user_id)
      VALUES (NEW.id, NEW.assigned_expert_profile_id, v_actor);
      INSERT INTO public.expert_request_events(request_id, actor_user_id, event_type, event_payload)
      VALUES (NEW.id, v_actor, 'expert_offered',
        jsonb_build_object('expert_profile_id', NEW.assigned_expert_profile_id));
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.assigned_expert_profile_id IS DISTINCT FROM NEW.assigned_expert_profile_id THEN
    IF OLD.assigned_expert_profile_id IS NOT NULL THEN
      UPDATE public.expert_request_assignments
      SET assignment_status = 'revoked', responded_at = now()
      WHERE request_id = NEW.id
        AND expert_profile_id = OLD.assigned_expert_profile_id
        AND assignment_status IN ('offered','accepted');
    END IF;
    IF NEW.assigned_expert_profile_id IS NOT NULL THEN
      INSERT INTO public.expert_request_assignments(request_id, expert_profile_id, created_by_user_id)
      VALUES (NEW.id, NEW.assigned_expert_profile_id, v_actor);
      INSERT INTO public.expert_request_events(request_id, actor_user_id, event_type, event_payload)
      VALUES (NEW.id, v_actor, 'expert_offered',
        jsonb_build_object('expert_profile_id', NEW.assigned_expert_profile_id));
    END IF;
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.expert_request_events(request_id, actor_user_id, event_type, event_payload)
    VALUES (NEW.id, v_actor, 'status_changed',
      jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS expert_request_event_trigger ON public.expert_requests;
CREATE TRIGGER expert_request_event_trigger
AFTER INSERT OR UPDATE OF status, assigned_expert_profile_id
ON public.expert_requests
FOR EACH ROW EXECUTE FUNCTION public.record_expert_request_event();

-- Assignment acceptance is performed only by the assigned expert.
ALTER TABLE public.expert_request_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_request_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_request_reports ENABLE ROW LEVEL SECURITY;

-- Remove the broad pre-existing grants from the expert domain.
REVOKE ALL PRIVILEGES ON TABLE
  public.expert_profiles, public.expertise_categories, public.expert_specialties,
  public.expert_credentials, public.expert_requests, public.expert_consultations,
  public.expert_consultation_messages, public.expert_reviews,
  public.organizations, public.organization_members,
  public.expert_request_assignments, public.expert_request_events, public.expert_request_reports
FROM PUBLIC, anon, authenticated;

-- Expert profiles: owners can maintain their own unverified profile; only verified profiles
-- explicitly marked directory/public are visible to other authenticated users.
DROP POLICY IF EXISTS expert_profile_owner_select ON public.expert_profiles;
CREATE POLICY expert_profile_owner_select ON public.expert_profiles
  FOR SELECT TO authenticated
  USING (user_id = public.current_sarina_user_id());
DROP POLICY IF EXISTS expert_profile_verified_directory_select ON public.expert_profiles;
CREATE POLICY expert_profile_verified_directory_select ON public.expert_profiles
  FOR SELECT TO authenticated
  USING (verification_status = 'verified' AND profile_visibility IN ('directory','public'));
DROP POLICY IF EXISTS expert_profile_owner_insert ON public.expert_profiles;
CREATE POLICY expert_profile_owner_insert ON public.expert_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = public.current_sarina_user_id()
    AND verification_status = 'pending'
  );
DROP POLICY IF EXISTS expert_profile_owner_update ON public.expert_profiles;
CREATE POLICY expert_profile_owner_update ON public.expert_profiles
  FOR UPDATE TO authenticated
  USING (user_id = public.current_sarina_user_id() AND verification_status <> 'suspended')
  WITH CHECK (user_id = public.current_sarina_user_id() AND verification_status <> 'suspended');

GRANT SELECT ON public.expert_profiles TO authenticated;
GRANT INSERT (user_id, public_name, biography, country_id, years_experience, languages, consultation_modes, profile_visibility)
  ON public.expert_profiles TO authenticated;
GRANT UPDATE (public_name, biography, country_id, years_experience, languages, consultation_modes, profile_visibility)
  ON public.expert_profiles TO authenticated;

-- Public taxonomy is read-only. Expert specialty links are private to their owner except
-- that verified directory profiles expose their specialty labels through the join.
DROP POLICY IF EXISTS expertise_categories_active_read ON public.expertise_categories;
CREATE POLICY expertise_categories_active_read ON public.expertise_categories
  FOR SELECT TO authenticated USING (is_active = true);
GRANT SELECT ON public.expertise_categories TO authenticated;

DROP POLICY IF EXISTS expert_specialties_owner_or_directory_read ON public.expert_specialties;
CREATE POLICY expert_specialties_owner_or_directory_read ON public.expert_specialties
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.expert_profiles ep
      WHERE ep.id = expert_specialties.expert_profile_id
        AND (ep.user_id = public.current_sarina_user_id()
          OR (ep.verification_status = 'verified' AND ep.profile_visibility IN ('directory','public')))
    )
  );
DROP POLICY IF EXISTS expert_specialties_owner_insert ON public.expert_specialties;
CREATE POLICY expert_specialties_owner_insert ON public.expert_specialties
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.expert_profiles ep
      WHERE ep.id = expert_specialties.expert_profile_id
        AND ep.user_id = public.current_sarina_user_id()
        AND ep.verification_status = 'pending')
  );
DROP POLICY IF EXISTS expert_specialties_owner_delete ON public.expert_specialties;
CREATE POLICY expert_specialties_owner_delete ON public.expert_specialties
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.expert_profiles ep
      WHERE ep.id = expert_specialties.expert_profile_id
        AND ep.user_id = public.current_sarina_user_id()
        AND ep.verification_status = 'pending')
  );
GRANT SELECT ON public.expert_specialties TO authenticated;
GRANT INSERT, DELETE ON public.expert_specialties TO authenticated;

-- Credential metadata can be submitted and read by its owner. Verification fields are
-- intentionally not writable from the client. Evidence uploads are a later private-storage slice.
DROP POLICY IF EXISTS expert_credentials_owner_select ON public.expert_credentials;
CREATE POLICY expert_credentials_owner_select ON public.expert_credentials
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.expert_profiles ep
      WHERE ep.id = expert_credentials.expert_profile_id
        AND ep.user_id = public.current_sarina_user_id())
  );
DROP POLICY IF EXISTS expert_credentials_owner_insert ON public.expert_credentials;
CREATE POLICY expert_credentials_owner_insert ON public.expert_credentials
  FOR INSERT TO authenticated WITH CHECK (
    verification_status = 'pending'
    AND EXISTS (SELECT 1 FROM public.expert_profiles ep
      WHERE ep.id = expert_credentials.expert_profile_id
        AND ep.user_id = public.current_sarina_user_id())
  );
GRANT SELECT ON public.expert_credentials TO authenticated;
GRANT INSERT (expert_profile_id, credential_type, issuing_body, credential_ref, issued_on, expires_on, document_ref)
  ON public.expert_credentials TO authenticated;

-- Farmer owns the case; the assigned, verified expert is a participant.
DROP POLICY IF EXISTS expert_requests_participant_select ON public.expert_requests;
CREATE POLICY expert_requests_participant_select ON public.expert_requests
  FOR SELECT TO authenticated USING (
    requester_user_id = public.current_sarina_user_id()
    OR EXISTS (
      SELECT 1 FROM public.expert_profiles ep
      WHERE ep.id = expert_requests.assigned_expert_profile_id
        AND ep.user_id = public.current_sarina_user_id()
        AND ep.verification_status = 'verified'
    )
  );
DROP POLICY IF EXISTS expert_requests_farmer_insert ON public.expert_requests;
CREATE POLICY expert_requests_farmer_insert ON public.expert_requests
  FOR INSERT TO authenticated WITH CHECK (
    requester_user_id = public.current_sarina_user_id()
    AND farm_id IS NOT NULL
    AND consent_at IS NOT NULL
    AND consent_scope <> '{}'::jsonb
    AND status IN ('draft','submitted')
    AND EXISTS (SELECT 1 FROM public.farms f
      WHERE f.id = expert_requests.farm_id
        AND f.owner_user_id = public.current_sarina_user_id())
    AND EXISTS (SELECT 1 FROM public.expert_profiles ep
      WHERE ep.id = expert_requests.assigned_expert_profile_id
        AND ep.verification_status = 'verified'
        AND ep.profile_visibility IN ('directory','public'))
  );
GRANT SELECT, INSERT ON public.expert_requests TO authenticated;

-- Only the farmer who owns the request may create the initial in-app consultation.
DROP POLICY IF EXISTS expert_consultations_participant_select ON public.expert_consultations;
CREATE POLICY expert_consultations_participant_select ON public.expert_consultations
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.expert_requests er
      WHERE er.id = expert_consultations.request_id
        AND (er.requester_user_id = public.current_sarina_user_id()
          OR EXISTS (SELECT 1 FROM public.expert_profiles ep
            WHERE ep.id = er.assigned_expert_profile_id
              AND ep.user_id = public.current_sarina_user_id()
              AND ep.verification_status = 'verified')))
  );
DROP POLICY IF EXISTS expert_consultations_farmer_insert ON public.expert_consultations;
CREATE POLICY expert_consultations_farmer_insert ON public.expert_consultations
  FOR INSERT TO authenticated WITH CHECK (
    consultation_mode = 'in_app_message'
    AND status = 'scheduled'
    AND EXISTS (SELECT 1 FROM public.expert_requests er
      WHERE er.id = expert_consultations.request_id
        AND er.requester_user_id = public.current_sarina_user_id()
        AND er.status IN ('submitted','assigned'))
  );
GRANT SELECT, INSERT ON public.expert_consultations TO authenticated;

-- Messages are append-only and visible only to the farmer and assigned verified expert.
DROP POLICY IF EXISTS expert_messages_participant_select ON public.expert_consultation_messages;
CREATE POLICY expert_messages_participant_select ON public.expert_consultation_messages
  FOR SELECT TO authenticated USING (
    sender_user_id = public.current_sarina_user_id()
    OR EXISTS (SELECT 1 FROM public.expert_consultations c
      JOIN public.expert_requests er ON er.id = c.request_id
      WHERE c.id = expert_consultation_messages.consultation_id
        AND (er.requester_user_id = public.current_sarina_user_id()
          OR EXISTS (SELECT 1 FROM public.expert_profiles ep
            WHERE ep.id = er.assigned_expert_profile_id
              AND ep.user_id = public.current_sarina_user_id()
              AND ep.verification_status = 'verified')))
  );
DROP POLICY IF EXISTS expert_messages_participant_insert ON public.expert_consultation_messages;
CREATE POLICY expert_messages_participant_insert ON public.expert_consultation_messages
  FOR INSERT TO authenticated WITH CHECK (
    sender_user_id = public.current_sarina_user_id()
    AND EXISTS (SELECT 1 FROM public.expert_consultations c
      JOIN public.expert_requests er ON er.id = c.request_id
      WHERE c.id = expert_consultation_messages.consultation_id
        AND (er.requester_user_id = public.current_sarina_user_id()
          OR EXISTS (SELECT 1 FROM public.expert_profiles ep
            WHERE ep.id = er.assigned_expert_profile_id
              AND ep.user_id = public.current_sarina_user_id()
              AND ep.verification_status = 'verified')))
  );
GRANT SELECT, INSERT ON public.expert_consultation_messages TO authenticated;

-- Expert may accept an offered assignment; farmer and assigned expert can read history.
DROP POLICY IF EXISTS expert_assignments_participant_select ON public.expert_request_assignments;
CREATE POLICY expert_assignments_participant_select ON public.expert_request_assignments
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.expert_requests er
      WHERE er.id = expert_request_assignments.request_id
        AND er.requester_user_id = public.current_sarina_user_id())
    OR EXISTS (SELECT 1 FROM public.expert_profiles ep
      WHERE ep.id = expert_request_assignments.expert_profile_id
        AND ep.user_id = public.current_sarina_user_id())
  );
DROP POLICY IF EXISTS expert_assignments_assignee_update ON public.expert_request_assignments;
CREATE POLICY expert_assignments_assignee_update ON public.expert_request_assignments
  FOR UPDATE TO authenticated
  USING (assignment_status = 'offered' AND EXISTS (
    SELECT 1 FROM public.expert_profiles ep
    WHERE ep.id = expert_request_assignments.expert_profile_id
      AND ep.user_id = public.current_sarina_user_id()
      AND ep.verification_status = 'verified'))
  WITH CHECK (assignment_status IN ('accepted','declined') AND EXISTS (
    SELECT 1 FROM public.expert_profiles ep
    WHERE ep.id = expert_request_assignments.expert_profile_id
      AND ep.user_id = public.current_sarina_user_id()
      AND ep.verification_status = 'verified'));
GRANT SELECT ON public.expert_request_assignments TO authenticated;
GRANT UPDATE (assignment_status, responded_at) ON public.expert_request_assignments TO authenticated;

-- Events are append-only and participant-readable. Only the trigger function writes them.
DROP POLICY IF EXISTS expert_events_participant_select ON public.expert_request_events;
CREATE POLICY expert_events_participant_select ON public.expert_request_events
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.expert_requests er
      WHERE er.id = expert_request_events.request_id
        AND (er.requester_user_id = public.current_sarina_user_id()
          OR EXISTS (SELECT 1 FROM public.expert_profiles ep
            WHERE ep.id = er.assigned_expert_profile_id
              AND ep.user_id = public.current_sarina_user_id())))
  );
GRANT SELECT ON public.expert_request_events TO authenticated;

-- Reports can be written only by the assigned verified expert and read by both participants.
DROP POLICY IF EXISTS expert_reports_participant_select ON public.expert_request_reports;
CREATE POLICY expert_reports_participant_select ON public.expert_request_reports
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.expert_requests er
      WHERE er.id = expert_request_reports.request_id
        AND (er.requester_user_id = public.current_sarina_user_id()
          OR EXISTS (SELECT 1 FROM public.expert_profiles ep
            WHERE ep.id = er.assigned_expert_profile_id
              AND ep.user_id = public.current_sarina_user_id()
              AND ep.verification_status = 'verified')))
  );
DROP POLICY IF EXISTS expert_reports_assigned_expert_insert ON public.expert_request_reports;
CREATE POLICY expert_reports_assigned_expert_insert ON public.expert_request_reports
  FOR INSERT TO authenticated WITH CHECK (
    author_user_id = public.current_sarina_user_id()
    AND EXISTS (SELECT 1 FROM public.expert_requests er
      JOIN public.expert_consultations c ON c.request_id = er.id
      JOIN public.expert_profiles ep ON ep.id = er.assigned_expert_profile_id
      WHERE er.id = expert_request_reports.request_id
        AND c.id = expert_request_reports.consultation_id
        AND ep.user_id = public.current_sarina_user_id()
        AND ep.verification_status = 'verified')
  );
GRANT SELECT, INSERT ON public.expert_request_reports TO authenticated;

-- These structures are not part of the first pilot; deny client access until their
-- organization-specific policies and workflows are implemented.
GRANT SELECT ON public.organizations, public.organization_members TO authenticated;
