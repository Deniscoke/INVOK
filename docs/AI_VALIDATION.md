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

## Stav implementácie

`backend/services/aiValidationService.ts` beží ako **deterministický mock**
(skóruje podľa dĺžky a jazykových signálov). Architektúra je pripravená na
reálne Claude volanie: `backend/prompts/aiValidationPrompt.ts` definuje systémový
prompt a JSON schému; stačí vymeniť telo `validateSubmission` — volajúci (`api/`)
ani testy sa nemenia.

## Validácia vstupu

`backend/validators/submissionValidator.ts` overuje min/max dĺžku textu a
povolený typ dôkazu **pred** akoukoľvek AI/DB prácou. Endpoint nikdy nevracia
tajomstvá ani stack trace.
