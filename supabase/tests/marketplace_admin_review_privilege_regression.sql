-- Read-only assertions for the marketplace central-admin review workflow.
-- Run after the corresponding migration is applied; this script is read-only.
do $$
declare
  v_signature text;
  v_oid oid;
  v_proc record;
begin
  foreach v_signature in array array[
    'public.admin_list_marketplace_review_queue()',
    'public.admin_review_marketplace_seller(uuid,text,text)',
    'public.admin_review_marketplace_product(uuid,text,text)'
  ]
  loop
    v_oid := to_regprocedure(v_signature);
    if v_oid is null then
      raise exception 'Missing marketplace admin RPC: %', v_signature;
    end if;

    select prosecdef, proconfig into v_proc from pg_proc where oid = v_oid;
    if not v_proc.prosecdef then
      raise exception 'Marketplace admin RPC must be SECURITY DEFINER: %', v_signature;
    end if;
    if not coalesce(v_proc.proconfig::text like '%search_path=pg_catalog, public, private%', false) then
      raise exception 'Marketplace admin RPC has unexpected search_path: %', v_signature;
    end if;
    if has_function_privilege('anon', v_oid, 'EXECUTE') then
      raise exception 'Anonymous role must not execute marketplace admin RPC: %', v_signature;
    end if;
    if not has_function_privilege('authenticated', v_oid, 'EXECUTE') then
      raise exception 'Authenticated role must be able to invoke admin-gated RPC: %', v_signature;
    end if;
  end loop;

  if not exists (
    select 1 from pg_proc p
    where p.oid = 'private.is_sarina_admin()'::regprocedure
      and p.prosecdef
  ) then
    raise exception 'Expected private.is_sarina_admin() SECURITY DEFINER authorization helper';
  end if;

  if not exists (
    select 1 from pg_class c
    where c.oid = 'public.sarina_admin_audit_logs'::regclass
      and c.relrowsecurity
  ) then
    raise exception 'Admin audit log table must keep RLS enabled';
  end if;
end;
$$;
