# Vercel runtime checklist

Manuálny postup po Vercel deploye. Overuje, že produkčný runtime
(static + Vercel Functions + Supabase + OpenAI gating) funguje. Tento dokument
sa zameriava na **runtime po builde** — pre build a nastavenie projektu pozri
[DEPLOYMENT.md](DEPLOYMENT.md), pre user flow pozri [PILOT_SMOKE_TEST.md](PILOT_SMOKE_TEST.md).

> Skratky: **PROD** = produkčný Vercel URL (napr. `https://invok-one.vercel.app`).
> **HUMAN** = manuálny krok v prehliadači. **API** = curl alebo browser address bar.

## A. Statický frontend (bez env vars)

| # | Krok | Očakávané |
|---|---|---|
| 1 | Otvor `PROD/` | Landing page sa načíta, žiadne 404 / žiadne CSP errory v konzole |
| 2 | Otvor DevTools → Network | `index-*.css` a `index-*.js` z `/assets/...` vrátia **200** |
| 3 | Otvor `PROD/favicon.svg` | Vráti SVG (môže byť 404 v jednoduchšej konfigurácii — neblokujúce) |
| 4 | Klikni `Žiak` v nav-bare | Hash sa zmení na `#/student`, dashboard sa vyrenderuje s demo dátami |
| 5 | Klikni `Učiteľ` | Hash `#/teacher`, dashboard sa načíta s demo KPI a kompetenciami |

**Pass kritérium:** Žiadny `Content Security Policy` violation v DevTools konzole.

## B. API health (bez env vars — všetky funkcie majú mock fallback)

Verify, že serverless funkcie sa zinicializovali a odpovedajú **bez** Supabase/OpenAI secrets.

| # | Endpoint | Očakávaná odpoveď |
|---|---|---|
| 6 | `GET PROD/api/health` | `{ "status": "ok", "service": "invok-api", "env": "...", "time": "..." }` |
| 7 | `GET PROD/api/competencies` | `{ "competencies": [ {id:"fact_detective",...}, … ] }` — 8 položiek |
| 8 | `GET PROD/api/missions` | `{ "missions": [...], "source": "mock" }` — 7 misií, source = mock (bez Supabase) |
| 9 | `GET PROD/api/auth/me` | `{ "authenticated": false, "userId": null }` (bez Authorization headera) |
| 10 | `GET PROD/api/auth/profile` | `{ "authenticated": false, "profile": null }` |
| 11 | `POST PROD/api/student/session` body `{"sessionToken":"x"}` | `{ "valid": false, "sessionMode": "pseudonymous", "source": "mock" }` |

**Pass kritérium:** Všetky endpointy vrátia **2xx** status. Žiadny **500**.
Ak niektorý vráti 500 → otvor Vercel → Logs → Functions → pozri stacktrace.

## C. Pilot setup UI (mock režim)

| # | Krok | Očakávané |
|---|---|---|
| 12 | Otvor `PROD/#/pilot` | Pilot setup page — formulár pre školu |
| 13 | Vyplň "Test ZŠ" a stlač **Vytvoriť školu** | "Škola vytvorená (demo)" + zobrazí sa class formulár |
| 14 | Vyplň "Trieda 5.A" a stlač **Vytvoriť triedu** | "Trieda vytvorená (demo)" + zobrazí sa code generator |
| 15 | Generuj 3 kódy s prefixom `Líška` | Tabuľka 3 plaintext kódov s varovaním "IBA RAZ" |

**Pass kritérium:** Bez env vars beží demo flow do konca **bez** chyby.

## D. Po pridaní Vercel env vars

> ⚠️ **Vercel cachuje env vars do buildu.** Po každej zmene env premennej v
> Settings → Environment Variables musíš spustiť **Redeploy** zo záložky
> Deployments (alebo push nového commitu). Inak nové env vars neprídu do funkcií.

