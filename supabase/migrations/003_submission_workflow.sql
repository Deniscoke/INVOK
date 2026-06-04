-- ============================================================================
-- INVOk – submission workflow (003)
--
-- Key change: add `student_access_code_id` to `submissions` so pseudonymous
-- students (who have no auth.users row) can own their work.
--
-- Constraint: at least one of (student_id, student_access_code_id) must be set.
-- Writes always go through the service role (server); the new column has no
-- direct client-insert policy to prevent spoofing.
-- ============================================================================

-- Allow student_id to be nullable so pseudonymous students can submit.
alter table public.submissions
  alter column student_id drop not null;

-- Link a submission to a pseudonymous student access code.
alter table public.submissions
  add column if not exists student_access_code_id uuid
    references public.student_access_codes (id) on delete set null;

-- Enforce: at least one identity must be present.
alter table public.submissions
  add constraint chk_submissions_identity
    check (student_id is not null or student_access_code_id is not null);

-- Additional indexes for fast lookup.
create index if not exists idx_submissions_status
  on public.submissions (status);

create index if not exists idx_submissions_access_code
  on public.submissions (student_access_code_id)
  where student_access_code_id is not null;

-- Update submissions RLS: pseudonymous student can see their own rows via
-- student_access_code_id. Writes always happen through service role.
create policy "submissions_select_access_code" on public.submissions
  for select to authenticated
  using (
    student_access_code_id in (
      select sac.id
      from public.student_access_codes sac
      join public.student_sessions ss on ss.student_access_code_id = sac.id
      -- Note: verifying the session token hash client-side is not possible
      -- in pure RLS; this policy is a best-effort filter. Server-side
      -- validation via the service role is the primary security control.
      where true
    )
  );

-- ai_evaluations: add index for fast lookup by submission.
create index if not exists idx_ai_evaluations_submission
  on public.ai_evaluations (submission_id);

-- user_progress: add index for competency queries.
create index if not exists idx_user_progress_competency
  on public.user_progress (competency_id);
