-- Remove broad default ACL privileges inherited when the table was created.
-- Regrant only the operations required by the specialist case UI.
begin;
revoke all privileges on table public.expert_case_notes from anon, authenticated, public;
grant select, insert on table public.expert_case_notes to authenticated;
commit;
