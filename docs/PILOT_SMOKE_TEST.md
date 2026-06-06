# Pilot smoke test

Manual end-to-end check after a Vercel deploy. ~10 minutes. Do it in a fresh
browser session. Keep `OPENAI_VALIDATION_PROVIDER=mock` for this run.

> Prereq for the DB-backed flow: Supabase env set, migrations applied, and a
> teacher/admin Supabase user + `profiles` row. To bootstrap the first school
> set `PILOT_SETUP_ENABLED=true` temporarily (then back to `false`). Without
> Supabase, every step still works in **demo** mode (anonymized mock data).

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the Vercel URL | App loads, no console errors |
| 2 | Landing page | Hero + mascot + "Začať misiu" CTA |
| 3 | Teacher login (`/login`) or demo fallback | Logs in (Supabase) or "demo" chip appears |
| 4 | Open `/pilot` | Pilot setup page loads (school form) |
| 5 | Create a school | "Škola vytvorená" + class form appears |
| 6 | Create a class | "Trieda vytvorená" + code generator appears |
| 7 | Generate 3 student codes (prefix `Líška`, count 3) | 3 rows `Líška-01/02/03` + plaintext codes |
| 8 | Confirm one-time view warning | "Kódy sa zobrazia IBA RAZ" banner shown |
| 9 | Copy one code | Copied to clipboard (Copy button) |
| 10 | Open student join (`/join`) | Code field shown; pseudonym optional |
| 11 | Join with the copied code | Redirects to `/student`, alias = `Líška-0X` |
| 12 | Submit a problem proposal ("Navrhni problém") | Form accepts title/observation/evidence/idea |
| 13 | Check provisional AI feedback | AI card: score/confidence/reasons + "predbežná odmena" |
| 14 | Open teacher dashboard (`/teacher`) | School dashboard KPIs + review queue load |
| 15 | Inspect a submission | Submission appears in "Odovzdania na posúdenie" |
| 16 | Do a teacher review (approve/adjust) | "Hodnotenie uložené" + final XP shown |
| 17 | Verify XP committed only after review | XP totals change only post-review (not at submit) |
| 18 | Open dashboard reporting (top of `/teacher`) | KPIs, competencies, proposals, review stats render |
| 19 | Click "Export CSV (anonymizovaný)" | A `.csv` downloads |
| 20 | Inspect the CSV | Only `class_id`/slugs/aggregates — **no names, emails, tokens, codes, hashes** |

## Pass criteria
- No 500s in the Vercel function logs.
- Student never asked for an email or real name.
- Student access code plaintext shown **once**; the list view never shows it again.
- XP appears in totals only **after** a teacher review (approve/adjust).
- CSV export contains no PII (names/emails/codes/tokens/hashes) and no secrets.

## Rollback
If a step fails, the deploy is non-destructive: revert env to
`OPENAI_VALIDATION_PROVIDER=mock` and/or redeploy the previous commit. Data lives
in Supabase; no migration is destructive.
