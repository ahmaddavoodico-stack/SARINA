-- Run only after applying 20261126020336_sci_durable_task_queue.sql
-- This is a read-only structural/security smoke test; it creates no task data.
do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'sci_internal') then
    raise exception 'sci_internal schema missing';
  end if;
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'sci_internal' and c.relname = 'sci_tasks' and c.relrowsecurity
  ) then
    raise exception 'SCI task table missing RLS';
  end if;
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'sci_internal' and c.relname = 'sci_task_events' and c.relrowsecurity
  ) then
    raise exception 'SCI task event table missing RLS';
  end if;
  if has_schema_privilege('anon', 'pgmq', 'USAGE')
     or has_schema_privilege('authenticated', 'pgmq', 'USAGE') then
    raise exception 'Direct client access to PGMQ schema unexpectedly granted';
  end if;
  if has_function_privilege('anon', 'pgmq.read(text,integer,integer,jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'pgmq.read(text,integer,integer,jsonb)', 'EXECUTE') then
    raise exception 'Direct client execution of PGMQ read unexpectedly granted';
  end if;
  if not has_function_privilege('service_role', 'pgmq.read(text,integer,integer,jsonb)', 'EXECUTE')
     or not has_function_privilege('service_role', 'pgmq.send(text,jsonb,integer)', 'EXECUTE') then
    raise exception 'service_role lacks required PGMQ execution privileges';
  end if;
  if has_table_privilege('anon', 'sci_internal.sci_tasks', 'SELECT')
     or has_table_privilege('authenticated', 'sci_internal.sci_tasks', 'SELECT') then
    raise exception 'Direct client read access unexpectedly granted to private task table';
  end if;
  if has_function_privilege('anon', 'public.sci_create_task(jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.sci_create_task(jsonb)', 'EXECUTE') then
    raise exception 'Client execution privilege unexpectedly granted to task RPC';
  end if;
  if not has_function_privilege('service_role', 'public.sci_create_task(jsonb)', 'EXECUTE') then
    raise exception 'service_role cannot execute task creation RPC';
  end if;
  if has_table_privilege('service_role', 'sci_internal.sci_task_events', 'UPDATE')
     or has_table_privilege('service_role', 'sci_internal.sci_task_events', 'DELETE') then
    raise exception 'Task event history is not append-only';
  end if;
  if not exists (
    select 1 from pgmq.list_queues()
    where queue_name = 'sarina_sci_tasks' and is_unlogged = false
  ) then
    raise exception 'Logged durable PGMQ queue missing';
  end if;
  if not exists (select 1 from cron.job where jobname = 'sarina-sci-task-recovery') then
    raise exception 'SCI recovery cron job missing';
  end if;
  if to_regprocedure('public.sci_heartbeat_task(uuid,uuid,integer)') is null
     or to_regprocedure('public.sci_claim_tasks(text,integer,integer)') is null
     or to_regprocedure('public.sci_cancel_task(uuid,uuid)') is null
     or to_regprocedure('public.sci_get_task_tree(uuid,uuid)') is null then
    raise exception 'One or more lifecycle RPCs are missing';
  end if;
end;
$$;
