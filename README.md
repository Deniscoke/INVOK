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

## Školský dashboard (anonymizovaný reporting)

- Pre **učiteľa/admina** (`/api/dashboard/*`, 403 pre žiaka/anonymného): KPI
  prehľad, kompetenčný progres, súhrn návrhov problémov, štatistiky review
  (vrátane rozdielu AI vs. učiteľ) a **CSV export**.
- **Iba agregáty** (počty/priemery) — žiadne mená, e-maily, kódy, tokeny, hashe.
  Bez API beží v bezpečnom **demo** režime s anonymizovanými mock dátami.
- Detaily: [docs/SECURITY.md](docs/SECURITY.md).

## Pilot setup

Stránka **`/pilot`** (učiteľ/admin) umožní založiť školu a triedu a vygenerovať
**pseudonymné žiacke kódy**:

- Kódy sa zobrazia **iba raz** (na vytlačenie/rozdanie) — do DB ide len ich
  hash, plaintext sa neukladá ani neloguje.
- Zoznam existujúcich kódov nikdy nevracia plaintext ani hash.
- Žiak sa pripojí osobným kódom (prezývku má pridelenú) alebo kódom triedy +
  vlastnou prezývkou — **bez e-mailu**. Dashboard filter používa reálne triedy.
- Bootstrap prvej školy bez admina: `PILOT_SETUP_ENABLED=true` (secure-by-default
  **off** — zapni len počas bootstrapu, potom späť `false`).
  Bez API beží UI v bezpečnom **demo** režime. Detaily: [docs/SECURITY.md](docs/SECURITY.md).

## Pilot deployment quickstart

1. **Vercel env vars** — nastav podľa [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
   (Supabase + `OPENAI_VALIDATION_PROVIDER=mock`, `PILOT_SETUP_ENABLED=false`).
2. **Supabase migrácie** — spusti `001`–`005` z `supabase/migrations/` (+ voliteľne `seed.sql`).
3. **Deploy** — push na `master` (Vercel deploy z GitHubu).
4. **Bootstrap** — dočasne `PILOT_SETUP_ENABLED=true`, otvor `/pilot`.
5. Vytvor **školu** a **triedu**.
6. Vygeneruj **žiacke kódy** (zobrazia sa raz — vytlač/rozdaj). Vráť `PILOT_SETUP_ENABLED=false`.
7. Otestuj **žiacke prihlásenie** cez kód (`/join`) a **dashboard** + CSV (`/teacher`).

Plný smoke test: [docs/PILOT_SMOKE_TEST.md](docs/PILOT_SMOKE_TEST.md).

## Ďalšie kroky

Pozri [docs/ROADMAP.md](docs/ROADMAP.md). Najbližšie: Fáza 8 — grantový reporting
a reálny pilot (pripojenie Supabase, produkčné ladenie).
