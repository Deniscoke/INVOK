/**
 * AI quest generator (SERVER-ONLY).
 *
 * Generates a INVOK + ŠVP ZV-aligned quest from a student-provided topic.
 * Uses the configured OpenAI model (env.openaiValidationModel) via structured
 * outputs. Falls back to a deterministic offline scaffold when:
 *   - OPENAI_VALIDATION_PROVIDER is not 'openai', or
 *   - OPENAI_API_KEY is missing, or
 *   - the API call fails / times out.
 *
 * The output shape mirrors CreateQuestInput in studentQuestService so the
 * caller can pipe it straight into createOwnQuest.
 */
import { getServerEnv, shouldUseOpenAI } from '../lib/env.js';
import { getCompetencies } from './missionService.js';

export interface QuestDraft {
  title: string;
  description: string;
  goal: string;
  affectedGroup: string;
  evidence: string;
  firstIdea: string;
  /** 2–4 short, student-facing "Čo sa naučíš" points (written TO the pupil). */
  learningOutcomes: string[];
  competencyIds: string[];
  xpEstimate: number;
  source: 'ai';
  aiModel: string;
  aiPrompt: string;
  rationale: string;
  rvpAlignment: string;
}

export interface GenerateQuestInput {
  topic: string;
  grade?: number;
  proposedDeadline?: string; // YYYY-MM-DD, optional
  studentAlias?: string;
}

export type GenerateResult =
  | { ok: true; data: QuestDraft; source: 'openai' | 'mock' }
  | { ok: false; error: string };

