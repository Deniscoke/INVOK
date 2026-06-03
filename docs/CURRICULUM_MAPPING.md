# Kurikulárne mapovanie

## Slovenský kontext

Oficiálny kurikulárny dokument pre základné vzdelávanie na Slovensku je
**Štátny vzdelávací program pre základné vzdelávanie (ŠVP ZV, 2023)** — nie
český „RVP". ŠVP posúva ťažisko od memorovania k funkčnej gramotnosti,
kritickému prístupu k informáciám, riešeniu problémov, tvorbe a spolupráci.

INVOk **nekopíruje** celý ŠVP a nenahrádza ho. Robí silný, grantovo uveriteľný
**výrez** tam, kde sa pretínajú podnikavosť, kritické myslenie, tímovosť a
digitálne prostredie.

## Dve vrstvy názvov

1. **Detský názov (UI pre deti)** — hravý, motivačný. Deťom **nezobrazujeme**
   akademické termíny ako „kritické myslenie" či „digitálne kompetencie".
2. **Interné pedagogické mapovanie (učiteľ/admin)** — opis, kurikulárna oblasť
   a spôsob merania pre učiteľa.

## Hrdinské kompetencie

| ID | Detský názov | Interná oblasť (ŠVP ZV) |
|---|---|---|
| `fact_detective` | Detektív faktov | Mediálna a občianska gramotnosť |
| `maker_venture` | Tvorca riešení | Človek a svet práce / podnikavosť |
| `team_builder` | Staviteľ tímu | Sociálno-emocionálne učenie / spolupráca |
| `digital_navigator` | Digitálny navigátor | Digitálna gramotnosť / bezpečnosť |
| `community_hero` | Hrdina komunity | Občianska gramotnosť / hodnoty |
| `resource_guardian` | Strážca zdrojov | Finančná gramotnosť |
| `planet_guardian` | Ochranca planéty | Environmentálna gramotnosť |
| `self_captain` | Kapitán svojho rastu | Sebareflexia / metakognícia |

Každá kompetencia má v `data/competencies.json` a v tabuľke `competencies`:
detský názov + opis, učiteľský opis, kurikulárne ukotvenie, príklady merania.

## Dôležité ohraničenie

Platformové kompetencie **nie sú náhrada predmetových známok**. Učiteľ v INVOk
sleduje **projektový rozvoj a výkon**, nie paralelný klasifikačný systém. To
znižuje odpor škôl a zvyšuje kompatibilitu s ich ŠkVP.

> Mapovanie je **interné**, nejde o priamu citáciu oficiálneho dokumentu.
> Zdrojový výskum: [research/invok-rvp-sk-research.md](research/invok-rvp-sk-research.md).
