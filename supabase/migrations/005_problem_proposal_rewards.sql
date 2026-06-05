-- ============================================================================
-- INVOk – problem proposal rewards (005)
--
-- Entrepreneurship: reward pupils for QUALITY problem identification, not only
-- for solving the whole mission. Variant A — extend `submissions` (no parallel
-- system). Conservative: additive columns with safe defaults, no data rewrite.
-- ============================================================================

alter table public.submissions
  add column if not exists submission_kind text not null default 'solution_submission';

alter table public.submissions
  drop constraint if exists submissions_submission_kind_check;
alter table public.submissions
  add constraint submissions_submission_kind_check
  check (submission_kind in ('problem_proposal', 'solution_submission', 'reflection'));

-- Quality of the problem proposal (0–100), null for non-proposals.
alter table public.submissions
  add column if not exists problem_quality_score numeric
  check (problem_quality_score is null or (problem_quality_score between 0 and 100));

-- Provisional reward XP for the proposal (committed only after teacher review).
alter table public.submissions
  add column if not exists problem_reward_xp integer not null default 0
  check (problem_reward_xp >= 0);

create index if not exists idx_submissions_kind on public.submissions (submission_kind);
