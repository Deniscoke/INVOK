# Model gamifikácie

Gamifikácia funguje, keď je previazaná s cieľmi učenia, spätnou väzbou a
sebariadením — nie keď zostane pri „bodíkoch a odmenách". Model INVOk preto
stavia na **rast, tím a portfólio**, nie na súťaž o poradie.

## Prvky

| Prvok | Pedagogický zmysel | Pravidlo |
|---|---|---|
| **XP** | Pocit postupu a rastu v čase. | Viazané na **kvalitu**, nie iba dokončenie. |
| **Levely** | Zrozumiteľný míľnik rastu. | Akcelerujúca krivka (viď nižšie). |
| **Odznaky** | Oceňujú konkrétne **správanie/výstup**. | Udeľované za jasný dôkaz, nie za poradie. |
| **Misie** | Cieľ, kontext a problém. | Hodnotí sa priebeh aj výsledok. |
| **Progress bary** | Znižujú neistotu, pomáhajú plánovať. | Merajú checkpointy, nie len finálny upload. |
| **Tímové výzvy** | Posilňujú spoluprácu a spoločný cieľ. | Lepšie než verejné individuálne rebríčky. |
| **Portfólio** | Dlhodobý dôkaz pokroku a reflexia. | Základ pre sebahodnotenie a učiteľský prehľad. |

## Krivka levelov

Kumulatívne XP na dosiahnutie levelu `L`:

```
xpForLevel(L) = 100 * (L - 1)^2
→ L1:0, L2:100, L3:400, L4:900, L5:1600, L6:2500 ...
```

Akcelerujúca krivka drží **rané úspechy časté** (motivácia mladších žiakov) a
vyššie levely robí „zaslúženými". Implementácia:
`backend/services/progressService.ts`.

## Prečo nie verejné individuálne leaderboardy

Pri mladších žiakoch čisto extrinzický, súťaživý dizajn môže časom oslabiť
motiváciu a poškodiť sociálno-emocionálnu pohodu. Preto uprednostňujeme model
**„mastery / progress first"**: osobný rast, tímové achievementy a odznaky za
konkrétne správanie. Sociálno-emocionálna pohoda je samostatný kurikulárny cieľ.

## Finálne XP je viazané na učiteľa (auditovateľné)

XP funguje ako **dvojfázový commit**:

1. **Odovzdanie + AI** → predbežné `xp_awarded` na riadku odovzdania, ale
   **nezapočíta sa** do `profiles.total_xp` ani `user_progress`.
2. **Učiteľský review** → až rozhodnutie `approved`/`adjusted` **commitne**
   finálne XP (škálované finálnym skóre). `needs_revision`/`rejected` = 0 XP.

Pravidlo (`progressService.finalXpForReview`): `XP = baseXp × finalScore/100`
pre approved/adjusted, inak 0. Každý zisk XP je tak dohľadateľný k jednému
záznamu v `teacher_reviews` (audit trail pre školu/grant).

## Odmena za návrh problému (podnikavosť)

Žiak dostane odmenu aj za **prvú fázu podnikavého procesu** — kvalitné
pomenovanie problému, nie len za vyriešenie celej misie. Návrh problému
(`submission_kind = 'problem_proposal'`) sa hodnotí samostatnou **problem
rubrikou** (jasnosť, konkrétnosť, dôkaz/pozorovanie, koho sa týka, prvý návrh,
dopad, všímavosť) a získa **predbežné XP = 10–40 %** základného XP misie podľa
kvality (`progressService.problemProposalXp`).

Predbežné XP sa **nezapočíta definitívne** — potvrdí ho učiteľský review (rovnaký
dvojfázový commit). Pri chýbajúcom dôkaze AI odporučí učiteľské posúdenie. Rubrika
zámerne odmeňuje **dôkaz a konkrétnosť**, aby nemotivovala k vymýšľaniu problémov.

## Reporting pre školu (dashboard)

Hravé prvky (XP, levely, kompetencie, návrhy problémov, teacher review) sa
agregujú do **anonymizovaného školského dashboardu** pre pedagogické
rozhodovanie a grantový reporting: KPI prehľad, priemerný kompetenčný progres,
súhrn návrhov problémov a štatistiky učiteľských hodnotení (vrátane rozdielu
AI vs. učiteľské skóre). Dáta sú **iba agregáty** + anonymizovaný CSV export —
viď [SECURITY.md](SECURITY.md).

## Mastery

`user_progress.mastery` (0–1) je **formatívny signál** zvládnutia kompetencie,
nie známka. Aktualizuje sa z misií a z **učiteľského posúdenia** (po approve/adjust).
