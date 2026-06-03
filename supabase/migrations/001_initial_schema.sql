-- ============================================================================
-- INVOk – initial schema (001)
--
-- Conservative, privacy-by-design foundation:
--   * UUID primary keys, timestamps, check constraints.
--   * Row Level Security (RLS) ON for every user/school table.
--   * Helper functions are SECURITY DEFINER so RLS policies can check
--     relationships without recursing into the same table.
--   * No personal child data: `profiles.display_name` is a pseudonym.
--     Real emails live only in Supabase-managed `auth.users`.
--
-- Limitations (documented in docs/DATABASE.md):
--   * Writes to catalog tables (missions/competencies/badges), ai_evaluations
--     and progress are intended via the SERVER (service role) for now.
--   * Some teacher/admin policies are intentionally minimal for the MVP.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Core identity
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  role         text not null check (role in ('admin', 'teacher', 'student')),
  display_name text not null,                       -- pseudonym, e.g. 'Líška-07'
  avatar       text,
  total_xp     integer not null default 0 check (total_xp >= 0),
  level        integer not null default 1 check (level >= 1),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.schools (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  region     text,
  created_at timestamptz not null default now()
);

create table if not exists public.school_memberships (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       text not null check (role in ('admin', 'teacher')),
  created_at timestamptz not null default now(),
  unique (school_id, user_id)
);

create table if not exists public.classes (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools (id) on delete cascade,
  name       text not null,
  grade      integer check (grade between 1 and 9),
  created_at timestamptz not null default now()
);

