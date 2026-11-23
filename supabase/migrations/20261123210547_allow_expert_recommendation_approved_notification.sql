alter table public.expert_case_notifications
  drop constraint if exists expert_case_notifications_event_type_check;

alter table public.expert_case_notifications
  add constraint expert_case_notifications_event_type_check
  check (event_type = any (array[
    'new_message'::text,
    'assignment_accepted'::text,
    'assignment_declined'::text,
    'expert_recommendation_approved'::text
  ]));
