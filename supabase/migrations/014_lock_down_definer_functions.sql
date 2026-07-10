-- Applied 2026-07-10 via Supabase MCP. Stop exposing SECURITY DEFINER helpers
-- via the public API. Evidence: every RLS policy referencing the helpers is
-- `TO authenticated`; current_app_role() and handle_new_auth_user() are used by
-- NO policy (and triggers do not need caller EXECUTE).
revoke execute on function public.current_app_role() from public, anon, authenticated;
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;

revoke execute on function public.is_class_teacher(uuid)   from public, anon;
revoke execute on function public.is_school_admin(uuid)    from public, anon;
revoke execute on function public.is_school_member(uuid)   from public, anon;
revoke execute on function public.manages_class(uuid)      from public, anon;
revoke execute on function public.manages_submission(uuid) from public, anon;
revoke execute on function public.owns_submission(uuid)    from public, anon;
revoke execute on function public.teaches_student(uuid)    from public, anon;

grant execute on function public.is_class_teacher(uuid)   to authenticated;
grant execute on function public.is_school_admin(uuid)    to authenticated;
grant execute on function public.is_school_member(uuid)   to authenticated;
grant execute on function public.manages_class(uuid)      to authenticated;
grant execute on function public.manages_submission(uuid) to authenticated;
grant execute on function public.owns_submission(uuid)    to authenticated;
grant execute on function public.teaches_student(uuid)    to authenticated;
