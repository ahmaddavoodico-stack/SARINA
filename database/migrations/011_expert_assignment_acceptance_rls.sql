-- SARINA | Migration 011: enforce assignment acceptance before expert work
DROP POLICY IF EXISTS expert_requests_participant_select ON public.expert_requests;
CREATE POLICY expert_requests_participant_select ON public.expert_requests FOR SELECT TO authenticated
USING (
 requester_user_id=public.current_sarina_user_id()
 OR EXISTS (
  SELECT 1 FROM public.expert_profiles ep
  JOIN public.expert_request_assignments a ON a.expert_profile_id=ep.id
  WHERE a.request_id=expert_requests.id
   AND a.assignment_status IN ('offered','accepted')
   AND ep.user_id=public.current_sarina_user_id()
   AND ep.verification_status='verified'
 )
);

DROP POLICY IF EXISTS expert_consultations_participant_select ON public.expert_consultations;
CREATE POLICY expert_consultations_participant_select ON public.expert_consultations FOR SELECT TO authenticated
USING (EXISTS (
 SELECT 1 FROM public.expert_requests er
 WHERE er.id=expert_consultations.request_id
  AND (
   er.requester_user_id=public.current_sarina_user_id()
   OR EXISTS (
    SELECT 1 FROM public.expert_profiles ep
    JOIN public.expert_request_assignments a ON a.expert_profile_id=ep.id
    WHERE a.request_id=er.id AND a.assignment_status IN ('offered','accepted')
     AND ep.user_id=public.current_sarina_user_id() AND ep.verification_status='verified'
   )
  )
));

DROP POLICY IF EXISTS expert_messages_participant_select ON public.expert_consultation_messages;
CREATE POLICY expert_messages_participant_select ON public.expert_consultation_messages FOR SELECT TO authenticated
USING (EXISTS (
 SELECT 1 FROM public.expert_consultations c
 JOIN public.expert_requests er ON er.id=c.request_id
 WHERE c.id=expert_consultation_messages.consultation_id
  AND (
   er.requester_user_id=public.current_sarina_user_id()
   OR EXISTS (
    SELECT 1 FROM public.expert_profiles ep
    JOIN public.expert_request_assignments a ON a.expert_profile_id=ep.id
    WHERE a.request_id=er.id AND a.assignment_status IN ('offered','accepted')
     AND ep.user_id=public.current_sarina_user_id() AND ep.verification_status='verified'
   )
  )
));

DROP POLICY IF EXISTS expert_messages_participant_insert ON public.expert_consultation_messages;
CREATE POLICY expert_messages_participant_insert ON public.expert_consultation_messages FOR INSERT TO authenticated
WITH CHECK (
 sender_user_id=public.current_sarina_user_id()
 AND message_text IS NOT NULL AND length(trim(message_text)) BETWEEN 1 AND 6000
 AND content_parts='[]'::jsonb
 AND EXISTS (
  SELECT 1 FROM public.expert_consultations c
  JOIN public.expert_requests er ON er.id=c.request_id
  JOIN public.expert_request_assignments a ON a.request_id=er.id
  LEFT JOIN public.expert_profiles ep ON ep.id=a.expert_profile_id
  WHERE c.id=expert_consultation_messages.consultation_id
   AND a.assignment_status IN ('offered','accepted')
   AND (
    er.requester_user_id=public.current_sarina_user_id()
    OR (ep.user_id=public.current_sarina_user_id() AND ep.verification_status='verified')
   )
 )
);

DROP POLICY IF EXISTS expert_reports_participant_select ON public.expert_request_reports;
CREATE POLICY expert_reports_participant_select ON public.expert_request_reports FOR SELECT TO authenticated
USING (EXISTS (
 SELECT 1 FROM public.expert_requests er
 WHERE er.id=expert_request_reports.request_id
  AND (
   er.requester_user_id=public.current_sarina_user_id()
   OR EXISTS (
    SELECT 1 FROM public.expert_profiles ep
    JOIN public.expert_request_assignments a ON a.expert_profile_id=ep.id
    WHERE a.request_id=er.id AND a.assignment_status='accepted'
     AND ep.user_id=public.current_sarina_user_id() AND ep.verification_status='verified'
   )
  )
));

DROP POLICY IF EXISTS expert_reports_assigned_expert_insert ON public.expert_request_reports;
CREATE POLICY expert_reports_assigned_expert_insert ON public.expert_request_reports FOR INSERT TO authenticated
WITH CHECK (
 author_user_id=public.current_sarina_user_id()
 AND EXISTS (
  SELECT 1 FROM public.expert_requests er
  JOIN public.expert_consultations c ON c.request_id=er.id
  JOIN public.expert_profiles ep ON ep.id=er.assigned_expert_profile_id
  JOIN public.expert_request_assignments a ON a.request_id=er.id AND a.expert_profile_id=ep.id
  WHERE er.id=expert_request_reports.request_id
   AND c.id=expert_request_reports.consultation_id
   AND a.assignment_status='accepted'
   AND ep.user_id=public.current_sarina_user_id()
   AND ep.verification_status='verified'
 )
);
