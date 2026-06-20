-- Student-proposed quests aren't tied to a catalog mission, but a submission's
-- `mission_id` is a NOT NULL FK to missions(id). Quest solution submissions
-- therefore use this stable placeholder; the real quest is linked back via
-- student_quests.submission_id.
--
-- NOTE: the catalog missions themselves are seeded from data/missions.json
-- (the missions table must contain those ids for normal mission submissions to
-- satisfy the same FK).
insert into public.missions (id, title, goal, difficulty, suggested_mode, status, base_xp)
values (
  'custom-quest',
  'Vlastná misia žiaka',
  'Žiakom navrhnutá misia (quest) — hodnotí sa podľa vlastného cieľa a dôkazu.',
  'medium',
  'individual',
  'published',
  100
)
on conflict (id) do nothing;