| # | Krok | Očakávané |
|---|---|---|
| 16 | Nastav Supabase env vars vo Vercel dashboarde | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_ENV=production` |
| 17 | Redeploy z Vercel → Deployments | Build prešiel, status **Ready** |
| 18 | `GET PROD/api/missions` | `"source": "catalog"` (predtým `"mock"`) |
| 19 | Spusti Supabase migrácie `001`–`005` (SQL editor) | Bez chýb, tabuľky existujú |
| 20 | Voliteľne `supabase/seed.sql` | Katalóg kompetencií/misií/odznakov v DB |
| 21 | Pre bootstrap prvej školy dočasne `PILOT_SETUP_ENABLED=true` + redeploy | Pilot setup vie vytvoriť školu cez `/api/admin/schools` |
| 22 | Po vytvorení vráť `PILOT_SETUP_ENABLED=false` + redeploy | Zápis je auditovaný, ďalšie školy len cez admina |

## E. OpenAI (až po cost review)

> Pre prvý pilot nechaj `OPENAI_VALIDATION_PROVIDER=mock`. Zapni `openai` až
> keď máš nastavenú spending cap na OpenAI strane.

| # | Krok | Očakávané |
|---|---|---|
| 23 | Vo Vercel: `OPENAI_VALIDATION_PROVIDER=openai`, `OPENAI_API_KEY=sk-...`, `OPENAI_VALIDATION_MODEL=...` | Redeploy |
| 24 | `POST PROD/api/ai/validate-submission` s body `{"missionId":"design_solution","studentResponse":"...","evidenceText":"...","evidenceType":"text"}` | `"source": "openai"` (nie `mock`) v odpovedi |
| 25 | Pri zlyhaní AI | `"source": "mock_fallback"` + `"suggestedTeacherReview": true` — submission sa nikdy nezahodí |

## F. Diagnostika pri probléme

### Build prešiel, ale runtime padá
1. Vercel dashboard → projekt → záložka **Logs** → filtruj `Source: Functions`.
2. Vyhľadaj stacktrace pre URL endpoint, ktorý padá.
3. Najčastejšie príčiny:
   - Chýba `SUPABASE_SERVICE_ROLE_KEY` pri použití DB cesty → endpoint vráti 401/500.
     Riešenie: nastav env var + redeploy.
   - OpenAI API kľúč neplatný → `source: 'mock_fallback'` (správanie je očakávané; nie je to crash).

### Hash router 404 pri priamom otvorení `/student`
- Vercel s `framework: vite` rozumie SPA: pri neexistujúcej ceste serveruje
  `dist/index.html`. Ak by 404 nastalo, pridaj do `vercel.json` rewrite:
  ```json
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
  ```
  (Zatiaľ ponechané na defaulte — overené, že nie je potreba.)

### CSP blokuje niečo
- Otvor DevTools → Console. Vyhľadaj `Refused to load … because it violates …`.
- Ak ide o Supabase doménu → ber URL z chyby a pridaj do `connect-src` v `vercel.json`.
- Ak ide o inline `<style>` → už povolené (`style-src 'self' 'unsafe-inline'`).
- Ak ide o externý font/skript → posúdiť (zámerne nepovoľujeme).

### "Build Failed" s `TypeScript error`
- Lokálne spusti `npm run typecheck`. Ak prejde lokálne, ale padá na Verceli,
  je to pravdepodobne kvôli iným `@types` verziám — synchronizuj `package-lock.json`
  push-om.

### "Build Failed" s `npm ERR! peer dep`
- Lokálne `rm -rf node_modules package-lock.json && npm install && git add package-lock.json`,
  potom push. Vercel použije nový lock.

### Deploy zostal v stave "Queued"
- Skontroluj Vercel quotu (Hobby plán má concurrent build limit).

## G. Rollback

Ak deploy zlyhá runtime-om a treba vrátiť predchádzajúcu verziu:

1. Vercel dashboard → projekt → **Deployments**.
2. Nájdi posledný **Ready** deployment.
3. ⋯ menu → **Promote to Production**.

Žiadna DB migrácia v projekte nie je destruktívna — rollback frontendu/funkcií
sám o sebe nepoškodí dáta.
