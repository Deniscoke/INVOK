# Úplný prehľad práce — projekt INVOK (kompletný)

**Projekt:** INVOK — gamifikovaná vzdelávacia platforma pre slovenské ZŠ (8.–9. ročník),
súčasť programu PSC n.o. / „Program Slovensko" (EÚ).
**Technológie:** Vite + TypeScript (frontend), Vercel serverless (`api/`), Supabase
(Postgres + RLS, Storage, Auth), OpenAI + ElevenLabs (AI hlas a hodnotenie).
**Stav:** Všetko nasadené na produkciu (invok-one.vercel.app) a overené naživo.
**Rozsah:** 84 git commitov (3.–21. jún 2026) + práca mimo kódu (konzultácie, obsah, infra).

> Stĺpce „Hodiny" sú prázdne — doplň si vlastný odhad na fakturáciu.

---

# ČASŤ A — Výstupy po kategóriách

## A1. Základ platformy a architektúra
| # | Výstup | Hodiny |
|---|---|---|
| A1.1 | Návrh a scaffold platformy (Vite + TS, štruktúra, dizajn‑tokeny) | |
| A1.2 | Supabase Auth + pseudonymný prístup žiakov (kód + prezývka, bez osobných údajov) | |
| A1.3 | Dátový model + RLS (školy, triedy, žiaci, misie, odovzdania, hodnotenia) | |
| A1.4 | Konsolidácia API do 12 funkcií (limit Vercel Hobby) — catch‑all routery | |
| A1.5 | Node 22 ESM bundling na Verceli (rozsiahle ladenie importov, `.js`, JSON atribúty) | |
| A1.6 | `/api/health` diagnostika + stabilizácia nasadenia | |

## A2. Misie, AI hodnotenie a učiteľské recenzie
| # | Výstup | Hodiny |
|---|---|---|
| A2.1 | Odovzdanie misie + AI vyhodnotenie (najprv Claude, potom OpenAI) | |
| A2.2 | Odmena za „návrh problému" (podnikateľský prvý krok) | |
| A2.3 | AI rate‑limiting + cost guard (ochrana nákladov) | |
| A2.4 | Odmietanie nezmyselných odovzdaní (anti‑gibberish) | |
| A2.5 | Žiacke „questy/misie": návrh žiaka alebo AI draft → schválenie učiteľom | |
| A2.6 | AI evaluátor odovzdaných riešení k schváleným questom | |
| A2.7 | Učiteľské Phase‑2 hodnotenie (AI návrh + potvrdenie učiteľom, škála 1–5) | |
| A2.8 | Nahrávanie dokumentácie projektu (foto/PDF/video) do Supabase Storage | |
| A2.9 | Trvalá AI spätná väzba + história súborov + obnova relácie žiaka | |

## A3. Pilot, školský dashboard, prihlasovanie
| # | Výstup | Hodiny |
|---|---|---|
| A3.1 | Školský dashboard (reporting, KPI, anonymizované prehľady) | |
| A3.2 | Pilot setup: vytvorenie školy/triedy + generovanie kódov pre žiakov | |
| A3.3 | E2E prihlasovací tok žiaka (kód → prezývka) + lokálna cache kódov | |
| A3.4 | Role‑based navigácia + teplejší landing copy | |
| A3.5 | Čisté „empty state" pre nové učiteľské účty + auto‑profil cez DB trigger | |
| A3.6 | Rôzne opravy routovania (priame URL, sign‑out redirect, pilot 404) | |

