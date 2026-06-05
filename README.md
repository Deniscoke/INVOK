# INVOk

Gamifikovaná vzdelávacia platforma pre slovenské základné školy (ŠVP ZV).
Žiaci riešia zmysluplné **misie**, mapujú problémy, navrhujú riešenia, zbierajú
dôkazy a dostávajú **formatívnu AI spätnú väzbu** — pričom **učiteľ zostáva
garantom**. Súkromie žiakov je v základe dizajnu (pseudonymita, žiadne verejné
rebríčky).

> Toto je MVP **skelet**: pevný, bezpečný a profesionálny základ. Plná
> autentifikácia, reálne AI volania a upload sú zámerne mimo tejto iterácie.

## Stack

- **Frontend:** Vite + TypeScript (vanilla ES moduly, bez frameworku)
- **API:** Vercel serverless funkcie (`api/`)
- **Dáta:** Supabase Postgres + Auth/Storage (pripravenosť) s **RLS**
- **Testy:** Vitest · **CI:** GitHub Actions · **Deploy:** Vercel

## Štruktúra

```
api/         serverless endpointy (health, competencies, missions, ai/validate-submission)
backend/     lib (env, supabaseAdmin), services, validators, prompts  — SERVER-ONLY
frontend/    src: components, pages, services, styles
data/        kurikulárny katalóg (competencies, missions, badges) + demo seed
supabase/    migrácie + seed.sql
docs/        ARCHITECTURE, SECURITY, DATABASE, AI_VALIDATION, GAMIFICATION_MODEL, CURRICULUM_MAPPING, ROADMAP
tests/       data, ai, security, db
```

## Začíname

```bash
npm install
cp .env.example .env   # vyplň hodnoty; NIKDY necommituj reálny .env
npm run dev            # http://localhost:5173
```

## Skripty

```bash
npm run dev         # vývojový server
npm run build       # produkčný build do dist/
npm run preview     # náhľad buildu
npm test            # Vitest (jednorazovo)
npm run test:watch  # Vitest watch
npm run typecheck   # tsc --noEmit
```

## Bezpečnosť (kľúčové)

- `VITE_*` premenné idú do frontendu; `SUPABASE_SERVICE_ROLE_KEY` a
  `OPENAI_API_KEY` **nikdy** — sú server-only.
- `backend/lib/supabaseAdmin.ts` používa service role key (obchádza RLS) a
  **nesmie** sa importovať do frontend kódu. Test to stráži automaticky.
- Viac v [docs/SECURITY.md](docs/SECURITY.md).

## Role a prístup

- **Učiteľ / admin:** Supabase Auth (e-mail/heslo, magic-link pripravenosť).
- **Žiak:** pseudonymný prístup kódom triedy + prezývka (napr. `Líška-07`),
  **bez e-mailu**. Kódy a session tokeny sa ukladajú len ako hash.
- Bez Supabase tajomstiev beží appka v **demo** režime (plne spustiteľná).
- Detaily: [docs/SECURITY.md](docs/SECURITY.md), migrácia
  `supabase/migrations/002_auth_and_student_access.sql`.

## AI validácia (mock / OpenAI)

- Default je **mock** (offline, bez API nákladov). AI je vždy **formatívna**,
  nie finálny známkovač — učiteľ je garant.
- Reálne OpenAI volanie zapneš na serveri: `OPENAI_VALIDATION_PROVIDER=openai`
  + `OPENAI_API_KEY` + `OPENAI_VALIDATION_MODEL` (Responses API, štruktúrovaný
  JSON). Bez kľúča sa použije mock.
- Do AI sa **neposielajú osobné údaje**; raw prompty sa neukladajú. Detaily:
  [docs/AI_VALIDATION.md](docs/AI_VALIDATION.md).
- **Rate limiting + cost guard:** AI endpointy majú per-identity limit (žiak/učiteľ),
  denné limity a 429 odpoveď; anonymný používateľ beží len na mocku. In-memory MVP —
  produkčne Redis/Upstash. Viď [docs/SECURITY.md](docs/SECURITY.md).
- **Učiteľ je garant:** AI dá návrh, učiteľ ho potvrdí/upraví/vráti/zamietne
  (`teacher_reviews`, auditovateľné). **Finálne XP sa pripíše až po
  učiteľskom schválení** (approve/adjust).
- **Podnikavosť:** žiak získa **predbežné XP (10–40 %)** aj za kvalitný **návrh
  problému** (`submission_kind='problem_proposal'`), nielen za celé riešenie.

## Ďalšie kroky

Pozri [docs/ROADMAP.md](docs/ROADMAP.md). Najbližšie: Fáza 6 — školský dashboard
(agregovaný anonymizovaný progres).
