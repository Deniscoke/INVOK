-- Applied 2026-06-21 via Supabase MCP. Per-lesson completion for the Akadémia
-- (video courses). Service-role only (RLS-on, no policies).
create table if not exists public.academy_progress (
  id uuid primary key default gen_random_uuid(),
  student_access_code_id uuid not null references public.student_access_codes(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  module_id text not null,
  lesson_id text not null,
  quiz_score integer not null default 0,
  quiz_max integer not null default 0,
  xp_awarded integer not null default 0,
  completed_at timestamptz not null default now(),
  unique (student_access_code_id, lesson_id)
);
create index if not exists idx_academy_class on public.academy_progress (class_id);
create index if not exists idx_academy_access_code on public.academy_progress (student_access_code_id);
alter table public.academy_progress enable row level security;
