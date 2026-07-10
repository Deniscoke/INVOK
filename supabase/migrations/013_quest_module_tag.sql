-- Applied 2026-07-10 via Supabase MCP. Tag each project challenge with the
-- programme module it develops (m1 Podnikavosť · m2 Kritické myslenie ·
-- m3 Tímová spolupráca · m4 Komunikácia).
alter table public.student_quests
  add column if not exists module_id text check (module_id in ('m1','m2','m3','m4'));
create index if not exists idx_student_quests_module on public.student_quests (module_id);
