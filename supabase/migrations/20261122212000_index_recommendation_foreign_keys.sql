-- Cover foreign-key lookups used by recommendation authorship and specialist assignment.
create index if not exists expert_recommendation_actions_author_idx
  on public.expert_recommendation_actions (author_user_id);
create index if not exists expert_recommendation_actions_consultation_idx
  on public.expert_recommendation_actions (consultation_id);
create index if not exists expert_recommendation_actions_expert_profile_idx
  on public.expert_recommendation_actions (expert_profile_id);
create index if not exists expert_recommendation_reviews_created_by_idx
  on public.expert_recommendation_reviews (created_by_user_id);
