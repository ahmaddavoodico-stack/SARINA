-- Permit the guarded administrator RPC to read owner-scoped farm records.
-- The function checks is_sarina_admin() before accessing any farm data.
alter function public.run_farm_productivity_evaluation(uuid) security definer;
alter function public.run_farm_productivity_evaluation(uuid) set search_path = public;
comment on function public.run_farm_productivity_evaluation(uuid) is 'Admin-only SECURITY DEFINER evaluator. It bypasses farm-owner RLS only after checking the caller with is_sarina_admin(); emits preliminary non-causal signals only.';