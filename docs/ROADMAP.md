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
| 7. Pilot v škole | Nasadenie s reálnou triedou, zber spätnej väzby, ladenie rubrík. | ⏳ |
| 8. Grantový reporting | Merateľné výstupy, dopad, súlad so ŠVP ZV. | ⏳ |

## Zámerne mimo tejto iterácie

Reálny upload súborov, platby, e-maily, komplexný admin systém, finálny BI
nástroj (dashboard je MVP agregovaný reporting).

## Najbližší krok

**Fáza 7 — pilot v škole.** Nasadenie s reálnou triedou: pripojiť Supabase
(Auth + DB), vytvoriť triedy/join kódy, zbierať spätnú väzbu a ladiť rubriky.
Pre dashboard doplniť reálny zoznam tried do filtra a školský-admin scope
doladiť. Voliteľne naviazať žiaka na `auth.users` (`signInAnonymously`).

> Hotové: AI rate limiting + cost guard (5.1, in-memory MVP → produkčne
> Redis/Upstash) a školský dashboard (6).
