-- Trigger-only helper: it must not be exposed as an RPC/Data API callable function.
revoke all on function public.touch_expert_recommendation_action() from public, anon, authenticated;
