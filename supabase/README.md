# Supabase

Database, Auth and Storage for INVOk. This folder holds the SQL the project
applies to a Supabase Postgres project.

## Files

- `migrations/001_initial_schema.sql` — tables, constraints, RLS, helper
  functions, triggers, indexes.
- `seed.sql` — curriculum catalog + demo missions. **No personal data.**

## Apply (Supabase CLI)

```bash
# link once
supabase link --project-ref <your-project-ref>

# apply schema, then seed
supabase db push
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

Or paste the file contents into the Supabase SQL editor (schema first, seed second).

## Security model (summary)

- **RLS is ON** for every user/school table.
- Students can read/write only their own rows.
- Teachers can read profiles, submissions and progress of students **in their
  own classes** (via the `teaches_student()` helper).
- Catalog tables (`competencies`, `badges`, published `missions`) are readable
  by any authenticated user.
- `ai_evaluations`, `user_progress`, `user_badges` and catalog **writes** are
  intended to happen **server-side via the service role key**, which bypasses
  RLS. The service role key is NEVER shipped to the browser.

## Known limitations (MVP)

- Teacher/admin **write** policies are intentionally minimal; content
  management currently runs through the server.
- `profiles` is readable to self + teacher-of-student only; broader school-admin
  visibility is a follow-up.
- Helper functions are `SECURITY DEFINER` to avoid RLS recursion — review their
  ownership when hardening for production.

See [../docs/DATABASE.md](../docs/DATABASE.md) and [../docs/SECURITY.md](../docs/SECURITY.md).
