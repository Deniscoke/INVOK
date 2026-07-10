-- Applied 2026-07-10 via Supabase MCP. Security hardening (advisor:
-- function_search_path_mutable): pin search_path so these functions cannot be
-- hijacked via a malicious schema.
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.enforce_student_quest_limit() set search_path = public, pg_temp;
