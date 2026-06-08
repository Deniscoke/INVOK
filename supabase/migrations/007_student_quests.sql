-- ============================================================================
-- INVOk – student-proposed quests with teacher approval (007)
--
-- Adds a quest workflow that complements the catalog missions:
--   * Students (pseudonymous) propose problems / solutions themselves OR ask
--     AI to draft a quest aligned with INVOK + ŠVP ZV goals.
--   * Each quest goes through a state machine: pending_approval ->
--     approved -> submitted -> completed (alt. changes_requested / rejected).
--   * Teachers approve, ask for changes, or reject; they also approve the
--     student-proposed deadline.
--   * Hard limit of 5 *active* quests per student (active = not completed
--     and not rejected), enforced by trigger so service-role and the
--     teacher path both respect it.
--
-- Pseudonymity: students DON'T have a profiles row. We anchor each quest to
-- a `student_access_codes` row (pseudonymous identity within a class), the
-- same way submissions are linked elsewhere.
-- ============================================================================

create table if not exists public.student_quests (
  id                       uuid primary key default gen_random_uuid(),
  student_access_code_id   uuid not null references public.student_access_codes (id) on delete cascade,
  class_id                 uuid not null references public.classes (id) on delete cascade,

  -- Content (structured for AI evaluability + RVP alignment).
  title          text not null check (char_length(title) between 3 and 160),
  description    text,
  goal           text not null check (char_length(goal) >= 10),
  affected_group text,
  evidence       text,
  first_idea     text,

  -- Optional link to a curriculum mission template (used by the AI generator
  -- to seed the quest from an existing rubric, kept stable across iterations).
  mission_template_id text references public.missions (id),

  -- Source of the quest content + AI metadata for auditability.
  source         text not null check (source in ('student', 'ai')),
  ai_model       text,
  ai_prompt      text,

  -- State machine.
  state text not null default 'pending_approval' check (state in (
    'draft', 'pending_approval', 'changes_requested',
    'approved', 'submitted', 'completed', 'rejected'
  )),

  -- Deadlines: student proposes, teacher approves (may override).
  proposed_deadline date,
  approved_deadline date,

  -- Teacher review.
  teacher_feedback text,
  approved_by      uuid references public.profiles (id) on delete set null,
  approved_at      timestamptz,

  -- Optional linkage to a submission once the student turns the quest in.
  submission_id uuid references public.submissions (id) on delete set null,

  -- Provisional XP target for the quest (final XP comes from the submission).
  xp_estimate   integer not null default 0 check (xp_estimate >= 0),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_student_quests_student
  on public.student_quests (student_access_code_id);
create index if not exists idx_student_quests_class
  on public.student_quests (class_id);
create index if not exists idx_student_quests_state
  on public.student_quests (state);
create index if not exists idx_student_quests_class_state
  on public.student_quests (class_id, state);

-- Refresh `updated_at` on every UPDATE.
create trigger trg_student_quests_updated_at
  before update on public.student_quests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Max 5 active quests per student (enforced server-side via trigger).
-- "Active" = state not in ('completed', 'rejected').
-- We enforce on INSERT and on UPDATE that re-activates a completed/rejected
-- quest (e.g. teacher reopening). State transitions between active states
-- (e.g. pending_approval -> approved) do not change the count.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_student_quest_limit()
returns trigger
language plpgsql
as $$
declare
  active_count integer;
  is_now_active boolean;
  was_active boolean;
begin
  is_now_active := new.state not in ('completed', 'rejected');
  was_active    := tg_op = 'UPDATE' and old.state not in ('completed', 'rejected');

  -- Only check when the row is or becomes active. Going inactive
  -- (e.g. rejected) is always fine.
  if not is_now_active then
    return new;
  end if;

  -- Don't double-count the row being updated.
  select count(*) into active_count
  from public.student_quests
  where student_access_code_id = new.student_access_code_id
    and id is distinct from new.id
    and state not in ('completed', 'rejected');

  if active_count >= 5 then
    raise exception 'STUDENT_QUEST_LIMIT_REACHED'
      using detail = 'Žiak má 5 aktívnych misií; najprv jednu dokončite alebo zrušte.',
            errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger trg_student_quests_limit_insert
  before insert on public.student_quests
  for each row execute function public.enforce_student_quest_limit();

create trigger trg_student_quests_limit_update
  before update on public.student_quests
  for each row execute function public.enforce_student_quest_limit();

-- ---------------------------------------------------------------------------
-- RLS — teachers can read/update quests of their classes; students go
-- through the server (service role bypasses RLS).
-- ---------------------------------------------------------------------------
alter table public.student_quests enable row level security;

-- Teacher of the class can read.
create policy "student_quests_select_teacher" on public.student_quests
  for select to authenticated
  using (public.manages_class(class_id));

-- Teacher of the class can update (approve / request changes / reject /
-- adjust deadline / leave feedback). They cannot change identity columns.
create policy "student_quests_update_teacher" on public.student_quests
  for update to authenticated
  using (public.manages_class(class_id))
  with check (public.manages_class(class_id));

-- No INSERT / DELETE policy for authenticated — students go through the
-- pseudonymous server endpoint (service role).
