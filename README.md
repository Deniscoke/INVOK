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
  `ANTHROPIC_API_KEY` **nikdy** — sú server-only.
- `backend/lib/supabaseAdmin.ts` používa service role key (obchádza RLS) a
  **nesmie** sa importovať do frontend kódu. Test to stráži automaticky.
- Viac v [docs/SECURITY.md](docs/SECURITY.md).

## Ďalšie kroky

Pozri [docs/ROADMAP.md](docs/ROADMAP.md). Najbližšie: Supabase Auth + role.
