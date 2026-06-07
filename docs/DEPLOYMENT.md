# Deployment (Vercel + Supabase)

Pilot-ready deployment guide. The app runs as a **Vite + TypeScript** frontend
with **Vercel serverless functions** in `api/`, backed by **Supabase Postgres**.

## 1. Vercel project settings

| Setting | Value |
|---|---|
| Framework Preset | Vite |
| Root Directory | `.` (repo root — leave default) |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js Version | 20.x (pinned via `engines`) |

`api/` is auto-detected as serverless functions (Fluid Compute). No extra config.
**Hobby/Free plan compatible**: 12 functions total (catch-all routers like
`api/admin/[...path].ts` consolidate related routes — frontend URLs unchanged).

## 2. Environment variables (Vercel → Settings → Environment Variables)

### Public — safe in the browser bundle (`VITE_` prefix)
```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_ENV=production
VITE_PUBLIC_BASE_URL=https://<your-app>.vercel.app
```

### Server-only — NEVER exposed to the frontend
```env
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_VALIDATION_MODEL=gpt-5.5
OPENAI_VALIDATION_PROVIDER=mock
OPENAI_VALIDATION_TIMEOUT_MS=15000
OPENAI_VALIDATION_LOG_RAW_PROMPTS=false
APP_ENV=production
# Bootstrap ONLY — set true to create the first school, then set back to false.
PILOT_SETUP_ENABLED=false
```

> AI rate/cost limits (`AI_RATE_LIMIT_*`, `AI_DAILY_*`, `AI_*_EVIDENCE_CHARS`)
> have safe defaults — set them only to override.

### Notes
- **`OPENAI_VALIDATION_PROVIDER=mock`** for the first pilot deploy. Switch to
  `openai` only after reviewing cost (then also set `OPENAI_API_KEY`).
- **`SUPABASE_SERVICE_ROLE_KEY`** lives only in Vercel env (bypasses RLS).
  Never put it in `VITE_*` or `.env.example`.
- **`.env`** is local only and is gitignored. **`.env.example`** has only
  placeholders.
- **Setup mode:** `PILOT_SETUP_ENABLED` is the *only* switch that opens school
  creation / class-scope bypass. It is **secure-by-default off**. Set it `true`
  only while bootstrapping the first school, then set it back to `false`.
- Without Supabase env set, the app still runs in a safe **mock/demo** mode.

## 3. Supabase migrations

Apply in order (Supabase SQL editor or CLI):

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_auth_and_student_access.sql
supabase/migrations/003_submission_workflow.sql
supabase/migrations/004_teacher_review_workflow.sql
supabase/migrations/005_problem_proposal_rewards.sql
supabase/migrations/006_auto_create_profile.sql
```

Migration 006 installs a trigger on `auth.users` that auto-creates the
matching `profiles` row from the signup metadata. Without it teacher
registration cannot complete and you will see `Could not find the table
'public.profiles'`. See [SUPABASE_AUTH_SETUP.md](SUPABASE_AUTH_SETUP.md)
for the full auth-side checklist (Site URL, Redirect URLs, email
confirmation).

Then (optional) seed the catalog: `supabase/seed.sql` (competencies, badges,
published missions — **no personal data**). All migrations are idempotent and
enable RLS on user/school tables. See [DATABASE.md](DATABASE.md).

## 4. Deploy

Push to `master` → Vercel builds and deploys automatically (repo is linked).
First deploy keep `OPENAI_VALIDATION_PROVIDER=mock`. Verify with
[PILOT_SMOKE_TEST.md](PILOT_SMOKE_TEST.md).

## 5. Enable real AI (later, optional)

After a cost review: set `OPENAI_VALIDATION_PROVIDER=openai` + `OPENAI_API_KEY`
+ `OPENAI_VALIDATION_MODEL`, redeploy. AI stays **formative** — the teacher is
always the guarantor. See [AI_VALIDATION.md](AI_VALIDATION.md).
