# INVOK — kontext pre tvorbu digitálneho obsahu

> Tento dokument je brief pre AI asistenta (Claude) aj pre človeka, ktorý bude
> tvoriť doplnkový digitálny obsah (videá, obrázky, grafiku) pre vzdelávací
> program **INVOK** — cez Higgsfield alebo iné AI platformy. Obsahuje všetko, čo
> treba, aby obsah sadol značke, cieľovke a technike. Čítaj celé pred tvorbou.

---

## 1. Čo je INVOK (stručne)
INVOK je **gamifikovaná vzdelávacia platforma pre slovenské základné školy**,
hlavne pre **8.–9. ročník (13–15 rokov)**. Je súčasťou oficiálneho 3‑ročného
programu, ktorý beží pod **PSC n.o.** a je **spolufinancovaný Európskou úniou**
(program „Program Slovensko") a Ministerstvom práce SR. Verejná stránka programu:
**invok.pscno.sk**, samotná appka beží na **invok-one.vercel.app**.

Cieľ programu: rozvíjať u žiakov **kľúčové kompetencie pre život** — podnikavosť,
kritické a mediálne myslenie, tímovú spoluprácu, komunikáciu a digitálne
zručnosti — cez reálne projekty a video lekcie.

Platforma má dva piliere:
- **Projektové výzvy** = žiak rieši reálny projekt (robí).
- **Akadémia** = video lekcie podľa modulov (učí sa) → pre toto tvoríme obsah.

---

## 2. Cieľová skupina a tón
- **Vek 13–15** (slovenskí tínedžeri). Obsah má byť **moderný, Gen‑Z, hovorový**,
  nie ako nudná prednáška. Energia, humor, priame oslovenie, krátke údery.
- **Inkluzívne a prístupné:** veľa detí má dyslexiu/dysgrafiu → preto **video**
  (nie text) a **vždy titulky**.
- **Vekovo primerané:** žiadne vulgarizmy, násilie, nič nevhodné. Pozitívne,
  povzbudivé, reálne (slovenské/stredoeurópske školské prostredie).

---

## 3. Značka a dizajn
**Vizuálny štýl:** teplý, svetlý, optimistický, mierne 3D/ilustračný/cinematický.
Inšpirácia paletou „Monax" — bledé teplé neutrály + hravé akcenty.

**Farby (presné hex):**
- Pozadie / neutrály: `#efede8` (bg), `#ffffff` (karty), `#e9e5db`, okraj `#dcd7c9`
- Text: `#0d0d10`, tlmený text `#84817a`
- Akcent fialová (primárna): `#7c5cd6` (silnejšia `#5e3da0`)
- Sage zelená: `#6f9c33` · koral/amber: `#e6884f` · červená: `#cf3340`
- „Guľôčkové" akcenty (pre energiu): fialová `#7c5cd6`, jantárová `#e0a82e`,
  koral `#e36a4d`, modrá `#6fa8c3`, zelená `#6f9c33`, červená `#cf3340`

**Font:** Inter (alebo systémový sans). Tučné nadpisy, tesný letter‑spacing.

**Smarta** = AI sprievodkyňa platformy. Vystupuje **pohodovo a kamarátsky** (tyká,
Gen‑Z jazyk, ľahký humor), má odborné znalosti, ale podáva ich jednoducho —
„kamoš + pedagóg v jednom". Vo videách funguje ako **hlas/rozprávač** (voiceover),
nie ako generovaná postava (AI nevie držať konzistentnú tvár).

---

## 4. Štyri moduly (každý = farba + kompetencia + odznak)
| Modul | Téma | Detský názov kompetencie | Odznak | Akcent / emoji |
|---|---|---|---|---|
| **1** | Podnikavosť a inovácie | Tvorca riešení | Inovátor školy | fialová · 💡 |
| **2** | Kritické a mediálne myslenie | Detektív faktov | Lovec hoaxov | modrá · 🔍 |
| **3** | Tímová spolupráca | Staviteľ tímu | Tímový stratég | zelená · 🤝 |
| **4** | Komunikácia a prezentácia | Mladý rečník | Mladý rečník | koral · 🎤 |

Každý modul má **3–5 video lekcií**. Farba modulu sa používa ako akcent vo videu
(napr. modul 1 = fialové svetlo/iskra).

---

## 5. Akadémia — ako funguje lekcia (slučka)
**Video → krátky kvíz → XP.** Žiak pozrie video (2–4 min), vyplní **MCQ kvíz
(3 otázky)**; ak prejde (≥ 60 %), dostane **+30 XP** a lekcia má ✓. XP sa počíta
do jeho celkového progresu (kompetencie, odznaky).

Takže ku každej lekcii treba dodať: **video + 3 kvízové otázky** (otázka + 3
možnosti + ktorá je správna).

---

## 6. Ako majú videá vyzerať (pravidlá)
- **Dĺžka:** 2–4 min. Jeden nápad = jasná linka. Rýchly strih.
- **Titulky VŽDY** (WCAG 2.1 AA + dyslexia) — buď „vypálené" do videa, alebo `.srt`.
- **Hlas:** Smarta (priateľský Gen‑Z rozprávač) alebo reálny mladý hlas.
- **Formát:** 16:9, primárne **720p**, H.264 MP4. (9:16 hook len na intro/sociálne.)
- **Vizuál:** bledá Monax paleta, akcent farby modulu, teplé svetlo, reálne
  slovenské/stredoeurópske školské prostredie, rôznorodí tínedžeri (~14 r.),
  semi‑realistický 3D/cinematický look, optimistická nálada. Bez loga a textu v
  obraze (text/grafika sa pridáva v editore).

---

## 7. Tvorba videa na Higgsfield (overený postup)
Higgsfield generuje **krátke klipy (5–10 s)** z obrázka (image‑to‑video). Postup:

1. **Image (Soul) záložka** → vygeneruj **statický obrázok** z *image promptu*
   (16:9). Zapíš si `seed` dobrého obrázka + používaj rovnaký štýl‑suffix → jednotný
   look. (Obrázky stoja málo — tu experimentuj.)
2. **Video záložka → Upload media** = nahraj ten obrázok.
3. **Prompt** = krátky *motion* (pohyb kamery + čo sa deje), nie opis scény.
4. **CHOOSE PRESET** = kamera (push‑in, pan, crane up…).
5. **Model** podľa náročnosti záberu (kreditová logika):
   - **Enhanced Seedance 2.0 Fast** — ak ho máš ako *UNLIMITED*, rob na ňom
     (skoro) všetko zadarmo (720p, jemný pohyb).
   - **Kling 3.0 / Veo 3.1 Lite / Seedance 2.0 (1080p)** = kreditové → len 1–2
     „hero" zábery, ak treba extra kvalitu/pohyb.
6. **5 s · 16:9 · 720p · Bitrate High** → Generate. Najprv test na lacnom modeli.

**Kreditová logika / efektivita:** nie každý záber musí byť AI video. Mix:
- pár **hero AI klipov** (úvod, kľúčová premena, montáž),
- **Soul obrázky** + pohyb (pan/zoom „Ken Burns") **v editore** = 0 video‑kreditov,
- **text karty / outro** v editore (Canva/CapCut).

> Seedance Fast = jemný pohyb, **nie veľké premeny**. Morfy/zložité prechody rob
> ako dva obrázky + prechod v editore.

---

## 8. Štýl‑suffix + vzory promptov
**Štýl‑suffix (pridaj ku KAŽDÉMU image promptu, po anglicky):**
```
warm muted beige palette, soft cinematic light, subtle violet rim light,
semi-realistic 3D illustration, optimistic mood, Central-European school setting,
diverse 14-year-old teens, shallow depth of field, no text, no logos
```
(Akcentovú farbu „violet" zameň podľa modulu: modul 2 → blue, 3 → green, 4 → coral.)

**Image prompt** = celá scéna + štýl‑suffix. **Motion prompt** (do Video záložky) =
krátky pohyb, napr.:
- `slow push-in toward the student, the violet idea-spark flickers and glows`
- `gentle parallax drift, the teen leans in slightly, soft ambient motion`
- `energetic handheld motion, teens actively building and working, lively`
- `slow smooth pan across the courtyard, warm morning light`

---

## 9. Vzorový storyboard (Modul 1 · Lekcia 1) — šablóna pre ďalšie
**Lekcia:** „Prečo niektorí menia svet a iní sa len sťažujú?" (✅ už hotová)
Obsah: problém vs príležitosť, mladí inovátori, ako vznikajú nápady.

| # | Image prompt (EN) + štýl‑suffix | Pohyb / model | Typ |
|---|---|---|---|
| 1 Hook | `a 14-year-old in a plain school hallway, looking up at a faint violet idea-spark glowing above` | push‑in · stred. model | AI video 5s |
| 2 | `split scene: bored teen on phone vs curious teen noticing a broken bench` | parallax · lacný | AI video 5s |
| 3 | `a small tangled knot on a path, symbolic obstacle` | — | obrázok + zoom v editore |
| 4 Hero | `the obstacle transforms into a glowing violet doorway, staircase rising` | crane up · silný model | AI video 5s |
| 5 Hero | `montage: teens building a school garden, coding, putting up a poster` | handheld energický · silný | AI video 5–10s |
| 6 | `wall of sticky notes and sketches, a hand adding one, soft lightbulb glow` | — | obrázok + pan v editore |
| 7 | `slow pan across a tidy school courtyard, optimistic morning light` | pan · lacný | AI video 5s |
| 8 Outro | — (grafika v editore) | — | logo + „Modul 1 · Podnikavosť" + CTA |

**Kvíz k tejto lekcii (vzor formátu):**
1. Čo je „príležitosť"? → *(správne)* Ten istý problém — len otočený na „čo s tým môžem ja".
2. Odkiaľ prichádzajú dobré nápady? → *(správne)* Keď si všímaš okolie a pýtaš sa „prečo?" a „čo keby?".
3. Aký je tvoj prvý krok? → *(správne)* Všimnúť si, čo ťa v škole najviac štve.

---

## 10. Voiceover (Smarta) — štýl scenára
Píš **Gen‑Z, hovorovo, krátke vety, priame oslovenie**. Príklad tónu (Lekcia 1):
> „Okej, rýchla otázka — čo majú spoločné ľudia, čo reálne menia svet? Pozri…
> niekto vidí rozbitú lavičku a len frfle. A niekto to isté vidí ako šancu.
> Problém je niečo, čo ťa štve. Príležitosť? Ten istý problém — len otočený na teba.
> … Čo ťa najviac štve? Boom. To je tvoja prvá príležitosť. Ideš do toho?"

Hlas: ideálne **reálny mladý človek** (najautentickejšie pre cieľovku), alebo AI
TTS (OpenAI `gpt-4o-mini-tts`, hlas `coral`) / ElevenLabs vlastný hlas.

---

## 11. Technické špecifikácie výstupu
- **Kontajner/kodek:** MP4, **H.264** (video) + **AAC** (zvuk), `yuv420p`.
- **Rozlíšenie:** 720p (1280×720), **16:9**, ~30 fps.
- **Web‑optimalizácia:** `+faststart` (moov atom na začiatku) — inak sa zle streamuje.
- **Veľkosť:** ~10–15 MB na 1–2 min (web kvalita).
- **Titulky:** vypálené v obraze, alebo samostatný `.srt` súbor.

**ffmpeg príkaz na prevod (napr. z .MOV/4K na web 720p):**
```
ffmpeg -i VSTUP.MOV -vf "fps=30,scale=-2:720" -c:v libx264 -profile:v main \
  -level 3.1 -crf 23 -preset medium -pix_fmt yuv420p -c:a aac -b:a 128k \
  -movflags +faststart vystup-720.mp4
```

---

## 12. Čo treba vyrobiť (zoznam lekcií)
| Modul | Lekcie (pracovné názvy) |
|---|---|
| **1 Podnikavosť** | L1 Prečo niektorí menia svet ✅ · L2 Ako spoznať problém · L3 Ako vznikajú nápady · L4 Z nápadu projekt |
| **2 Kritické/mediálne** | L1 Čo je hoax a prečo funguje · L2 Ako overiť info · L3 Fakt vs názor vs titulok · L4 Kto a prečo to zverejnil |
| **3 Tímová spolupráca** | L1 Ako funguje dobrý tím · L2 Riešenie nezhôd · L3 Digitálne nástroje + bezpečnosť · L4 Spätná väzba bez urážok |
| **4 Komunikácia** | L1 Pitch za 90 sekúnd · L2 Reč tela a hlas · L3 Jednoduchá prezentácia · L4 Argumentuj bez hádky |

Ku každej lekcii dodaj: **MP4 video + 3 kvízové otázky** (formát z bodu 9).

---

## 13. Pravidlá a obmedzenia
- **EÚ publicita:** program je dotovaný; v oficiálnych materiáloch patria logá
  (EÚ · Program Slovensko · PSC n.o. · Ministerstvo práce). Vo videách stačí
  jemné INVOK outro; logá riešime na úrovni platformy.
- **GDPR / súkromie:** žiaci sú pseudonymní. **Nepoužívať reálne tváre/mená
  reálnych detí** — AI‑generované postavy sú ideálne.
- **Prístupnosť:** titulky povinné, dobrý kontrast, jednoduchý jazyk.
- **Vek:** všetko vekovo primerané (13–15).

---

## 14. Ako odovzdať hotový obsah
Pošli **hotové MP4 (720p, faststart)** + (voliteľne `.srt` titulky) + **3 kvízové
otázky** ku každej lekcii. Na strane platformy sa video: prekóduje (ak treba),
nahrá do úložiska (Supabase Storage, EÚ región) a pridá do Akadémie ako lekcia
v príslušnom module. Žiadny ďalší kód tvorca obsahu riešiť nemusí.

---

*Tento súbor je živý brief — ak sa zmení paleta, moduly alebo workflow, treba ho
aktualizovať. Verzia: jún 2026.*
