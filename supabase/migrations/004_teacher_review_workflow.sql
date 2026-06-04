-- ============================================================================
-- INVOk – teacher review workflow (004)
--
-- AI is a formative assistant; the TEACHER is the guarantor. This migration
-- adds an auditable `teacher_reviews` trail and a 'rejected' submission status.
-- Final XP is committed only after an approved/adjusted review (server-side).
-- Conservative: does not drop or rewrite existing data.
-- ============================================================================

-- Extend submission statuses with 'rejected'.
alter table public.submissions drop constraint if exists submissions_status_check;
alter table public.submissions
  add constraint submissions_status_check
  check (status in ('submitted', 'ai_reviewed', 'teacher_reviewed', 'approved', 'needs_revision', 'rejected'));

-- Auditable teacher review of an AI evaluation.
create table if not exists public.teacher_reviews (
  id                uuid primary key default gen_random_uuid(),
  submission_id     uuid not null references public.submissions (id) on delete cascade,
  ai_evaluation_id  uuid references public.ai_evaluations (id) on delete set null,
  reviewer_id       uuid not null references public.profiles (id) on delete cascade,
  decision          text not null check (decision in ('approved', 'adjusted', 'needs_revision', 'rejected')),
  final_valid       boolean not null default true,
  final_score       numeric not null default 0 check (final_score between 0 and 100),
  feedback_text     text,
  adjustment_reason text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_teacher_reviews_submission on public.teacher_reviews (submission_id);
create index if not exists idx_teacher_reviews_reviewer on public.teacher_reviews (reviewer_id);
create index if not exists idx_teacher_reviews_decision on public.teacher_reviews (decision);

create trigger trg_teacher_reviews_updated_at
  before update on public.teacher_reviews
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER -> bypass RLS, avoid recursion)
-- ---------------------------------------------------------------------------

-- Caller manages the class of a submission (its teacher OR a school admin).
create or replace function public.manages_submission(p_submission uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.submissions s
    join public.class_memberships m on m.class_id = s.class_id
    where s.id = p_submission and m.user_id = auth.uid() and m.role = 'teacher'
  ) or exists (
    select 1
    from public.submissions s
    join public.classes c on c.id = s.class_id
    join public.school_memberships sm on sm.school_id = c.school_id
    where s.id = p_submission and sm.user_id = auth.uid() and sm.role = 'admin'
  );
$$;

-- Caller owns the submission (auth-based student).
create or replace function public.owns_submission(p_submission uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.submissions s
    where s.id = p_submission and s.student_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.teacher_reviews enable row level security;

-- Read: the reviewer, a class manager, or the submission owner.
create policy "teacher_reviews_select" on public.teacher_reviews
  for select to authenticated
  using (
    reviewer_id = auth.uid()
    or public.manages_submission(submission_id)
    or public.owns_submission(submission_id)
  );

-- Write: only a class manager acting as themselves (reviewer_id = caller).
create policy "teacher_reviews_insert" on public.teacher_reviews
  for insert to authenticated
  with check (reviewer_id = auth.uid() and public.manages_submission(submission_id));

create policy "teacher_reviews_update" on public.teacher_reviews
  for update to authenticated
  using (reviewer_id = auth.uid() and public.manages_submission(submission_id))
  with check (reviewer_id = auth.uid() and public.manages_submission(submission_id));
