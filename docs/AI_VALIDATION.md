# AI validácia

AI je v INVOk **formatívny pomocník, nie finálny známkovač.** Šetrí učiteľovi
čas pri prvom prechode, ale **učiteľ zostáva garantom** výsledku. Tento prístup
je v súlade s odporúčaniami EK, OECD a UNESCO na etické a human-in-the-loop
používanie AI v škole.

## Čo AI robí a čo nerobí

- ✅ Posudzuje **dôkazy** voči **rubrike** misie.
- ✅ Vracia **štruktúrovaný, vysvetliteľný** výstup s mierou istoty.
- ❌ Nehodnotí osobnosť, inteligenciu ani hodnotu dieťaťa.
- ❌ Nedáva záverečnú známku ani konečné rozhodnutie.

## Výstupný kontrakt (`AIValidationResult`)

```json
{
  "valid": true,
  "score": 82,
  "confidence": 0.78,
  "reasons": [
    { "criterion": "relevantnosť", "result": "met", "explanation": "..." }
  ],
  "detectedCompetencies": [
    { "id": "maker_venture", "strength": 0.7, "evidence": "..." }
  ],
  "suggestedTeacherReview": true
}
```

- `score` (0–100): kvalita dôkazov voči rubrike.
- `confidence` (0–1): istota modelu.
- `reasons`: zdôvodnenie po kritériách (`met` / `partial` / `unmet`).
- `detectedCompetencies`: odhad rozvíjaných kompetencií so silou.
- `suggestedTeacherReview`: vlajka na ľudské posúdenie.

## Kedy sa navrhuje učiteľské posúdenie

`suggestedTeacherReview = true`, keď: odovzdanie je neplatné, `confidence` je
nízka, chýba dôkaz, alebo je skóre hraničné. **Pri neistote vždy preferuj
učiteľa.**

## Provider: mock vs. openai

`backend/services/aiValidationService.ts` podporuje dvoch providerov cez
`validateSubmissionWithAI(input, context)`:

| Provider | Kedy sa použije | `source` |
|---|---|---|
| **mock** (default) | vždy, ak nie je splnené nižšie | `mock` |
| **openai** | `OPENAI_VALIDATION_PROVIDER=openai` **a** je nastavený `OPENAI_API_KEY` **a** `OPENAI_VALIDATION_MODEL` | `openai` |

**Prepínanie:** riadené env premennými (viď nižšie). Bez kľúča alebo s
`OPENAI_VALIDATION_PROVIDER=mock` ostáva systém na deterministickom mocku.
OpenAI provider používa **Responses API** so **štruktúrovaným JSON výstupom**
(strict JSON schema), bez tool use.

### Env premenné

```env
OPENAI_API_KEY=                 # server-only, nikdy do frontendu/commitu
OPENAI_VALIDATION_MODEL=gpt-5.5
OPENAI_VALIDATION_PROVIDER=mock # 'mock' | 'openai'
OPENAI_VALIDATION_TIMEOUT_MS=15000
OPENAI_VALIDATION_LOG_RAW_PROMPTS=false
```

### Bezpečný fallback

AI nikdy nesmie pokaziť submission workflow:

- **Zlyhanie API** (sieť/timeout/SDK) → mock skóre s `source: 'mock_fallback'`.
- **Nevalidný JSON z modelu** → bezpečný stub (`valid: false`,
  `suggestedTeacherReview: true`, dôvod *„AI response could not be parsed
  safely"*), `source: 'mock_fallback'`. Parsuje a clampuje
  `backend/validators/aiValidationResultValidator.ts` (score 0–100, confidence
  0–1). `suggestedTeacherReview` je vždy `true` pri confidence < 0.75.

### Čo sa posiela do AI (a čo nie)

Posiela sa len: názov a cieľ misie, rubrika, **anonymizovaná** odpoveď žiaka,
typ dôkazu a definície cieľových kompetencií. **Neposiela sa** meno/email žiaka,
session token, access code, Supabase IDs, hashe ani API kľúče. Raw prompty sa do
DB **neukladajú** (logging vypnutý cez `OPENAI_VALIDATION_LOG_RAW_PROMPTS=false`).
Prompt je krátky, `max_output_tokens` nízke, bez tool use.

## Teacher review – AI je len návrh

AI vráti **návrh** hodnotenia; učiteľ ho **potvrdí alebo upraví**. Workflow
(`teacherReviewService`):

- `approved` – učiteľ súhlasí s AI; finálne skóre = AI skóre.
- `adjusted` – učiteľ prepíše skóre/validitu (povinný `adjustment_reason`).
- `needs_revision` – vráti žiakovi (povinná spätná väzba), 0 XP.
- `rejected` – zamietne (povinná spätná väzba), 0 XP.

Každý review je auditovateľný riadok v `teacher_reviews`. **Finálne XP sa
commitne až po review** (approve/adjust) — viď
[GAMIFICATION_MODEL.md](GAMIFICATION_MODEL.md). Žiak vidí AI spätnú väzbu, stav
*„čaká na učiteľské potvrdenie"* a po review finálnu spätnú väzbu učiteľa
v detsky zrozumiteľnom jazyku.

## Validácia vstupu

`backend/validators/submissionValidator.ts` overuje min/max dĺžku textu a
povolený typ dôkazu **pred** akoukoľvek AI/DB prácou. Endpoint nikdy nevracia
tajomstvá ani stack trace.
