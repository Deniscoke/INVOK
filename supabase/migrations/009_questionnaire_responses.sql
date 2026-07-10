-- Applied 2026-06-21 via Supabase MCP. Pseudonymous INVOK pre/post competency
-- self-assessment (6 areas x 8 Likert items). Service-role only (RLS-on, no policies).
create table if not exists public.questionnaire_responses (
  id uuid primary key default gen_random_uuid(),
  student_access_code_id uuid not null references public.student_access_codes(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  phase text not null check (phase in ('input','output')),
  answers jsonb not null default '{}'::jsonb,
  open_answers jsonb not null default '{}'::jsonb,
  area_scores jsonb not null default '{}'::jsonb,
  total_score integer not null default 0,
  max_score integer not null default 240,
  xp_awarded integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_access_code_id, phase)
);
create index if not exists idx_questionnaire_class on public.questionnaire_responses (class_id);
create index if not exists idx_questionnaire_access_code on public.questionnaire_responses (student_access_code_id);
alter table public.questionnaire_responses enable row level security;
