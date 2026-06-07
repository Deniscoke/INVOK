-- ============================================================================
-- INVOk – auto-create profile on signup (006)
--
-- Replaces the previous client-side `insert into profiles` that ran from the
-- browser right after `supabase.auth.signUp`. That path was fragile:
--   * it failed if the caller had no session yet (email-confirmation flows),
--   * it failed if RLS rejected the insert,
--   * it exposed errors like "Could not find the table 'public.profiles'"
--     when the migrations had not been applied in order.
--
-- Now a SECURITY DEFINER trigger on auth.users creates the matching profile
-- row using `display_name` and `role` from raw_user_meta_data (passed in the
-- signUp() call). Defaults are conservative (role = 'teacher', name = email
-- local-part) so the trigger never fails the auth signup.
--
-- Idempotent: safe to re-run.
-- ============================================================================

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta              jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  requested_role    text  := lower(coalesce(meta->>'role', 'teacher'));
  resolved_role     text;
  resolved_name     text;
begin
  -- Only the three INVOk roles are accepted; anything else falls back to teacher.
  resolved_role := case
    when requested_role in ('admin', 'teacher', 'student') then requested_role
    else 'teacher'
  end;

  resolved_name := nullif(trim(coalesce(meta->>'display_name', '')), '');
  if resolved_name is null then
    -- Fall back to the local part of the email so we never store an empty pseudonym.
    resolved_name := split_part(coalesce(new.email, 'ucitel'), '@', 1);
  end if;

  insert into public.profiles (id, role, display_name)
  values (new.id, resolved_role, resolved_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_auth_user_create_profile on auth.users;
create trigger trg_auth_user_create_profile
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Backfill: create a profile for any existing auth user that doesn't have one.
-- Uses the same defaults as the trigger.
insert into public.profiles (id, role, display_name)
select
  u.id,
  case lower(coalesce(u.raw_user_meta_data->>'role', 'teacher'))
    when 'admin'   then 'admin'
    when 'teacher' then 'teacher'
    when 'student' then 'student'
    else 'teacher'
  end as role,
  coalesce(
    nullif(trim(coalesce(u.raw_user_meta_data->>'display_name', '')), ''),
    split_part(coalesce(u.email, 'ucitel'), '@', 1)
  ) as display_name
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
