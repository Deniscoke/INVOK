# Roadmapa

Postupné fázy od skeletu k pilotu a grantovému reportingu.

| Fáza | Cieľ | Stav |
|---|---|---|
| 1. Scaffold | Bezpečný základ: stack, dáta, schéma, mock AI, testy, CI. | ✅ |
| 2. Supabase Auth + role | Auth pre učiteľa/admina, pseudonymný prístup žiaka (kódy + session), RLS pre auth tabuľky. | ✅ |
| 3. Submission workflow + AI | Odovzdania (CRUD), mock AI validácia, XP/progres, teacher review view, migrácia 003. | ✅ táto iterácia |
| 4. AI validácia | Výmena mocku za reálne Claude volanie podľa `aiValidationPrompt`. | ⏳ |
| 5. Teacher review | UI a workflow učiteľského posúdenia, prepis AI návrhu. | ⏳ |
| 6. Školský dashboard | Anonymizovaný/pseudonymizovaný progres triedy a školy. | ⏳ |
| 7. Pilot v škole | Nasadenie s reálnou triedou, zber spätnej väzby, ladenie rubrík. | ⏳ |
| 8. Grantový reporting | Merateľné výstupy, dopad, súlad so ŠVP ZV. | ⏳ |

## Zámerne mimo tejto iterácie

Plná autentifikácia, reálne AI volania, reálny upload súborov, produkčný
školský dashboard, platby, e-maily, komplexný admin systém.

## Najbližší krok

**Fáza 4 — reálne Claude AI volanie.** Vymeniť `mockEvaluate` v
`aiValidationService.ts` za reálne Claude API (prompt šablóna je v
`aiValidationPrompt.ts`). Pridať rate limiting a cost safeguards. Voliteľne
naviazať žiaka na `auth.users` cez `signInAnonymously` pre priame RLS čítanie
(migrácia `002` + `003` sú DB-ready).
