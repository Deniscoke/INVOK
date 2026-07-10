-- Applied 2026-07-10 via Supabase MCP. Databáza školských projektov
-- ("Ako žiaci menia svoje školy"): teacher-curated publishing of COMPLETED quests.
alter table public.student_quests
  add column if not exists gallery_published_at timestamptz,
  add column if not exists gallery_published_by uuid references public.profiles(id) on delete set null;
create index if not exists idx_student_quests_gallery
  on public.student_quests (gallery_published_at)
  where gallery_published_at is not null;