const SYSTEM_PROMPT = `Si pedagóg-asistent platformy INVOK pre slovenské základné školy.
Navrhuješ ŽIAKOM 8. a 9. ročníka (13–15 r.) realizovateľnú misiu (quest).

Misia MUSÍ:
1. Riešiť konkrétny lokálny problém (škola / trieda / komunita), nie všeobecnú tému.
2. Byť v súlade s INVOK kompetenciami a Štátnym vzdelávacím programom ŠVP ZV.
3. Viesť k podnikavému prvému kroku — niečo malé a merateľné, čo žiak zvládne do
   1–3 týždňov bez špeciálneho vybavenia.
4. Mať jasný dôkaz (čo žiak zmeria / pozoruje / spýta sa) a konkrétny prvý nápad
   na riešenie. NESMIE byť len opisom problému.

Štýl písania (DÔLEŽITÉ):
- Píš PRIAMO ŽIAKOVI, oslovuj ho „ty" („Zistíš…", „Naučíš sa…", „Vyskúšaš si…").
- Jazyk jednoduchý, konkrétny a motivujúci — primeraný 13–15-ročným.
- "description" (2–4 vety) zrozumiteľne vysvetlí, O ČOM misia je, ČO bude žiak
   robiť a PREČO to má zmysel.
- "learningOutcomes": 2–4 krátke body „Čo sa naučíš" — každý sa začína slovesom
   v 2. osobe (napr. „Naučíš sa overiť zdroj informácie."). Konkrétne zručnosti,
   nie fráza „rozvinieš kompetencie".

Zakázané:
- Politické, citlivé alebo osobné/zdravotné témy bez kontextu pedagóga.
- Nereálne ambície (vyriešiť svetový hlad atď.).
- Návrhy, ktoré porušujú súkromie tretích osôb.

Tvoj výstup MUSÍ byť JSON podľa schémy nižšie. Všetky polia píš po slovensky.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  required: ['title', 'description', 'goal', 'affectedGroup', 'evidence', 'firstIdea', 'learningOutcomes', 'competencyIds', 'xpEstimate', 'rationale', 'rvpAlignment'],
  additionalProperties: false,
  properties: {
    title: { type: 'string', minLength: 5, maxLength: 120 },
    description: { type: 'string', minLength: 40, maxLength: 600 },
    goal: { type: 'string', minLength: 20, maxLength: 400 },
    affectedGroup: { type: 'string', minLength: 3, maxLength: 200 },
    evidence: { type: 'string', minLength: 20, maxLength: 500 },
    firstIdea: { type: 'string', minLength: 20, maxLength: 500 },
    learningOutcomes: {
      type: 'array',
      items: { type: 'string', minLength: 8, maxLength: 160 },
      minItems: 2,
      maxItems: 4,
    },
    competencyIds: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      maxItems: 4,
    },
    xpEstimate: { type: 'integer', minimum: 30, maximum: 250 },
    rationale: { type: 'string', minLength: 20, maxLength: 600 },
    rvpAlignment: { type: 'string', minLength: 10, maxLength: 400 },
  },
} as const;

function competencyContextBlock(): string {
  const competencies = getCompetencies().map((c) => `- ${c.id}: ${c.childName} — ${c.teacherDescription}`).join('\n');
  return `Dostupné INVOK kompetencie (vyber 1–3 najvhodnejšie do competencyIds):\n${competencies}`;
}

function buildUserPrompt(input: GenerateQuestInput): string {
  const grade = input.grade ?? 8;
  const aliasNote = input.studentAlias ? `\nPrezývka žiaka (len pre kontext): ${input.studentAlias}.` : '';
  return [
    `Oblasť záujmu žiaka: "${input.topic}".`,
    `Vek: žiak ${grade}. ročníka ZŠ.`,
    input.proposedDeadline ? `Žiakom navrhovaný termín: ${input.proposedDeadline}.` : '',
    aliasNote,
    '',
    competencyContextBlock(),
    '',
    'Vytvor misiu tak, aby:',
    '- bola realizovateľná na úrovni triedy / školy / blízkej komunity,',
    '- mala merateľný výstup (počítanie, pozorovanie, krátky rozhovor, fotka),',
    '- žiakovi dala priestor pre kreativitu, ale aj jasný prvý krok,',
    '- spadala pod 1–3 INVOK kompetencie.',
  ].filter(Boolean).join('\n');
}

function mockDraft(input: GenerateQuestInput): QuestDraft {
  const topic = input.topic.trim();
  const cleanTopic = topic.charAt(0).toUpperCase() + topic.slice(1);
  return {
    title: `Misia: ${cleanTopic}`,
    description: `V tejto misii sa pozrieš na oblasť „${topic.toLowerCase()}“ vo svojej škole alebo triede. Najprv zistíš, ako to vyzerá teraz, potom navrhneš jedno konkrétne zlepšenie a vyskúšaš ho v malom. Naučíš sa všímať si problémy okolo seba a riešiť ich podnikavo.`,
    goal: `Urobiť jeden merateľný krok, ktorý zlepší situáciu v oblasti „${topic}“ — od pozorovania cez nápad po vyskúšanie v malom.`,
    affectedGroup: 'naša trieda a školská komunita',
    evidence: `Krátke pozorovanie (3–5 dní) alebo prieskum (5–10 spolužiakov) o tom, ako vyzerá súčasný stav v oblasti „${topic}“.`,
    firstIdea: `Navrhnúť 1 konkrétne, lacné a rýchle zlepšenie v oblasti „${topic}“ a otestovať ho v jednom týždni.`,
    learningOutcomes: [
      `Naučíš sa pozorovať a zmerať, ako vyzerá súčasný stav v oblasti „${topic}“.`,
      'Navrhneš konkrétne riešenie a vyskúšaš ho v malom.',
      'Vyhodnotíš, či tvoj nápad zabral, a poučíš sa z výsledku.',
    ],
    competencyIds: ['fact_detective', 'maker_venture'],
    xpEstimate: 100,
    source: 'ai',
    aiModel: 'mock-quest-scaffold-v1',
    aiPrompt: buildUserPrompt(input),
    rationale: 'Demo režim — AI nie je zapnuté, použitá je offline šablóna založená na vstupnej téme.',
    rvpAlignment: 'Prierezové gramotnosti (občianska, mediálna), oblasť „Človek a svet práce“ — podnikavosť a tvorivosť.',
  };
}

/**
 * GPT-5.x and the o-series reasoning models reject a custom `temperature` on
 * chat.completions (only the default 1 is allowed) — sending one makes the call
 * 400 and we silently fall back to mock. Only attach temperature for models that
 * accept it (4o / 4.1 family).
 */
export function supportsTemperature(model: string): boolean {
  return !/^(gpt-5|o\d)/i.test(model);
}

function validateInput(input: unknown): { ok: true; value: GenerateQuestInput } | { ok: false; error: string } {
  const body = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  if (topic.length < 3 || topic.length > 200) {
    return { ok: false, error: 'Téma misie musí mať 3–200 znakov.' };
  }
  const grade = typeof body.grade === 'number' && Number.isFinite(body.grade) ? Math.floor(body.grade) : undefined;
  if (grade != null && (grade < 1 || grade > 9)) {
    return { ok: false, error: 'Ročník musí byť 1–9.' };
  }
  const proposedDeadline = typeof body.proposedDeadline === 'string' ? body.proposedDeadline : undefined;
  if (proposedDeadline && !/^\d{4}-\d{2}-\d{2}$/.test(proposedDeadline)) {
    return { ok: false, error: 'Termín musí byť dátum YYYY-MM-DD.' };
  }
  const studentAlias = typeof body.studentAlias === 'string' ? body.studentAlias.slice(0, 80) : undefined;
  return { ok: true, value: { topic, grade, proposedDeadline, studentAlias } };
}

export async function generateQuest(input: unknown): Promise<GenerateResult> {
  const validation = validateInput(input);
  if (!validation.ok) return { ok: false, error: validation.error };
  const value = validation.value;

  const env = getServerEnv();
  if (!shouldUseOpenAI(env)) {
    return { ok: true, data: mockDraft(value), source: 'mock' };
  }

  try {
    const { getOpenAIClient } = await import('../lib/openaiClient.js');
    const client = getOpenAIClient();
    if (!client) return { ok: true, data: mockDraft(value), source: 'mock' };

    const userPrompt = buildUserPrompt(value);
    const timeoutMs = env.openaiValidationTimeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const completion = await client.chat.completions.create(
      {
        model: env.openaiQuestModel,
        ...(supportsTemperature(env.openaiQuestModel) ? { temperature: 0.4 } : {}),
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'invok_quest_draft',
            schema: RESPONSE_SCHEMA,
            strict: true,
          },
        },
      },
      { signal: controller.signal },
    );
    clearTimeout(timer);

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return { ok: true, data: mockDraft(value), source: 'mock' };

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const competencyIds = Array.isArray(parsed.competencyIds)
      ? (parsed.competencyIds as unknown[]).filter((x): x is string => typeof x === 'string')
      : [];
    const validCompetencies = getCompetencies().map((c) => c.id);
    const filteredCompetencies = competencyIds.filter((id) => validCompetencies.includes(id));

    const learningOutcomes = Array.isArray(parsed.learningOutcomes)
      ? (parsed.learningOutcomes as unknown[])
          .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
          .map((x) => x.trim().slice(0, 160))
          .slice(0, 4)
      : [];

    const draft: QuestDraft = {
      title: String(parsed.title ?? '').slice(0, 120),
      description: String(parsed.description ?? '').slice(0, 600),
      goal: String(parsed.goal ?? '').slice(0, 400),
      affectedGroup: String(parsed.affectedGroup ?? '').slice(0, 200),
      evidence: String(parsed.evidence ?? '').slice(0, 500),
      firstIdea: String(parsed.firstIdea ?? '').slice(0, 500),
      learningOutcomes,
      competencyIds: filteredCompetencies.length > 0 ? filteredCompetencies : ['maker_venture'],
      xpEstimate: Math.min(250, Math.max(30, Math.round(Number(parsed.xpEstimate ?? 100)))),
      source: 'ai',
      aiModel: env.openaiQuestModel,
      aiPrompt: userPrompt,
      rationale: String(parsed.rationale ?? ''),
      rvpAlignment: String(parsed.rvpAlignment ?? ''),
    };
    return { ok: true, data: draft, source: 'openai' };
  } catch (error) {
    if (env.openaiValidationLogRawPrompts) {
      console.warn('[quest-generator] OpenAI call failed, falling back to mock', error);
    }
    return { ok: true, data: mockDraft(value), source: 'mock' };
  }
}
