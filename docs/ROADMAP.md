# Roadmapa

Postupné fázy od skeletu k pilotu a grantovému reportingu.

| Fáza | Cieľ | Stav |
|---|---|---|
| 1. Scaffold | Bezpečný základ: stack, dáta, schéma, mock AI, testy, CI. | ✅ táto iterácia |
| 2. Supabase Auth + role | Prihlásenie, mapovanie `auth.users` → `profiles`, rola admin/teacher/student. | ⏳ ďalší krok |
| 3. Reálne CRUD | Misie a odovzdania cez Supabase (čítanie pod RLS, zápisy server-side). | ⏳ |
| 4. AI validácia | Výmena mocku za reálne Claude volanie podľa `aiValidationPrompt`. | ⏳ |
| 5. Teacher review | UI a workflow učiteľského posúdenia, prepis AI návrhu. | ⏳ |
| 6. Školský dashboard | Anonymizovaný/pseudonymizovaný progres triedy a školy. | ⏳ |
| 7. Pilot v škole | Nasadenie s reálnou triedou, zber spätnej väzby, ladenie rubrík. | ⏳ |
| 8. Grantový reporting | Merateľné výstupy, dopad, súlad so ŠVP ZV. | ⏳ |

## Zámerne mimo tejto iterácie

Plná autentifikácia, reálne AI volania, reálny upload súborov, produkčný
školský dashboard, platby, e-maily, komplexný admin systém.

## Najbližší krok

**Fáza 2 — Supabase Auth + role.** Pripojiť anon klienta vo frontende, doplniť
trigger na vytvorenie `profiles` po registrácii a doladiť teacher/admin RLS
politiky (viď otvorené otázky v [DATABASE.md](DATABASE.md)).