create table if not exists public.class_memberships (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.classes (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       text not null check (role in ('teacher', 'student')),
  created_at timestamptz not null default now(),
  unique (class_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Curriculum catalog
-- ---------------------------------------------------------------------------
create table if not exists public.competencies (
  id                   text primary key,
  child_name           text not null,
  child_description    text not null,
  teacher_description  text not null,
  curriculum_framework text,
  curriculum_area      text,
  curriculum_note      text,
  measurement_examples jsonb not null default '[]'::jsonb,
  icon                 text,
  created_at           timestamptz not null default now()
);

create table if not exists public.missions (
  id                text primary key,
  title             text not null,
  story             text,
  goal              text not null,
  evidence_required jsonb not null default '{}'::jsonb,
  rubric            jsonb not null default '[]'::jsonb,
  base_xp           integer not null default 0 check (base_xp >= 0),
  difficulty        text not null check (difficulty in ('easy', 'medium', 'hard')),
  suggested_mode    text not null check (suggested_mode in ('individual', 'team')),
  status            text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.mission_competencies (
  mission_id    text not null references public.missions (id) on delete cascade,
  competency_id text not null references public.competencies (id) on delete cascade,
  weight        numeric not null default 1 check (weight >= 0),
  primary key (mission_id, competency_id)
);

create table if not exists public.badges (
  id                 text primary key,
  name               text not null,
  description        text,
  icon               text,
  criteria           text,
  related_competency text references public.competencies (id),
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Student work
-- ---------------------------------------------------------------------------
create table if not exists public.submissions (
  id            uuid primary key default gen_random_uuid(),
  mission_id    text not null references public.missions (id),
  student_id    uuid not null references public.profiles (id) on delete cascade,
  class_id      uuid references public.classes (id) on delete set null,
  response_text text not null,
  evidence_text text,
  evidence_type text not null check (evidence_type in ('text', 'link', 'image', 'file')),
  status        text not null default 'submitted'
                check (status in ('submitted', 'ai_reviewed', 'teacher_reviewed', 'approved', 'needs_revision')),
  xp_awarded    integer not null default 0 check (xp_awarded >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.ai_evaluations (
  id                       uuid primary key default gen_random_uuid(),
  submission_id            uuid not null unique references public.submissions (id) on delete cascade,
  valid                    boolean not null,
  score                    integer not null check (score between 0 and 100),
  confidence               numeric not null check (confidence between 0 and 1),
  reasons                  jsonb not null default '[]'::jsonb,
  detected_competencies    jsonb not null default '[]'::jsonb,
  suggested_teacher_review boolean not null default true,
  model                    text,
  created_at               timestamptz not null default now()
);

create table if not exists public.user_badges (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  badge_id   text not null references public.badges (id) on delete cascade,
  awarded_at timestamptz not null default now(),
  unique (user_id, badge_id)
);

create table if not exists public.user_progress (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  competency_id text not null references public.competencies (id) on delete cascade,
  xp            integer not null default 0 check (xp >= 0),
  level         integer not null default 1 check (level >= 1),
  mastery       numeric not null default 0 check (mastery between 0 and 1),
  updated_at    timestamptz not null default now(),
  unique (user_id, competency_id)
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at    before update on public.profiles    for each row execute function public.set_updated_at();
create trigger trg_missions_updated_at    before update on public.missions    for each row execute function public.set_updated_at();
create trigger trg_submissions_updated_at before update on public.submissions for each row execute function public.set_updated_at();
create trigger trg_progress_updated_at    before update on public.user_progress for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER -> bypass RLS, avoid recursion)
-- ---------------------------------------------------------------------------
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_school_member(p_school uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.school_memberships m
    where m.school_id = p_school and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_school_admin(p_school uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.school_memberships m
    where m.school_id = p_school and m.user_id = auth.uid() and m.role = 'admin'
  );
$$;

create or replace function public.is_class_teacher(p_class uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.class_memberships m
    where m.class_id = p_class and m.user_id = auth.uid() and m.role = 'teacher'
  );
$$;

-- True if the caller is a teacher who shares at least one class with p_student.
create or replace function public.teaches_student(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.class_memberships t
    join public.class_memberships s on s.class_id = t.class_id
    where t.user_id = auth.uid() and t.role = 'teacher'
      and s.user_id = p_student and s.role = 'student'
  );
$$;

-- ---------------------------------------------------------------------------
-- Enable Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.schools             enable row level security;
alter table public.school_memberships  enable row level security;
alter table public.classes             enable row level security;
alter table public.class_memberships   enable row level security;
alter table public.competencies        enable row level security;
alter table public.missions            enable row level security;
alter table public.mission_competencies enable row level security;
alter table public.submissions         enable row level security;
alter table public.ai_evaluations      enable row level security;
alter table public.badges              enable row level security;
alter table public.user_badges         enable row level security;
alter table public.user_progress       enable row level security;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

-- profiles: own row; teachers can read their students.
create policy "profiles_select_self_or_teacher" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.teaches_student(id));

create policy "profiles_insert_self" on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- schools / classes: visible to members of the school.
create policy "schools_select_member" on public.schools
  for select to authenticated
  using (public.is_school_member(id));

create policy "school_memberships_select_self_or_admin" on public.school_memberships
  for select to authenticated
  using (user_id = auth.uid() or public.is_school_admin(school_id));

create policy "classes_select_member" on public.classes
  for select to authenticated
  using (public.is_school_member(school_id));

create policy "class_memberships_select_self_or_teacher" on public.class_memberships
  for select to authenticated
  using (user_id = auth.uid() or public.is_class_teacher(class_id));

-- catalog: readable by any authenticated user (published missions only).
create policy "competencies_select_all" on public.competencies
  for select to authenticated
  using (true);

create policy "missions_select_published" on public.missions
  for select to authenticated
  using (status = 'published');

create policy "mission_competencies_select_published" on public.mission_competencies
  for select to authenticated
  using (exists (
    select 1 from public.missions m
    where m.id = mission_id and m.status = 'published'
  ));

create policy "badges_select_all" on public.badges
  for select to authenticated
  using (true);

-- submissions: student owns; teacher of the student can read/update.
create policy "submissions_select_owner_or_teacher" on public.submissions
  for select to authenticated
  using (student_id = auth.uid() or public.teaches_student(student_id));

create policy "submissions_insert_owner" on public.submissions
  for insert to authenticated
  with check (student_id = auth.uid());

create policy "submissions_update_owner_or_teacher" on public.submissions
  for update to authenticated
  using (student_id = auth.uid() or public.teaches_student(student_id))
  with check (student_id = auth.uid() or public.teaches_student(student_id));

-- ai_evaluations: visible to the submission owner or their teacher.
-- Writes happen server-side (service role) -> no insert/update policy.
create policy "ai_evaluations_select_owner_or_teacher" on public.ai_evaluations
  for select to authenticated
  using (exists (
    select 1 from public.submissions s
    where s.id = submission_id
      and (s.student_id = auth.uid() or public.teaches_student(s.student_id))
  ));

-- progress + badges: own rows; teacher of the student can read.
create policy "user_badges_select_owner_or_teacher" on public.user_badges
  for select to authenticated
  using (user_id = auth.uid() or public.teaches_student(user_id));

create policy "user_progress_select_owner_or_teacher" on public.user_progress
  for select to authenticated
  using (user_id = auth.uid() or public.teaches_student(user_id));

-- ---------------------------------------------------------------------------
-- Indexes (foreign-key / lookup paths)
-- ---------------------------------------------------------------------------
create index if not exists idx_school_memberships_user on public.school_memberships (user_id);
create index if not exists idx_class_memberships_user  on public.class_memberships (user_id);
create index if not exists idx_class_memberships_class on public.class_memberships (class_id);
create index if not exists idx_classes_school          on public.classes (school_id);
create index if not exists idx_submissions_student     on public.submissions (student_id);
create index if not exists idx_submissions_mission     on public.submissions (mission_id);
create index if not exists idx_submissions_class       on public.submissions (class_id);
create index if not exists idx_user_progress_user      on public.user_progress (user_id);
create index if not exists idx_user_badges_user        on public.user_badges (user_id);
create index if not exists idx_mission_competencies_competency on public.mission_competencies (competency_id);
