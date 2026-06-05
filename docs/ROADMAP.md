# Roadmapa

Postupné fázy od skeletu k pilotu a grantovému reportingu.

| Fáza | Cieľ | Stav |
|---|---|---|
| 1. Scaffold | Bezpečný základ: stack, dáta, schéma, mock AI, testy, CI. | ✅ |
| 2. Supabase Auth + role | Auth pre učiteľa/admina, pseudonymný prístup žiaka (kódy + session), RLS pre auth tabuľky. | ✅ |
| 3. Submission workflow + AI | Odovzdania (CRUD), mock AI validácia, XP/progres, teacher review view, migrácia 003. | ✅ |
| 4. AI validácia | Reálny OpenAI provider (mock/openai switch), JSON validátor, bezpečný fallback. | ✅ |
| 5. Teacher review | Auditovateľný review (approve/adjust/needs_revision/reject), finálne XP gate, migrácia 004. | ✅ táto iterácia |
| 6. Školský dashboard | Anonymizovaný/pseudonymizovaný progres triedy a školy. | ⏳ |
| 7. Pilot v škole | Nasadenie s reálnou triedou, zber spätnej väzby, ladenie rubrík. | ⏳ |
| 8. Grantový reporting | Merateľné výstupy, dopad, súlad so ŠVP ZV. | ⏳ |

## Zámerne mimo tejto iterácie

Reálny upload súborov, produkčný školský dashboard, platby, e-maily, komplexný
admin systém.

## Najbližší krok

**Fáza 6 — školský dashboard.** Agregovaný anonymizovaný/pseudonymizovaný
progres triedy a školy z `teacher_reviews` + `user_progress` (pre školského
admina). Pridať rate limiting na AI endpoint a cost safeguards. Voliteľne
naviazať žiaka na `auth.users` cez `signInAnonymously` pre priame RLS čítanie.
