-- Restrict the conservative budget finalizer to the trusted Edge Function service role.
-- SECURITY DEFINER functions in public inherit PUBLIC EXECUTE unless explicitly revoked.
revoke all on function public.sarina_finalize_public_chat_unknown_cost(uuid)
  from public, anon, authenticated;
grant execute on function public.sarina_finalize_public_chat_unknown_cost(uuid)
  to service_role;
