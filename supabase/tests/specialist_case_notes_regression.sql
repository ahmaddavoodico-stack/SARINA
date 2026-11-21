-- Regression checks for the specialist private case-notes migration.
do $$
declare v_rls boolean;
begin
 select c.relrowsecurity into v_rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='expert_case_notes';
 if v_rls is distinct from true then raise exception 'expert_case_notes must have RLS enabled'; end if;
 if has_table_privilege('anon','public.expert_case_notes','SELECT') or has_table_privilege('anon','public.expert_case_notes','INSERT') or has_table_privilege('anon','public.expert_case_notes','UPDATE') or has_table_privilege('anon','public.expert_case_notes','DELETE') then raise exception 'anon must have no privileges'; end if;
 if not has_table_privilege('authenticated','public.expert_case_notes','SELECT') or not has_table_privilege('authenticated','public.expert_case_notes','INSERT') then raise exception 'authenticated requires SELECT and INSERT'; end if;
 if has_table_privilege('authenticated','public.expert_case_notes','UPDATE') or has_table_privilege('authenticated','public.expert_case_notes','DELETE') then raise exception 'notes must be immutable to clients'; end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='expert_case_notes' and policyname='expert_case_notes_assigned_expert_read' and cmd='SELECT') or not exists(select 1 from pg_policies where schemaname='public' and tablename='expert_case_notes' and policyname='expert_case_notes_assigned_expert_insert' and cmd='INSERT') then raise exception 'assigned verified expert policies are missing'; end if;
end $$;