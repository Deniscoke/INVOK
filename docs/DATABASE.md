# Databáza

Postgres (Supabase). Schéma: `supabase/migrations/001_initial_schema.sql`,
seed: `supabase/seed.sql`. UUID kľúče, timestamps, check constraints, RLS.

## Tabuľky

| Tabuľka | Účel |
|---|---|
| `profiles` | Identita + rola (`admin`/`teacher`/`student`), **pseudonym**, XP, level. |
| `schools`, `school_memberships` | Školy a členstvo (admin/teacher). |
| `classes`, `class_memberships` | Triedy a členstvo (teacher/student). |
| `competencies` | Katalóg hrdinských kompetencií + interné kurikulárne mapovanie. |
| `missions`, `mission_competencies` | Misie (rubrika, XP, mód) a väzba na kompetencie. |
| `submissions` | Odovzdania žiakov (text + dôkaz, stav, XP). |
| `ai_evaluations` | Formatívny výstup AI (1:1 k submission). |
| `badges`, `user_badges` | Odznaky a ich udelenia. |
| `user_progress` | Progres XP/level/mastery na kompetenciu. |

## Vzťahy (zjednodušene)

```
auth.users 1—1 profiles
schools 1—* classes 1—* class_memberships *—1 profiles
missions *—* competencies   (cez mission_competencies)
profiles 1—* submissions 1—1 ai_evaluations
profiles 1—* user_progress *—1 competencies
profiles 1—* user_badges *—1 badges
```

## RLS model

- **Žiak**: vidí/píše len svoje `submissions`, `user_progress`, `user_badges`,
  svoj `profiles` riadok.
- **Učiteľ**: cez `teaches_student()` vidí profily, odovzdania, AI hodnotenia a
  progres žiakov vo **svojich triedach**.
- **Katalóg**: `competencies`, `badges`, publikované `missions` čitateľné pre
  prihlásených.
- **Zápisy** do `ai_evaluations`, `user_progress`, `user_badges` a katalógu:
  cez **service role** (server), nie z klienta.
- Pomocné funkcie sú `SECURITY DEFINER`, aby politiky nerekurzovali do tej istej
  tabuľky.

## Seed

`seed.sql` vkladá 8 kompetencií, 8 odznakov, 7 publikovaných misií a ich väzby.
**Žiadne osobné údaje.**

## Auth a žiacky prístup (migrácia 002)

| Tabuľka | Účel |
|---|---|
| `class_join_codes` | Učiteľom vydaný kód triedy. Ukladá `code_hash`, expiráciu, limit použití. |
| `student_access_codes` | Pseudonymná identita žiaka v triede (pseudonym, `code_hash`). Bez e-mailu. |
| `student_sessions` | Bearer session žiaka — len `session_token_hash` + expirácia. |

RLS: kódy spravuje len správca triedy (učiteľ/admin) cez helper `manages_class()`.
`student_sessions` má RLS **bez policy** → prístup len cez service role (server).
Plaintext kódov/tokenov sa neukladá; hash sa nevracia cez student API.

## Teacher review (migrácia 004)

| Tabuľka | Účel |
|---|---|
| `teacher_reviews` | Auditovateľné rozhodnutie učiteľa nad AI návrhom: `decision` (`approved`/`adjusted`/`needs_revision`/`rejected`), `final_valid`, `final_score` (0–100), `feedback_text`, `adjustment_reason`, reviewer + timestamps. |

`submissions.status` rozšírený o `rejected`. RLS na `teacher_reviews`: číta
reviewer / správca triedy (`manages_submission()`) / vlastník odovzdania
(`owns_submission()`); zapisuje len správca triedy ako sám seba. Finálne XP
commituje server (`teacherReviewService.applyReviewToSubmission`) po
approve/adjust.

## Problem proposal (migrácia 005)

`submissions` rozšírené (Variant A — bez paralelného systému):

| Stĺpec | Účel |
|---|---|
| `submission_kind` | `problem_proposal` / `solution_submission` / `reflection`. |
| `problem_quality_score` | Kvalita návrhu problému (0–100), null pre iné. |
| `problem_reward_xp` | Predbežná odmena za návrh (commit až po teacher review). |

Bez osobných údajov. Scoring: `problemProposalService` +
`progressService.problemProposalXp` (10–40 % základného XP misie).

## Otvorené otázky / limity

- Žiaci zatiaľ **nie sú viazaní na `auth.users`**; priame čítanie pod RLS pre
  žiaka je ďalší krok (možnosť `signInAnonymously`). Teraz validuje server.
- Učiteľské/admin **write** politiky sú zatiaľ minimálne (správa obsahu cez server).
- Širšia viditeľnosť pre školského admina nad `profiles` je follow-up.
- Pri tvrdení produkcie overiť vlastníctvo `SECURITY DEFINER` funkcií.
- Storage politiky pre upload dôkazov zatiaľ nie sú definované.