## A4. Smarta — AI sprievodkyňa (chat + hlas + avatar)
| # | Výstup | Hodiny |
|---|---|---|
| A4.1 | Globálny plávajúci AI asistent (chat + TTS + lip‑sync) | |
| A4.2 | Anime avatar + voice‑reactive + frame‑swap synchronizácia úst | |
| A4.3 | ElevenLabs → OpenAI fallback + zdravotná diagnostika hlasu (`?debug=1`) | |
| A4.4 | Veľký „manga‑panel" avatar + spoľahlivý auto‑hlas (oprava Web Audio, CSP `blob:`) | |
| A4.5 | Prirodzený hlas `coral` + tón; o 20 % rýchlejší; ústa 60 fps; konfig. cez env | |
| A4.6 | Kamarátska Gen‑Z persona („pedagóg‑kamoš", všestranný asistent) | |

## A5. UI / Dizajn
| # | Výstup | Hodiny |
|---|---|---|
| A5.1 | Bledý „Monax" redizajn (dizajn‑tokeny) + jemné filmové zrno | |
| A5.2 | Epický ~5 s štartovací efekt (plávajúce 3D guľôčky, odhalenie INVOK) | |
| A5.3 | Farebná „opona" pri prihlásení (žiak aj učiteľ) aj pri odhlásení | |

## A6. Gamifikácia, meranie a artefakty (žiak/učiteľ/rodič)
| # | Výstup | Hodiny |
|---|---|---|
| A6.1 | „Moja cesta": reálne XP, kompetencie 1–5, misie (pseudonymný žiak) | |
| A6.2 | Certifikát absolvovania (tlač / PDF) | |
| A6.3 | 4 modulové odznaky (odomykané z reálnych nameraných kompetencií) | |
| A6.4 | Vstupno/výstupný kompetenčný dotazník (6×8 + 4 otvorené, scoring, XP, DB) | |
| A6.5 | Riaditeľský dashboard rastu (rast % po oblastiach) + filter triedy | |
| A6.6 | Portfólio žiaka (tlač / PDF) | |
| A6.7 | Report pre rodičov (tlač / PDF, rast %) | |
| A6.8 | Odomykací reťazec: dotazník → odznaky → dotazník → certifikát | |

## A7. Akadémia (video kurzy)
| # | Výstup | Hodiny |
|---|---|---|
| A7.1 | Kompletná sekcia Akadémia: moduly → lekcie → prehrávač + kvíz → XP | |
| A7.2 | Prvá reálna lekcia naživo (transcode 143 MB → web MP4 + hosting Supabase) | |
| A7.3 | Premenovanie „Misie → Projektové výzvy" + položka „Akadémia" v menu | |

## A8. Compliance / EÚ
| # | Výstup | Hodiny |
|---|---|---|
| A8.1 | Povinná EÚ publicita pätička (znak EÚ, Program Slovensko, partneri, právne odkazy) | |
| A8.2 | Súlad: pseudonymita žiakov, RLS, EÚ dátová rezidencia, prístupnosť (titulky) | |

## A9. Opravy (bugfixy)
| # | Výstup | Hodiny |
|---|---|---|
| A9.1 | Zlyhanie odovzdania riešenia (FK mission_id) | |
| A9.2 | Vypršaná relácia žiaka — jasné, akčné chyby pri nahrávaní médií | |
| A9.3 | Demo maska na odhlásenom `/#/student` → jasná výzva na prihlásenie | |
| A9.4 | Prázdne PDF pri tlači (zdieľaná tlačová izolácia) + bez hlavičky prehliadača | |
| A9.5 | Prekryv blokujúci prehrávanie videa (`hidden` atribút) | |
| A9.6 | 720p video pre spoľahlivé prehrávanie | |
| A9.7 | Desiatky menších opráv (routing, demo režim, pilot, CSP, bundling) | |

## A10. Obsah / produkcia + konzultácie
| # | Výstup | Hodiny |
|---|---|---|
| A10.1 | Analýza invok.pscno.sk + dokumentov (pracovný list, moduly, certifikáty) | |
| A10.2 | Konzultácia Akadémie (pedagogický model, API možnosti, dizajn) | |
| A10.3 | Higgsfield workflow + scenár/storyboard (Modul 1 · Lekcia 1) | |
| A10.4 | Smarta voiceover MP3 (viac verzií, Gen‑Z scenár) | |
| A10.5 | `kontext.md` — kompletný brief pre tvorcov digitálneho obsahu | |
| A10.6 | Prevod + hosting prvého videa; nastavenie Supabase Storage bucketu | |

---

# ČASŤ B — Úplný chronologický záznam (84 commitov)

### Fáza 0 — Základ a architektúra (3.–5. jún)
1. initial project structure
2. scaffold INVOk platform foundation
3. Supabase auth + pseudonymous student access foundation
4. mission submission and AI evaluation workflow
5. real Claude AI validation provider
6. teacher review workflow
7. migrate AI validation to OpenAI + reward problem proposals
8. AI rate limiting and cost guard
9. stabilize Vercel deployment

### Fáza 1 — Dashboard, pilot, nasadenie (6.–8. jún)
10. school dashboard reporting
11. pilot school setup + student code generation
12. stabilize pilot deployment flow
13. Vercel production runtime checklist (docs)
14. consolidate API to 12 functions (Vercel Hobby limit)
15. unblock demo submissions, teacher signup, richer solution form
16. photo evidence capture, resilient demo fallback, api tsconfig
17. reject gibberish submissions, stop scoring form labels
18. auto-create profile via DB trigger + signup redirect URL
19. revert api/tsconfig.json (broke Vercel build)
20. teacher dashboard clean empty state
21. pilot setup link 404 on direct URL
22. student-join end-to-end pilot login + local code cache
23. student-join diagnostic panel + clearer labels
24. Node 22 + enhanced /api/health diagnostics
25.–34. Vercel ESM bundling — rozsiahle ladenie (static imports, .js prípony, JSON import atribúty, probe/revert cyklus) → odblokované `/api/*`
35. student-proposed quests + teacher approval + AI draft
36. AI submission evaluator for approved quests
37. retrigger Vercel build

### Fáza 2 — Questy, routing, demo polish (19.–20. jún)
38. resolve catch-all route segments from URL
39. real OpenAI generation, cheaper model, learning outcomes
40. query params for sub-actions (catch-all 1 segment)
41. live OpenAI key check in `?deep=1`
42. dedicated OPENAI_QUEST_MODEL (timeout fix)
43. role-based navigation + warmer landing
44. accurate demo-mode messaging + enable-live-AI banner
45. never hand teachers fake local codes when Supabase configured
46. teacher login page teacher-only
47. redirect to home after sign-out
48. remove cached-codes diagnostic panel
49. colorful full-screen wipe transition on student join

### Fáza 3 — Smarta (20. jún)
50. global floating AI assistant (chat, TTS, lip-sync)
51. anime avatar with voice-reactive pulse
52. amplitude-driven frame-swap lip-sync
53. ElevenLabs→OpenAI fallback + X-TTS-Provider + health check
54. `?debug=1` surfaces ElevenLabs failure reason
63. big visible avatar on a stage + reliable auto-speaking voice
64. CSP allow `blob:` media (Smarta audio)
65. full manga-panel avatar
66. natural OpenAI voice (coral) + warm-tone, env-configurable
67. voice 20% faster + 60fps mouth
68. friendlier buddy-tutor persona

### Fáza 4 — Questy dopracovanie + recenzie (20. jún)
55. stop page reset on background auth refresh + clearer code completion
56. teacher approve route `?action=review` (catch-all 404 fix)
57. student login curtain covers first, then reveals
58. student uploads project documentation (files) to Storage
59. fix quest solution submissions FK (mission_id)
60. persistent AI feedback, teacher-status, file history + session restore
61. teacher sees AI evaluation + Phase-2 approval
62. „Moja cesta" real XP, 1-5 competencies + missions

### Fáza 5 — UI redizajn + EÚ compliance (20.–21. jún)
69. pale „Monax" reskin + epic boot splash + login curtain for teachers
70. colored curtain on logout too
71. mandatory EU-funding publicity footer

### Fáza 6 — Gamifikácia + meranie (20.–21. jún)
72. clear errors when a student session expires (media upload)
73. printable completion certificate
74. collectible INVOK module badges
75. input/output competency questionnaire (#3)
76. class pre/post growth dashboard (#4)
77. growth dashboard follows the class filter
78. „Moje INVOK portfólio" (#5)
79. „Report pre rodičov" (#6)

### Fáza 7 — Akadémia + finálne opravy (21. jún)
80. no more demo masquerade on logged-out `/#/student`
81. blank PDF on portfolio/parent report + drop browser header/footer
82. Akadémia video courses + first lesson live
83. 720p Main-profile video + preload auto
84. `hidden` attribute wins over component display rules (video playback fix)

---

# ČASŤ C — Práca mimo kódu (nezahrnutá v commitoch)

- **DB migrácie cez Supabase MCP:** `009_questionnaire_responses`, `010_academy_progress`
  (pseudonymné, RLS‑on, service‑role).
- **Supabase Storage:** verejný bucket `academy` (EÚ región) na video lekcie.
- **Video pipeline:** prevod 143 MB `.MOV` → 26 MB / 12 MB web MP4 (H.264, faststart),
  nahranie a hosting; nastavenie CSP `media-src` pre video.
- **Konzultácie/analýzy:** rozbor invok.pscno.sk; analýza tvojich dokumentov
  (pracovný list, moduly, certifikáty žiak/škola); pedagogicko‑technický návrh Akadémie.
- **Obsah:** Higgsfield postup + scenár Lekcie 1; Smarta voiceover MP3 (viac verzií,
  Gen‑Z scenár); `kontext.md` brief pre tvorcov obsahu.
- **E2E overenia naživo:** desiatky kontrol cez service‑role (upload, odovzdanie,
  dotazník, akadémia, učiteľské štatistiky) — každá funkcia overená na produkcii.
- **Bezpečnosť:** CSP (eval, `blob:`, `media-src` Supabase), pseudonymita, RLS,
  XSS‑bezpečné renderovanie (escapovanie vstupu, bezpečné DOM API).
- **Dokumentácia/výkazy:** tento prehľad práce + `kontext.md`.

---

*Doložiteľnosť: každá položka v Časti B zodpovedá konkrétnemu commitu s dátumom v git
histórii projektu; Časť C je doložiteľná stavom produkcie (Supabase tabuľky/bucket,
nasadené API, vygenerované súbory). Vygenerované: 21. jún 2026.*
