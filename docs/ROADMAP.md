# Roadmapa

Postupné fázy od skeletu k pilotu a grantovému reportingu.

| Fáza | Cieľ | Stav |
|---|---|---|
| 1. Scaffold | Bezpečný základ: stack, dáta, schéma, mock AI, testy, CI. | ✅ |
| 2. Supabase Auth + role | Auth pre učiteľa/admina, pseudonymný prístup žiaka (kódy + session), RLS pre auth tabuľky. | ✅ |
| 3. Submission workflow + AI | Odovzdania (CRUD), mock AI validácia, XP/progres, teacher review view, migrácia 003. | ✅ |
| 4. AI validácia | Reálny OpenAI provider (mock/openai switch), JSON validátor, bezpečný fallback. | ✅ |
| 5. Teacher review | Auditovateľný review (approve/adjust/needs_revision/reject), finálne XP gate, migrácia 004. | ✅ táto iterácia |
| 6. Školský dashboard | Anonymizovaný reporting (KPI, kompetencie, návrhy, review) + CSV export. | ✅ táto iterácia |
| 7. Pilot setup | Škola/trieda/učiteľ + generovanie pseudonymných žiackych kódov, reálne triedy v dashboarde. | ✅ táto iterácia (setup) |
| 8. Grantový reporting | Merateľné výstupy, dopad, súlad so ŠVP ZV. | ⏳ |

## Zámerne mimo tejto iterácie

Reálny upload súborov, platby, e-maily, komplexný admin systém, finálny BI
nástroj (dashboard je MVP agregovaný reporting).

## Najbližší krok

**Fáza 8 — grantový reporting + reálny pilot.** Pripojiť Supabase (Auth + DB) v
produkcii, cez Pilot setup (`/pilot`) založiť školu/triedu a rozdať žiacke kódy,
zbierať dáta a generovať grantové výstupy z dashboardu/CSV. Pred ostrým pilotom
vymeniť in-memory rate limiter za Redis/Upstash a doladiť školský-admin scope.

> Hotové: AI rate limiting + cost guard (5.1), školský dashboard (6) a pilot
> setup (7 — škola/trieda/žiacke kódy, generovanie cez `/pilot`).
