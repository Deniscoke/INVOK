# Roadmapa

Postupné fázy od skeletu k pilotu a grantovému reportingu.

| Fáza | Cieľ | Stav |
|---|---|---|
| 1. Scaffold | Bezpečný základ: stack, dáta, schéma, mock AI, testy, CI. | ✅ |
| 2. Supabase Auth + role | Auth pre učiteľa/admina, pseudonymný prístup žiaka (kódy + session), RLS pre auth tabuľky. | ✅ táto iterácia |
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

**Fáza 3 — reálne CRUD misií a odovzdaní cez Supabase.** Pripojiť čítanie pod
RLS, presunúť zápisy submissions/progress na server a vymeniť mock student
access za DB-ready cestu (migrácia `002` je pripravená). Voliteľne naviazať
žiaka na `auth.users` cez `signInAnonymously` pre priame RLS čítanie.
