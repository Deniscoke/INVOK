# Architektúra

INVOk je jednorepozitárový skelet navrhnutý tak, aby bol lacný, čitateľný a
auditovateľný — vhodný pre grantový a pilotný kontext.

## Vrstvy

| Vrstva | Umiestnenie | Zodpovednosť |
|---|---|---|
| Frontend | `frontend/src` | Vanilla TS UI: stránky, komponenty, mock dáta. Bez frameworku. |
| API | `api/` | Vercel serverless endpointy, tenké obaly nad službami. |
| Backend (server-only) | `backend/` | Validátory, služby (AI, misie, progres), prompty, env, Supabase admin. |
| Dáta / katalóg | `data/`, `supabase/` | Kurikulárny katalóg + Postgres schéma a seed. |

## Hranica server / klient

Najdôležitejšie pravidlo: **server-only kód sa nikdy nebundluje do frontendu.**

- `backend/lib/supabaseAdmin.ts` a `backend/lib/env.ts` čítajú tajomstvá a
  obchádzajú RLS. Importujú sa len z `api/` a `backend/`.
- Frontend má vlastné typy (`frontend/src/services/mockDataService.ts`) a
  nikdy neimportuje z `backend/`.
- Test `tests/security/noPersonalData.test.ts` automaticky stráži, že tajné
  kľúče nie sú vo frontend zdrojoch.

## Tok dát (odovzdanie misie — cieľový stav)

```
žiak → frontend → POST /api/ai/validate-submission
     → submissionValidator (vstup) → aiValidationService (formatívna validácia)
     → ai_evaluations (server/service role) → učiteľ posúdi → progres + odznaky
```

V tejto iterácii je AI validácia **mock**, ale kontrakt (`AIValidationResult`)
je finálny, takže výmena za reálne Claude volanie nemení volajúcich ani testy.

## Prečo tento stack

- **Vite + TS + vanilla moduly:** rýchly build, nízka chybovosť pri práci s
  rolami/rubricami/JSON, jednoduchý a auditovateľný MVP.
- **Vercel Functions:** natívne GitHub preview deploymenty, server-only logika.
- **Supabase Postgres + RLS:** silná autorizácia priamo v databáze
  (defense-in-depth), Auth a Storage pripravené.

Podrobnosti: [DATABASE.md](DATABASE.md) · [SECURITY.md](SECURITY.md) ·
[AI_VALIDATION.md](AI_VALIDATION.md).
