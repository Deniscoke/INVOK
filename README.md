# INVOK

**Gamifikovaná vzdelávacia platforma pre slovenské školy.** Žiaci sa učia cez
video lekcie, riešia **projektové výzvy** vo svojej škole a dostávajú
**formatívnu AI spätnú väzbu** — pričom **učiteľ zostáva garantom** hodnotenia.
Súkromie žiakov je v základe dizajnu: **pseudonymita, žiadne osobné údaje,
žiadne verejné rebríčky.**

Zameranie: rozvoj podnikavosti, kritického a mediálneho myslenia, tímovej
spolupráce a komunikácie.

## Čo platforma vie

**Pre žiaka**
- **Akadémia** — video lekcie po moduloch, po každej krátky kvíz a XP
- **Projektové výzvy** — žiak navrhne (alebo mu pomôže AI) → učiteľ schváli →
  žiak realizuje a odovzdá vrátane dokumentácie (foto/video/PDF) → AI vyhodnotí →
  učiteľ potvrdí
- **Moja cesta** — XP, kompetencie na škále 1–5, odznaky, postup
- **Smarta** — AI sprievodkyňa (chat + hlas) priamo v aplikácii
- **Výstupy** — certifikát, portfólio a report pre rodičov (tlač / PDF)
- **Dotazníky** — vstupný a výstupný na meranie vlastného rastu

**Pre učiteľa a vedenie školy**
- Schvaľovanie výziev a dvojstupňové hodnotenie (AI návrh + potvrdenie učiteľom)
- Prehľad žiakov, kompetencií a dokončených lekcií (pseudonymne)
- **Dashboard rastu** — priemerný posun kompetencií (vstup → výstup) v %
- **Galéria projektov** „Ako žiaci menia svoje školy"
- Tvorba tried a generovanie prístupových kódov pre žiakov

## Ako to funguje

Žiaci sa neprihlasujú e‑mailom ani heslom. Učiteľ vytvorí triedu a vygeneruje
**prístupové kódy**; žiak zadá kód + prezývku. Platforma tak **nikdy nespracúva
osobné údaje žiakov** — všetko je naviazané na pseudonym. Učitelia používajú
bežné e‑mailové prihlásenie.

## Stack

| Vrstva | Technológia |
|---|---|
| Frontend | Vite + TypeScript (bez frameworku), dizajn‑tokeny v CSS |
| API | Vercel Functions (Node 22), catch‑all routery |
| Dáta | Supabase — Postgres + RLS, Auth, Storage (EÚ región) |
| AI | OpenAI (hodnotenie, generovanie výziev, chat, TTS), voliteľne ElevenLabs |

## Spustenie

```bash
npm install
cp .env.example .env   # doplň Supabase + OpenAI kľúče
npm run dev
```

Ďalšie príkazy: `npm run typecheck`, `npm run build`.

Migrácie databázy sú v `supabase/migrations/` (aplikujú sa v poradí).
Bez nakonfigurovaného Supabase beží aplikácia v bezpečnom **demo režime**
(lokálne dáta, ukážkové AI odpovede) — vhodné na prezentáciu.

## Prístupnosť a súkromie

- Cieľ **WCAG 2.1 AA** — kontrast, ovládanie klávesnicou, ARIA, rešpektovanie
  „obmedziť pohyb", titulky pri videách; vyhlásenie o prístupnosti je v aplikácii
- Pseudonymita žiakov, dáta v EÚ, RLS na úrovni databázy, prísne CSP

## Štruktúra

```
frontend/src/    UI, stránky, komponenty, klientske služby
backend/         doménová logika (server-only)
api/             Vercel Functions (catch-all routery)
supabase/        SQL migrácie a seed
data/            kompetencie, odznaky, katalóg misií
```

## Licencia

Licencia zatiaľ nie je stanovená. Bez uvedenej licencie platí štandardné
autorské právo — kód nie je voľne použiteľný tretími stranami.
