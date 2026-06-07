# INVOk — projektový sumár pre konzultáciu

> **Účel tohto dokumentu:** jednorazové, samostatné zhrnutie celého projektu vo forme,
> ktorá sa dá poslať tretej strane (mentor, grantový oponent, ChatGPT, recenzent)
> a získať z neho úplný obraz o tom, čo platforma robí, čo je hotové, aký je
> stav a kde sú otvorené body. Dátum: 2026-06-07.

---

## 1. Čo je INVOk

**INVOk je gamifikovaná vzdelávacia platforma pre slovenské základné školy.**
Vychádza zo Štátneho vzdelávacieho programu pre základné vzdelávanie (ŠVP ZV)
a cielene posilňuje **podnikavé, kritické a tímové kompetencie**.

Žiak neplní len "úlohy". Žiak prechádza **procesom**:

1. všimne si problém v škole/komunite,
2. zmapuje ho a pomenuje, koho sa týka,
3. navrhne riešenie a prvý krok,
4. priloží dôkaz / pozorovanie,
5. odovzdá výstup,
6. dostane **formatívnu AI spätnú väzbu** (skóre, istota, dôvody),
7. **učiteľ návrh potvrdí alebo upraví** (učiteľ je vždy garant),
8. získa XP a posunie sa v hrdinských kompetenciách,
9. reflektuje vlastný rast.

**Cieľová skupina:** žiaci 2. stupňa ZŠ, učitelia, riaditelia/koordinátori,
grantoví hodnotitelia.

**Prečo to existuje:**
- Slovenský ŠVP ZV posúva ťažisko od memorovania k **funkčnej gramotnosti**,
  podnikavosti, mediálnej gramotnosti a kritickému mysleniu. Učitelia majú
  málo nástrojov, ktoré tieto kompetencie dokážu **systematicky odmeniť a vykázať**.
- AI vie podľa rubriky urobiť prvú spätnú väzbu rýchlo, ale **nesmie nahradiť učiteľa**.
- Pilot/grant potrebuje **anonymizovaný, auditovateľný reporting**.

INVOk rieši tento priesečník: žiak má hru, učiteľ má kontrolu, škola má reporting.

---

## 2. Aktuálny stav: čo je hotové

Projekt prešiel **8 fázami**. Commit hash je v zátvorke.

| # | Fáza | Stav | Commit |
|---|---|---|---|
| 1 | Scaffold platformy (Vite + TS + Vercel API + dátový katalóg + 8 hrdinských kompetencií) | ✅ | `fcf55ab` |
| 2 | Supabase Auth + **pseudonymný** žiacky prístup (kódy hashované) | ✅ | `7b0ce70` |
| 3 | Mission submission workflow + mock AI evaluation + XP/progres | ✅ | `aff35d0` |
| 4 | Reálny **OpenAI** AI provider (Responses API + strict JSON schema) | ✅ | `850f6c7` |
| 5 | **Teacher review workflow** (approve/adjust/needs_revision/reject) + dvojfázové XP | ✅ | `042fd6b` |
| 5.1 | OpenAI **rate limiting + cost guard** (MVP, in-memory) | ✅ | `3086a18` |
| 6 | **Školský dashboard** + anonymizovaný CSV export | ✅ | `f415de5` |
| 7 | **Pilot setup** (škola/trieda/učiteľ + generovanie žiackych kódov) | ✅ | `c1c06d2` |
| 8 | Pre-pilot stabilizácia (bezpečnostná oprava setup-mode + DEPLOYMENT.md + smoke test) | ✅ | `0bf7681` |

**Posledná hlava (HEAD):** `0bf7681` *fix: stabilize pilot deployment flow*
(pushnuté na `github.com/Deniscoke/INVOK`, master).

### Stav buildu/testov (lokálne)
- `npm run typecheck` ✅
- `npm test` ✅ **197/197** (35 testovacích súborov)
- `npm run build` ✅ (75.8 kB gzip JS)

