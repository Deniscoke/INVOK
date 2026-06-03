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

## Mastery

`user_progress.mastery` (0–1) je **formatívny signál** zvládnutia kompetencie,
nie známka. Aktualizuje sa z misií a (neskôr) z učiteľského posúdenia.
