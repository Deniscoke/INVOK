/**
 * INVOK input/output competency self-assessment — content (verbatim from the
 * program spec). 6 areas × 8 Likert statements (1–5) + 4 open questions.
 * Scoring: each area 8–40, total 48–240. The same questionnaire is taken at the
 * START (input) and after finishing the modules (output) to measure growth.
 */
export interface QuestionnaireArea {
  /** Stable id 'A'…'F' — answer keys are `${id}${n}` e.g. "A1". */
  id: string;
  title: string;
  /** Mapped INVOK competency (for later analysis); E has no direct competency. */
  competencyId: string | null;
  statements: string[];
}

export const SCALE_LABELS: Record<number, string> = {
  1: 'Vôbec to na mňa nesedí',
  2: 'Skôr to na mňa nesedí',
  3: 'Ani áno, ani nie',
  4: 'Skôr to na mňa sedí',
  5: 'Úplne to na mňa sedí',
};

export const QUESTIONNAIRE_AREAS: readonly QuestionnaireArea[] = [
  {
    id: 'A',
    title: 'Podnikavosť a iniciatíva',
    competencyId: 'maker_venture',
    statements: [
      'Keď vidím problém, rozmýšľam nad riešením.',
      'Mám nápady, ako zlepšiť veci okolo seba.',
      'Nebojím sa navrhnúť nový spôsob riešenia.',
      'Ak sa mi niečo nepáči, snažím sa nájsť spôsob, ako to zmeniť.',
      'Rád/rada začínam nové aktivity.',
      'Dokážem prevziať iniciatívu aj bez pokynov od dospelých.',
      'Verím, že moje nápady môžu mať hodnotu.',
      'Baví ma vytvárať nové projekty alebo aktivity.',
    ],
  },
  {
    id: 'B',
    title: 'Kritické a mediálne myslenie',
    competencyId: 'fact_detective',
    statements: [
      'Overujem si informácie skôr, než im uverím.',
      'Zaujíma ma, odkiaľ informácia pochádza.',
      'Dokážem rozlíšiť fakt od názoru.',
      'Zamýšľam sa nad tým, kto vytvoril informáciu, ktorú čítam.',
      'Nie všetkému, čo vidím na internete, automaticky verím.',
      'Dokážem rozpoznať prehnané alebo manipulatívne titulky.',
      'Pri dôležitých informáciách hľadám viac zdrojov.',
      'Rozmýšľam nad tým, prečo niekto zverejnil určitý obsah.',
    ],
  },
  {
    id: 'C',
    title: 'Tímová spolupráca',
    competencyId: 'team_builder',
    statements: [
      'Viem pracovať v tíme.',
      'Počúvam názory ostatných.',
      'Rešpektujem aj ľudí, ktorí majú iný názor ako ja.',
      'Dokážem spolupracovať aj s ľuďmi, ktorí nie sú moji kamaráti.',
      'Pri práci v skupine sa snažím prispieť.',
      'Viem sa dohodnúť na spoločnom riešení.',
      'Pomáham ostatným, keď si nevedia rady.',
      'Dokážem prijať spätnú väzbu.',
    ],
  },
  {
    id: 'D',
    title: 'Digitálne zručnosti',
    competencyId: 'digital_navigator',
    statements: [
      'Viem používať digitálne nástroje na učenie.',
      'Dokážem nájsť potrebné informácie na internete.',
      'Viem vytvoriť jednoduchú prezentáciu.',
      'Dokážem bezpečne pracovať v online prostredí.',
      'Viem používať online nástroje na spoluprácu.',
      'Rozumiem základným pravidlám bezpečnosti na internete.',
      'Viem vyhodnotiť, či je internetová stránka dôveryhodná.',
      'Dokážem efektívne využívať digitálne technológie pri riešení úloh.',
    ],
  },
  {
    id: 'E',
    title: 'Komunikácia a prezentácia',
    competencyId: null,
    statements: [
      'Nebojím sa vyjadriť svoj názor.',
      'Dokážem vysvetliť svoje myšlienky zrozumiteľne.',
      'Viem prezentovať pred skupinou ľudí.',
      'Dokážem obhájiť svoj názor slušným spôsobom.',
      'Viem argumentovať bez hádky.',
      'Pri diskusii počúvam aj druhú stranu.',
      'Dokážem hovoriť o svojich nápadoch pred ostatnými.',
      'Cítim sa sebavedomo pri prezentovaní.',
    ],
  },
  {
    id: 'F',
    title: 'Sebahodnotenie a budúcnosť',
    competencyId: 'self_captain',
    statements: [
      'Verím, že dokážem dosiahnuť svoje ciele.',
      'Keď sa mi niečo nepodarí, skúšam to znova.',
      'Dokážem sa učiť z vlastných chýb.',
      'Rád/rada skúšam nové veci.',
      'Zaujímam sa o to, čo budem robiť v budúcnosti.',
      'Premýšľam o tom, ako môžem rozvíjať svoje schopnosti.',
      'Verím, že môžem pozitívne ovplyvniť svoje okolie.',
      'Som otvorený/á novým výzvam.',
    ],
  },
];

export const OPEN_QUESTIONS: readonly { id: string; text: string }[] = [
  { id: 'o1', text: 'Čo by si chcel/a zmeniť vo svojej škole?' },
  { id: 'o2', text: 'Na čo si vo svojom živote najviac hrdý/á?' },
  { id: 'o3', text: 'Akú schopnosť by si chcel/a počas programu najviac rozvinúť?' },
  { id: 'o4', text: 'Keby si mohol/mohla vytvoriť jeden projekt pre svoju školu alebo komunitu, aký by bol?' },
];

export const ITEMS_PER_AREA = 8;
export const TOTAL_ITEMS = QUESTIONNAIRE_AREAS.length * ITEMS_PER_AREA; // 48
export const MAX_SCORE = TOTAL_ITEMS * 5; // 240
