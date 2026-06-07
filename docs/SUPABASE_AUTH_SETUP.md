# Supabase Auth – pilot setup checklist

When you see one of these on `/login`:

- `Could not find the table 'public.profiles' in the schema cache`
- The confirmation e-mail points to `localhost:3000/...&error_code=otp_expired`

it means your Supabase project still has the **default** auth configuration.
Run the 4 steps below once per project and registration starts working.

---

## 1. Apply database migrations

Open **Supabase → SQL editor** and run each file in `supabase/migrations/` **in
order** (you can paste the contents directly):

```
001_initial_schema.sql
002_auth_and_student_access.sql
003_submission_workflow.sql
004_teacher_review_workflow.sql
005_problem_proposal_rewards.sql
006_auto_create_profile.sql     <-- creates the profiles trigger
```

> All migrations are idempotent (`create … if not exists`, `on conflict do
> nothing`) — re-running them is safe.

After 006 you can verify:

```sql
select tgname from pg_trigger where tgname = 'trg_auth_user_create_profile';
-- expected: one row
select count(*) from public.profiles;
-- expected: same as the number of teachers/admins you already created
```

## 2. Configure Auth → URL Configuration

In **Supabase → Authentication → URL Configuration** set:

| Field | Value |
|---|---|
| Site URL | `https://invok-one.vercel.app` (your production URL) |
| Redirect URLs (allow list) | `https://invok-one.vercel.app/**` *(add `http://localhost:5173/**` only for local dev)* |

Save. After this the e-mail confirmation link in Supabase mails will point at
the deployed app instead of `localhost:3000`.

> The frontend already passes `emailRedirectTo` to `supabase.auth.signUp()`,
> but Supabase only honours that value if the URL is present in the allow
> list above — otherwise it falls back to Site URL.

## 3. Decide on e-mail confirmation

In **Supabase → Authentication → Providers → Email**:

- **Pilot / demo** (recommended for next week's presentation): turn
  **"Confirm email"** OFF. New teachers are logged in immediately after
  registration without the confirmation hop.
- **Production**: keep it ON. The link from step 2 will work correctly.

## 4. (Once, for the first school) enable pilot setup mode

In **Vercel → Project → Settings → Environment Variables** set:

```
PILOT_SETUP_ENABLED=true
```

Redeploy. Now a freshly-registered teacher can create the **first** school /
class / student codes on `/pilot`. Once the first school exists, **set the
variable back to `false`** and redeploy — further schools then require an
existing admin. This is the same secure-by-default switch documented in
[DEPLOYMENT.md](DEPLOYMENT.md) §2.

---

## Smoke test (~2 minutes)

1. Open the deployed URL → `/login` → **Registrácia**
2. Fill in name + e-mail + password (≥ 6 chars) → **Vytvoriť účet**
   - If confirm-email is OFF you land on `/pilot` immediately
   - If confirm-email is ON: open the e-mail, the link should now point at
     `https://invok-one.vercel.app/...` and log you in
3. `/pilot` → create school → class → 3 student codes
4. Copy a student code → `/join` → student dashboard works
5. Submit a problem proposal → AI feedback appears (real DB now, not demo)

If any step still fails, see Vercel function logs (Project → Deployments →
latest → Functions) and Supabase logs (Project → Logs → Auth / Postgres).