### Stav deploymentu
- **Vercel** projekt prepojený, build z posledného commitu prebehol (`Build Completed in /vercel/output [23s]`).
- Bez nastavených env vars ide appka v **bezpečnom mock/demo režime** — žiadne reálne dáta, žiadne OpenAI volania. To je zámerný stav pre prvý deploy.
- Pre reálny pilot treba nastaviť Supabase + (voliteľne) OpenAI env vars — pozri [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 3. Technický stack a architektúra

| Vrstva | Technológia | Pomer voľby |
|---|---|---|
| Frontend | **Vite + TypeScript** (vanilla, bez Reactu) | Lacný, auditovateľný, ~76 kB gzip bundle |
| API | **Vercel Functions** (Node 20.x, Fluid Compute) | Server-only logika v `api/`, 26 funkcií |
| Databáza | **Supabase Postgres + RLS** | Auth, Storage, RLS priamo v DB (defense-in-depth) |
| AI | **OpenAI Responses API** (mock/openai switch) | Strict JSON schema, server-only |
| Testy | **Vitest** | Offline (žiadne reálne Supabase/OpenAI v testoch) |
| CI | **GitHub Actions** | typecheck + test + build |
| Deploy | **Vercel** (GitHub integrácia) | Auto-deploy na push do `master` |

**Kľúčové architektonické rozhodnutia:**

1. **Žiadny framework na frontende** — vanilla TS hash-routing. Bundle je
   malý, build deterministický, code review je triviálne. Žiadny Vue/React/Svelte
   "lock-in".
2. **Backend hranica je explicitná** — `backend/lib/supabaseAdmin.ts` a
   `backend/lib/openaiClient.ts` sú server-only. Automatické testy strážia, že
   frontend bundle neobsahuje `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` ani
   `import 'openai'`.
3. **Dva clearly oddelené režimy:** "mock" (bez secrets, demo dáta) a "DB" (so
   secrets, reálne Supabase). Každá služba má `source: 'mock' | 'db'`.
   To umožňuje plnú offline UX aj plnú offline testovaciu suitu.
4. **AI je formatívny pomocník, nie známkovač.** AI dá návrh; **učiteľ
   commitne**. Architekturálne to znamená dvojfázové XP (viď nižšie).

---

## 4. Dátový model (Supabase Postgres)

**5 migrácií** v `supabase/migrations/`, všetky idempotentné (`if not exists`),
**RLS zapnuté** na používateľských tabuľkách.

| Tabuľka | Migrácia | Účel |
|---|---|---|
| `profiles` | 001 | Identita: rola (admin/teacher/student), pseudonym (`display_name`), level, total_xp |
| `schools`, `school_memberships` | 001 | Škola a admin/teacher členstvo |
| `classes`, `class_memberships` | 001 | Trieda a teacher/student členstvo |
| `competencies` | 001 | 8 hrdinských kompetencií (detský názov + interné mapovanie na ŠVP ZV) |
| `missions`, `mission_competencies` | 001 | Misie (rubric, baseXp, mód) ↔ kompetencie |
| `submissions` | 001 + 003 + 005 | Odovzdania žiakov + nullable `student_access_code_id` (pseudonymní žiaci) + `submission_kind`, `problem_quality_score`, `problem_reward_xp` |
| `ai_evaluations` | 001 | AI hodnotenie (score, confidence, reasons, detectedCompetencies, suggestedTeacherReview) |
| `badges`, `user_badges` | 001 | Odznaky a udelenia |
| `user_progress` | 001 | XP/level/mastery na kompetenciu |
| `class_join_codes` | 002 | Trieda-wide kód (hashovaný, expiry, max_uses) |
| `student_access_codes` | 002 | Per-žiak kód (pseudonym + hash) |
| `student_sessions` | 002 | Bearer session (token hash + expiry) — **RLS bez policy**, len cez service role |
| `teacher_reviews` | 004 | Auditovateľný učiteľský review (decision, final_score, feedback, adjustment_reason) |

**Total: 13 hlavných tabuliek** (+ pomocné).

**Kľúčový princíp:** žiak má **dve možné identity**:
- pseudonymný `student_access_code_id` (bez `auth.users` riadku, bez e-mailu);
- alebo voliteľne v budúcnosti naviazaný na `auth.users` cez `signInAnonymously`.

`submissions.student_id` je nullable; check constraint zaisťuje, že je vyplnené
*aspoň jedno* z `student_id` / `student_access_code_id`.

---

## 5. Bezpečnosť a súkromie (privacy-by-design)

Toto je **najsilnejší aspekt projektu** pre grantový kontext detí ZŠ.

### Tajomstvá / kľúče

| Premenná | Žije v | Pravidlo |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_ENV` | frontend + server | OK v bundli (chránené RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | iba server | Obchádza RLS. **Nikdy** vo frontende. |
| `OPENAI_API_KEY` | iba server | Nikdy vo frontende. |

`.env` je **gitignored**; `.env.example` má **iba placeholdery**. Toto má
automatický test (`tests/security/noPersonalData.test.ts`).

### Pseudonymizácia žiakov

- Žiak vystupuje pod aliasom (`Líška-07`, `Sokol-12`, …).
- V app tabuľkách **nie sú** e-maily žiakov, mená, dátumy narodenia.
- E-mail majú **iba** učitelia/admini (cez Supabase Auth).
- Žiacke prístupové kódy sa do DB ukladajú **iba ako `sha256` hash**, plaintext sa vráti **iba raz** (na vytlačenie), nikdy sa neloguje.
- Session tokeny tiež len hash.

### AI privacy

- Do OpenAI ide **iba**: názov misie, cieľ, rubrika, anonymizovaná odpoveď žiaka,
  typ dôkazu, definície kompetencií.
- **Neposiela sa**: meno/email žiaka, pseudonym, session token, access code,
  Supabase ID, hashe, API kľúče.
- **Raw prompty sa neukladajú** do DB (`OPENAI_VALIDATION_LOG_RAW_PROMPTS=false`).
- Pri zlyhaní AI: bezpečný fallback (`source: 'mock_fallback'`, `suggestedTeacherReview: true`) — submission sa **nikdy nezahodí** kvôli AI.

### Row Level Security (RLS)

- Zapnuté na všetkých citlivých tabuľkách.
- Žiak vidí len vlastné dáta; učiteľ vidí žiakov vlastných tried (cez SECURITY DEFINER helper `teaches_student()`); admin svoju školu.
- Service role bypasuje RLS — používa ho len server (`backend/lib/supabaseAdmin.ts`).

### Rate limiting + cost guard

- Per-identity rate limit (žiak 5/min, učiteľ 20/min, anonymous → forced mock).
- Denné limity (30/žiak, 300/trieda).
- Hashovaná IP pre anonymných (žiadny plaintext).
- Text orezaný na `AI_MAX_EVIDENCE_CHARS` pred odoslaním do AI.
- **Limit: in-memory MVP** (per Vercel instance, nie globálne). Pre väčší pilot → Redis/Upstash.

### Anonymizovaný reporting

- Dashboard a CSV export vracajú **iba agregáty** (počty, priemery), nikdy riadky per žiak.
- CSV stĺpce: `class_id, mission_id, competency_id, submissions_count, reviewed_count, avg_ai_score, avg_teacher_score, avg_problem_quality_score, total_final_xp, date_from, date_to`.
- **Nikdy v exporte:** mená, e-maily, kódy, tokeny, hashe, secrets, raw prompty. Stráži test (`dashboardPrivacy.test.ts`).

### Pilot setup (bezpečné defaulty)

- `PILOT_SETUP_ENABLED=false` (secure-by-default). Zapína sa **iba dočasne** pri bootstrape prvej školy a hneď sa vracia na `false`.
- Pri opačnom riešení (môj pôvodný kód) hrozila cross-tenant privilege escalation — opravené vo fáze 8.

---

## 6. AI validation: ako presne funguje

**Provider switch:** `OPENAI_VALIDATION_PROVIDER` = `mock` (default) alebo `openai`.

**Mock** (offline, deterministický):
- Skóruje podľa kľúčových slov (`pretože`, `dôkaz`, `riešenie`, `nabudúce`, …) + dĺžky textu.
- Vráti rovnaký kontrakt ako reálne volanie. Testy idú cez mock.

**OpenAI** (keď je nakonfigurovaný):
- Volá **Responses API** (`client.responses.create`).
- **Strict JSON schema** výstup (`text.format: json_schema`, `additionalProperties: false`) — model je nútený vrátiť presný tvar.
- `max_output_tokens: 700`, žiadny tool use, krátky prompt.

**Kontrakt výstupu** (`AIValidationResult`):
```ts
{
  valid: boolean,
  score: number,            // 0..100
  confidence: number,       // 0..1
  reasons: [{ criterion, result: 'met'|'partial'|'unmet', explanation }],
  detectedCompetencies: [{ id, strength, evidence }],
  suggestedTeacherReview: boolean,
  model: string,
  source: 'mock' | 'openai' | 'mock_fallback'
}
```

**Bezpečné spracovanie nedôveryhodného JSON:**
- `backend/validators/aiValidationResultValidator.ts` extrahuje JSON aj z markdown fence.
- Clampuje `score` na 0–100, `confidence` na 0–1.
- Pri nevalidnom JSON → bezpečný stub (`valid:false`, `suggestedTeacherReview:true`).
- Pri `confidence < 0.75` vždy nastaví `suggestedTeacherReview: true`.

**Pedagogické pravidlá v prompte:**
- Hodnoť IBA podľa dôkazov a rubriky.
- NEHODNOŤ osobnosť, inteligenciu, identitu dieťaťa.
- Pri neistote → odporuč učiteľské posúdenie.
- Žiadny markdown, IBA JSON.

---

## 7. Teacher review workflow + dvojfázové XP

**Najdôležitejšie pedagogické rozhodnutie celého systému.**

### Štyri rozhodnutia učiteľa
| Decision | Status submission | Final XP |
|---|---|---|
| `approved` | `approved` | `baseXp × score/100` |
| `adjusted` (povinný `adjustment_reason`) | `teacher_reviewed` | `baseXp × upraveneScore/100` |
| `needs_revision` (povinný `feedback_text`) | `needs_revision` | **0** |
| `rejected` (povinný `feedback_text`) | `rejected` | **0** |

### Dvojfázové XP (zásadné)

1. **Submission čas:** `submissions.xp_awarded` = predbežné AI XP. Ale **neprepíše sa** do `profiles.total_xp` ani `user_progress`.
2. **Po teacher review** (approve/adjust): server (`teacherReviewService.applyReviewToSubmission`) commitne finálne XP do `profiles.total_xp` aj do `user_progress` (per kompetencia).

**Dôsledok:** každý zisk XP je auditovateľne dohľadateľný k riadku v `teacher_reviews` (reviewer_id + timestamps). Pre grantový reporting nezastupiteľné.

### Audit trail
- `teacher_reviews(decision, final_valid, final_score, feedback_text, adjustment_reason, reviewer_id, created_at, updated_at)`.
- RLS: číta reviewer / správca triedy / vlastník submission; zapisuje len správca triedy.

---

## 8. Gamifikácia (pedagogicky kalibrovaná)

### 8 hrdinských kompetencií
| ID (DB) | Detský názov | Interná oblasť (ŠVP ZV) |
|---|---|---|
| `fact_detective` | Detektív faktov | Mediálna a občianska gramotnosť |
| `maker_venture` | Tvorca riešení | Človek a svet práce / podnikavosť |
| `team_builder` | Staviteľ tímu | Sociálno-emocionálne učenie / spolupráca |
| `digital_navigator` | Digitálny navigátor | Digitálna gramotnosť / bezpečnosť |
| `community_hero` | Hrdina komunity | Občianska gramotnosť / hodnoty |
| `resource_guardian` | Strážca zdrojov | Finančná gramotnosť |
| `planet_guardian` | Ochranca planéty | Environmentálna gramotnosť |
| `self_captain` | Kapitán svojho rastu | Metakognícia / sebareflexia |

V UI deti vidia **iba detský názov**. Učitelia/admini vidia aj interné mapovanie.

### Levelová krivka
`xpForLevel(L) = 100 × (L−1)²` → L1:0, L2:100, L3:400, L4:900, L5:1600, L6:2500…
Akcelerujúca: rané úspechy časté (motivácia mladších žiakov), vyššie levely "zaslúžené".

### Odmena za návrh problému (Fáza 3)
Špeciálny `submission_kind = 'problem_proposal'` — žiak dostane **predbežné XP 10–40 %** základného XP misie za **kvalitne pomenovaný problém** (problem rubric: jasnosť, konkrétnosť, dôkaz, koho sa týka, prvý návrh, dopad, všímavosť). Finálne XP stále potvrdí učiteľ. Rubrika zámerne odmeňuje **dôkaz** — nemotivuje k vymýšľaniu falošných problémov.

### Žiadne verejné individuálne leaderboardy
Zámer: pri mladších žiakoch súťaživý dizajn môže poškodiť motiváciu a SE pohodu. Namiesto toho: osobný rast, tímové výzvy, mastery progres, odznaky za konkrétne správanie.

---

## 9. Pilot setup flow (Fáza 7)

UI je na `/pilot`. Postup:

1. **Vytvor školu** (admin alebo dočasne `PILOT_SETUP_ENABLED=true`).
2. **Vytvor triedu** v škole. Tvorca je automaticky teacher tej triedy.
3. **Vygeneruj žiacke kódy** (count 1–40, prefix prezývky napr. `Líška`):
   - Server vygeneruje plaintext kódy (8 znakov, žiadne 0/O/1/I).
   - Do DB ide **iba `sha256` hash** + pseudonym (`Líška-01`, `Líška-02`…).
   - Plaintext vidí učiteľ **IBA RAZ** — môže ho skopírovať / vytlačiť.
   - List endpoint **nikdy** nevracia plaintext ani hash (`tests/security/studentCodePrivacy.test.ts`).
4. **Učiteľ rozdá kódy** žiakom (vytlačí na lístky).
5. Žiak na `/join` zadá svoj kód. Server overí `sha256`, vytvorí session (bearer token, hash sa uloží), pridelí pridelený pseudonym.
6. Žiak je v systéme — **bez e-mailu, bez mena, bez registrácie**.

Existujú aj **kódy triedy** (`class_join_codes`) — žiak si zvolí vlastnú prezývku. Toto je voliteľná druhá cesta.

---

## 10. Štruktúra repozitára

```
INVOK/
├─ api/                          26 Vercel serverless funkcií
│  ├─ ai/validate-submission.ts
│  ├─ auth/{me,profile}.ts
│  ├─ student/{join,session}.ts
│  ├─ submissions/{index,me,[id]}.ts
│  ├─ teacher/{submissions,reviews,reviews/[submissionId]}.ts
│  ├─ progress/me.ts
│  ├─ dashboard/{summary,competencies,problem-proposals,reviews,classes,export.csv}.ts
│  ├─ admin/{schools,classes,teachers,student-codes,student-codes/[id]}.ts
│  ├─ competencies.ts, missions.ts, health.ts
│
├─ backend/                      SERVER-ONLY (nikdy importované do frontendu)
│  ├─ lib/             env, hash, requestContext, supabaseAdmin, openaiClient, authContext, rateLimit
│  ├─ services/        aiValidation, submission, teacherReview, problemProposal, mission, progress, studentAccess, dashboard, pilotSetup
│  ├─ validators/      submission, teacherReview, dashboard, pilotSetup, aiValidationResult
│  └─ prompts/         aiValidationPrompt.ts (system + strict JSON schema)
│
├─ frontend/src/
│  ├─ main.ts          hash router (8 routes)
│  ├─ pages/           Landing, StudentDashboard, TeacherDashboard, Login, StudentJoin, PilotSetup
│  ├─ components/      Mascot, Mission/Competency/Badge cards, AiEvaluationCard, TeacherReviewPanel, SubmissionForm, ProgressSummary, AuthStatus, RoleBadge
│  ├─ components/dashboard/   KpiCard, CompetencyProgressGrid, ProblemProposalSummary, ReviewStatsPanel, DashboardFilters, CsvExportButton
│  ├─ components/admin/       SchoolSetupForm, ClassSetupForm, StudentCodeGenerator, StudentCodeList
│  ├─ services/        authService, supabaseClient, submissionApi, teacherReviewApi, dashboardApi, pilotSetupApi, missionApi, mockDataService
│  └─ styles/          tokens.css, app.css
│
├─ data/                         Curriculum catalog (žiadne osobné údaje)
│  ├─ competencies.json          8 hrdinských kompetencií
│  ├─ missions.json              7 misií (rubric + baseXp + difficulty)
│  ├─ badges.json                8 odznakov
│  └─ seed.json                  Demo dáta (pseudonymné aliasy)
│
├─ supabase/
│  ├─ migrations/   001_initial_schema → 005_problem_proposal_rewards
│  └─ seed.sql      Katalóg + demo misie (žiadne osobné údaje)
│
├─ tests/                        35 súborov, 197 testov, žiadne reálne Supabase/OpenAI volania
│  ├─ ai/             OpenAI provider, JSON validator, cost guard, AI workflow
│  ├─ data/           Catalog integrity
│  ├─ db/             Schema/migration asserts (RLS, constraints, indexes)
│  ├─ submissions/    Submission service + problem proposal
│  ├─ teacherReview/  Validator + service
│  ├─ dashboard/      Validator, service math, CSV export, classes
│  ├─ pilot/          Validator, code generation
│  ├─ rewards/        Problem proposal XP rules
│  └─ security/       6 súborov: env, no-personal-data, no-AI-secrets, auth, studentAccess, teacherReviewAccess, dashboardAccess, dashboardPrivacy, studentCodePrivacy, pilotSetupAccess, rateLimit, requestContext
│
├─ docs/
│  ├─ ARCHITECTURE.md, SECURITY.md, DATABASE.md, AI_VALIDATION.md
│  ├─ GAMIFICATION_MODEL.md, CURRICULUM_MAPPING.md, ROADMAP.md
│  ├─ DEPLOYMENT.md            (Vercel + Supabase setup)
│  ├─ PILOT_SMOKE_TEST.md      (20-step E2E checklist)
│  ├─ PROJECT_SUMMARY.md       (tento dokument)
│  └─ research/invok-rvp-sk-research.md  (~1000 riadkov pôvodný výskum)
│
├─ .github/workflows/ci.yml      typecheck + test + build
├─ vercel.json                   Framework vite, output dist, security headers
├─ package.json                  Node 20.x pin, openai + supabase-js
├─ tsconfig.json, vite.config.ts
└─ .env.example                  Placeholdery, .env je gitignored
```

---

## 11. Čo NIE JE hotové (otvorené body)

### Mimo MVP scopu (zámerne neimplementované)
- **Reálny upload súborov** (obrázky/PDF ako dôkaz) — placeholder existuje.
- **E-mailové notifikácie** žiakom/učiteľom.
- **Platby/predplatné** pre školy.
- **Komplexný admin panel** pre celú produkciu.
- **Plný BI nástroj** — dashboard je MVP agregát.
- **Multi-language support** — UI je SK-only.
- **Mobile native** — appka je responzívna webová, nie iOS/Android natívna.

### Známe limitácie MVP
- **Rate limiter je in-memory** (per Vercel instance). Pre väčší pilot → Redis/Upstash alebo Supabase-backed limiter. Otvorené v ROADMAP.
- **Denné limity tiež in-memory** (per-instance reset). Pre produkciu nahradiť.
- **Školský admin scope** — DB-ready skeleton, ale ostré pravidlá (admin vidí všetky triedy svojej školy) sú zatiaľ povolené konzervatívne; treba dotestovať na reálnej škole.
- **Žiaci nie sú viazaní na `auth.users`** — RLS pre priame čítanie žiakom nefunguje. Server validuje cez session token (`backend/lib/requestContext.ts`). Voliteľný next step: `supabase.auth.signInAnonymously()`.
- **CSP `style-src 'unsafe-inline'`** — kvôli inline style atribútom v UI. Pri tvrdení produkcie presunúť do tried.
- **`@vercel/node` má tranzitívne deprecated balíky** (cosmetic warning, nelámu build).
- **`gpt-5.5` je default model** v env — keď budeš zapínať OpenAI, over aktuálny názov modelu (model lineup sa môže meniť, kontrakt prompt-u je nezávislý).

### Otázky na konzultáciu (čo si pýta validáciu)
1. **Mapovanie hrdinských kompetencií na ŠVP ZV** — interné, nie priama citácia oficiálneho dokumentu. Pre grantovú obhajobu potrebuje pedagogickú validáciu (učiteľ/MPC).
2. **Default OpenAI model** (`gpt-5.5`) + **rozpočet** na pilot. V akom rozsahu pilotnej triedy je očakávaná spotreba prijateľná?
3. **Pseudonymizácia žiakov vs. súlad s GDPR / školskými pravidlami** — vyžaduje konzultáciu s DPO školy. Naša pozícia: app tabuľky nedrží žiadne PII žiakov; jediný osobný údaj v systéme je e-mail učiteľa v Supabase Auth.
4. **Učiteľ ako garant** — je tento model (AI návrh + human approve) zladený s odporúčaniami EK/OECD/UNESCO pre AI v škole? Naša odpoveď: áno (formatívna, vysvetliteľná, auditovateľná, human-in-the-loop), ale pre grant treba mať citácie.
5. **Reward za návrh problému (10–40 %)** — kalibrácia tejto škály treba overiť na reálnych odpovediach žiakov.
6. **Migrácia na Redis/Upstash** pred väčším pilotom — kedy?
7. **Pilot velkosť** — koľko žiakov v prvej iterácii zniesli rozumne in-memory limity?

---

## 12. Deployment stav (Vercel + Supabase)

### GitHub
- Repo: `github.com/Deniscoke/INVOK`
- Branch: `master`
- HEAD: `0bf7681 fix: stabilize pilot deployment flow`
- 9 commitov, lineárna história (žiadne merge commity).

### Vercel
- Projekt prepojený s GitHub repom.
- Auto-deploy na push do `master`.
- Posledný build: prešiel `Build Completed in /vercel/output [23s]` (z logu používateľa).
- Bez env vars beží **mock/demo** režim.
- Pre reálny pilot pridať env vars cez Vercel dashboard (NIKDY do `.env.example`).

### Supabase
- Projekt: `uydxclysmyyxyygewdot.supabase.co`
- Migrácie pripravené (`001`–`005`) na spustenie cez SQL editor alebo Supabase CLI.
- Seed (`supabase/seed.sql`) bez osobných údajov.
- RLS pripravená.

### Env vars (Vercel dashboard)
```env
# Public
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_ENV=production
VITE_PUBLIC_BASE_URL=https://invok-one.vercel.app

# Server-only (nikdy do bundlu)
SUPABASE_SERVICE_ROLE_KEY=
APP_ENV=production
OPENAI_VALIDATION_PROVIDER=mock        # zatiaľ; reálne až po cost review
OPENAI_API_KEY=                        # vyplniť, keď zapínaš openai
OPENAI_VALIDATION_MODEL=gpt-5.5
PILOT_SETUP_ENABLED=false              # true LEN dočasne pri bootstrape
```

---

## 13. Roadmapa (čo by malo nasledovať)

| Fáza | Cieľ |
|---|---|
| ✅ 1–7 | Skelet → Auth → Submissions → AI → Review → Rate limit → Dashboard → Pilot setup |
| ✅ 8 | Pre-pilot stabilizácia + dokumentácia |
| 🟡 9 | **Reálny pilot v škole** — pripojiť Supabase v Vercel, prejsť smoke test, prizvať reálnu triedu |
| ⏳ 10 | Redis/Upstash rate limiter (pre väčší rozsah) |
| ⏳ 11 | Grantový reporting / agregované výstupy pre evaluátora |
| ⏳ 12 | Upload dôkazov (obrázky), e-mail notifikácie, viacero tried/učiteľov |
| ⏳ 13 | Mobile-friendly polish, prístupnosť (a11y) audit |

---

## 14. Krátka exekutívna sumarizácia (pre netechnického konzultanta)

INVOk je hotový **MVP pilotný systém**:

- **Pre žiaka:** hra s misiami, AI spätná väzba na jeho odpovede, hrdinské kompetencie, predbežné XP za kvalitne pomenovaný problém.
- **Pre učiteľa:** inbox AI návrhov hodnotenia, jedným klikom potvrdí/upraví/vráti, vidí dashboard triedy a generuje žiacke kódy pre triedu.
- **Pre školu/grant:** anonymizovaný CSV reporting, žiadne PII žiakov v systéme, audit trail učiteľských rozhodnutí.

**Technicky:** 26 API funkcií, 13 DB tabuliek, 197 testov, build pod 80 kB gzip, deployable na Vercel jedným push do `master`, defaultne v mock režime (bez nákladov), reálne OpenAI zapína server-side flag.

**Bezpečnostne:** všetky secrets server-only s automatickými testami, žiacke kódy len hash, dashboard a CSV iba agregáty, rate limit + cost guard, secure-by-default pilot setup.

**Pedagogicky:** vychádza zo ŠVP ZV, AI je formatívna (nie známkovač), učiteľ je garant, dvojfázové XP zaisťuje auditovateľnosť každého bodu.

**Otvorené pred pilotom:** pedagogická validácia mapovania kompetencií, cost review OpenAI volaní, GDPR sign-off od DPO školy.

---

## 15. Kontaktné body / odkazy

- **GitHub:** https://github.com/Deniscoke/INVOK
- **Vercel (produkcia):** https://invok-one.vercel.app
- **Dokumenty:** `docs/` v repe (`ARCHITECTURE.md`, `SECURITY.md`, `DATABASE.md`, `AI_VALIDATION.md`, `GAMIFICATION_MODEL.md`, `CURRICULUM_MAPPING.md`, `ROADMAP.md`, `DEPLOYMENT.md`, `PILOT_SMOKE_TEST.md`)
- **Pôvodný výskum:** `docs/research/invok-rvp-sk-research.md`

Pre detaily konkrétneho aspektu odporúčam pozrieť dokumentáciu v `docs/`. Tento sumár je úvod; jednotlivé dokumenty idú hlbšie.
