/**
 * AI formative validation service.
 *
 * IMPORTANT: AI is a FORMATIVE assistant, never the final grader. The teacher
 * stays the guarantor. This module returns a structured, explainable result
 * (valid / score / confidence / reasons / detectedCompetencies /
 * suggestedTeacherReview).
 *
 * Provider-aware: a deterministic MOCK by default, or a real OpenAI call when
 * configured via env. Either way it returns the same `AIValidationResult`
 * shape, so callers and tests do not change.
 */
import type { SubmissionInput } from '../validators/submissionValidator.js';
import { getServerEnv, shouldUseOpenAI } from '../lib/env.js';
import { getMissionById, getCompetencies } from './missionService.js';
import {
  AI_VALIDATION_SYSTEM_PROMPT,
  AI_VALIDATION_JSON_SCHEMA,
  buildValidationPrompt,
  type ValidationPromptInput,
} from '../prompts/aiValidationPrompt.js';
import { parseAIValidationResult } from '../validators/aiValidationResultValidator.js';

export type AISource = 'mock' | 'openai' | 'mock_fallback';

export interface AIReason {
  criterion: string;
  result: 'met' | 'partial' | 'unmet';
  explanation: string;
}

export interface DetectedCompetency {
  id: string;
  strength: number; // 0..1
  evidence: string;
}

export interface AIValidationResult {
  valid: boolean;
  score: number; // 0..100
  confidence: number; // 0..1
  reasons: AIReason[];
  detectedCompetencies: DetectedCompetency[];
  suggestedTeacherReview: boolean;
  model: string;
  source: AISource;
}

export interface AIValidationContext {
  rubric?: { id: string; label: string; description: string }[];
  targetCompetencies?: string[];
}

const MOCK_MODEL = 'mock-formative-validator-v1';

// General signal groups
const EVIDENCE_KEYWORDS = ['lebo', 'pretože', 'zdroj', 'dôkaz', 'zistil', 'všimol', 'údaj', 'data', 'videl', 'počul'];
const SOLUTION_KEYWORDS = ['riešenie', 'navrhujem', 'zlepšiť', 'krok', 'plán', 'vyriešiť', 'zmeniť', 'idea', 'nápad'];
const REFLECTION_KEYWORDS = ['naučil', 'nabudúce', 'cieľ', 'zlepším', 'uvedomil', 'skúsim', 'podarilo', 'ťažké'];
const PROBLEM_KEYWORDS = ['problém', 'chyba', 'zlé', 'chýba', 'nedostatok', 'trápi', 'sťažuje', 'bráni'];
const CLARITY_KEYWORDS = ['pretože', 'teda', 'napríklad', 'konkrétne', 'znamená', 'čiže', 'tým', 'takto'];
const COMMUNITY_KEYWORDS = ['škola', 'trieda', 'spolužiaci', 'učiteľ', 'komunita', 'okolie', 'ľudia'];

// Per-criterion keyword map: rubric criterion id → relevant signal words
const CRITERION_KEYWORDS: Record<string, string[]> = {
  clarity:       CLARITY_KEYWORDS,
  evidence:      EVIDENCE_KEYWORDS,
  impact:        COMMUNITY_KEYWORDS,
  relevance:     SOLUTION_KEYWORDS,
  feasibility:   ['môžeme', 'dá', 'stačí', 'jednoducho', 'krok', 'realizovateľné', 'uskutočniť'],
  first_step:    ['krok', 'začneme', 'prvý', 'najprv', 'plán', 'cieľ'],
  method:        ['postup', 'krok', 'spôsob', 'ako', 'metóda', 'plán'],
  teamwork:      ['spolu', 'tím', 'pomohol', 'rozdelili', 'dohodli', 'spolupráca'],
  findings:      EVIDENCE_KEYWORDS,
  structure:     ['po prvé', 'po druhé', 'záver', 'úvod', 'hlavná', 'začiatok', 'koniec'],
  openness:      ['pochopil', 'súhlasím', 'zmením', 'skúsim', 'vďaka', 'pomohlo'],
  synthesis:     ['zhrnutie', 'celkovo', 'väčšina', 'dôvod', 'hlavne'],
  iteration:     ['zmenili', 'vylepšili', 'opravili', 'inak', 'lepšie', 'podľa'],
  reasoning:     CLARITY_KEYWORDS,
  resourcefulness: ['čas', 'peniaze', 'materiál', 'menej', 'šetriť', 'hospodárne'],
  honesty:       REFLECTION_KEYWORDS,
  specificity:   ['konkrétne', 'presne', 'nabudúce', 'plánujem', 'cieľ'],
  value:         COMMUNITY_KEYWORDS,
};

function countKeywords(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.reduce((n, word) => (lower.includes(word) ? n + 1 : n), 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Validate a submission and return a formative, explainable result.
 *
 * @param input   Already-validated submission payload.
 * @param context Optional mission rubric + target competencies for richer reasons.
 */
export async function validateSubmission(
  input: SubmissionInput,
  context: AIValidationContext = {},
): Promise<AIValidationResult> {
  return mockEvaluate(input, context);
}

/** Deterministic offline mock (alias of validateSubmission). */
export const mockValidateSubmission = validateSubmission;

export interface AIValidationOptions {
  /** Force the mock provider (e.g. anonymous callers must not spend OpenAI credit). */
  forceMock?: boolean;
}

/**
 * Provider-aware entry point. Uses the real OpenAI provider only when
 * `OPENAI_VALIDATION_PROVIDER=openai` AND an API key + model are configured AND
 * the caller did not force mock; otherwise stays on the mock. Never throws —
 * AI failures degrade safely.
 */
export async function validateSubmissionWithAI(
  input: SubmissionInput,
  context: AIValidationContext = {},
  options: AIValidationOptions = {},
): Promise<AIValidationResult> {
  const env = getServerEnv();
  if (!options.forceMock && shouldUseOpenAI(env)) {
    return openAIValidateSubmission(input, context);
  }
  return mockEvaluate(input, context);
}

/** Build a privacy-safe prompt input (mission + work text only, no PII). */
function buildPromptInput(input: SubmissionInput, context: AIValidationContext): ValidationPromptInput {
  const mission = getMissionById(input.missionId);
  const rubric = (context.rubric ?? mission?.rubric ?? []).map((c) => ({
    criterion: c.label,
    description: c.description,
  }));
  const targetIds = context.targetCompetencies ?? mission?.targetCompetencies ?? [];
  const competencies = getCompetencies();
  const targetCompetencies = targetIds.map((id) => {
    const comp = competencies.find((c) => c.id === id);
    return { id, childName: comp?.childName ?? id, teacherDescription: comp?.teacherDescription };
  });
  return {
    missionTitle: mission?.title ?? input.missionId,
    missionGoal: mission?.goal ?? '',
    rubric,
    evidenceText: input.evidenceText || input.studentResponse,
    evidenceType: 'text',
    targetCompetencies,
  };
}

/**
 * Real OpenAI provider (Responses API + strict JSON schema). Sends ONLY mission
 * metadata + the work text — no student name/email/IDs/tokens. On any failure,
 * falls back to the mock scorer with `source: 'mock_fallback'`, so the
 * submission workflow never breaks because of the AI.
 */
export async function openAIValidateSubmission(
  input: SubmissionInput,
  context: AIValidationContext = {},
): Promise<AIValidationResult> {
  const env = getServerEnv();
  try {
    const { getOpenAIClient } = await import('../lib/openaiClient.js');
    const client = getOpenAIClient();
    if (!client) {
      return { ...mockEvaluate(input, context), source: 'mock_fallback' };
    }

    // Cost guard: don't spend an API call on too-short evidence.
    const evidence = (input.evidenceText || input.studentResponse).trim();
    if (evidence.length < env.aiMinEvidenceChars) {
      return { ...mockEvaluate(input, context), source: 'mock_fallback' };
    }

    // Cost guard: cap characters sent to the model (defence-in-depth vs the validator).
    const capped: SubmissionInput = {
      ...input,
      studentResponse: input.studentResponse.slice(0, env.aiMaxEvidenceChars),
      evidenceText: input.evidenceText.slice(0, env.aiMaxEvidenceChars),
    };
    const prompt = buildValidationPrompt(buildPromptInput(capped, context));
    const response = await client.responses.create(
      {
        model: env.openaiValidationModel,
        max_output_tokens: 700,
        input: [
          { role: 'system', content: AI_VALIDATION_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'ai_validation_result',
            strict: true,
            schema: AI_VALIDATION_JSON_SCHEMA,
          },
        },
      },
      { timeout: env.openaiValidationTimeoutMs },
    );

    const parsed = parseAIValidationResult(response.output_text ?? '', env.openaiValidationModel);
    return parsed.ok
      ? { ...parsed.value, source: 'openai' }
      : { ...parsed.fallback, source: 'mock_fallback' };
  } catch {
    // Network/timeout/SDK error — degrade safely, never break the workflow.
    return { ...mockEvaluate(input, context), source: 'mock_fallback' };
  }
}

/**
 * Strip the structured field labels we add when composing submissions on the
 * frontend (e.g. "Problém:", "Dôkaz:", "Prvý nápad na riešenie:") so the
 * mock keyword counter cannot reward students for label words alone.
 */
const LABEL_RE = /(^|\n)\s*(problém|koho sa týka|čo (?:som si|si si) všimol|dôkaz(?: alebo pozorovanie)?|prvý nápad(?: na riešenie)?|riešenie\s*\/\s*odpoveď|riešenie|prínos\s*\/\s*koho sa týka|prínos|prvý krok|foto dôkaz|popis fotky)\s*:[^\n]*/giu;

function stripFieldLabels(text: string): string {
  return text
    .replace(LABEL_RE, (match) => {
      const colonIdx = match.indexOf(':');
      return colonIdx >= 0 ? '\n' + match.slice(colonIdx + 1) : '';
    })
    .replace(/[ \t]+/g, ' ')
    .trim();
}

interface CoherenceResult {
  coherent: boolean;
  reason: string;
}

/**
 * Reject obvious gibberish ("asdasdasd"), pure repetition, or text that
 * is structurally unlike natural Slovak/English. Keeps the mock honest so
 * arbitrary keyboard input cannot earn a passing score.
 */
function assessCoherence(text: string): CoherenceResult {
  const trimmed = text.trim();
  if (trimmed.length < 15) return { coherent: false, reason: 'Vstup je príliš krátky.' };

  const letters = trimmed.toLowerCase().replace(/[^a-záäčďéíľĺňóôŕšťúýž]/g, '');
  if (letters.length >= 8) {
    const unique = new Set(letters).size;
    if (unique < 6) return { coherent: false, reason: 'Príliš málo rôznych písmen.' };

    for (let patternLen = 2; patternLen <= 4; patternLen++) {
      const pattern = letters.slice(0, patternLen);
      if (pattern.length < patternLen) continue;
      let i = 0;
      while (i + patternLen <= letters.length && letters.slice(i, i + patternLen) === pattern) i += patternLen;
      if (i >= letters.length * 0.6 && i >= patternLen * 3) {
        return { coherent: false, reason: 'Text je len opakovaný vzor znakov.' };
      }
    }

    const vowels = (letters.match(/[aáäeéiíoóôuúyý]/g) ?? []).length;
    const vowelRatio = vowels / letters.length;
    if (vowelRatio < 0.18 || vowelRatio > 0.65) {
      return { coherent: false, reason: 'Pomer samohlások nezodpovedá bežnému jazyku.' };
    }
  }

  const words = trimmed.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 3) return { coherent: false, reason: 'Príliš málo slov.' };
  const avg = words.reduce((s, w) => s + w.length, 0) / words.length;
  if (avg < 2.4 || avg > 14) return { coherent: false, reason: 'Nereálna priemerná dĺžka slov.' };
  const uniqueWords = new Set(words).size;
  if (words.length >= 5 && uniqueWords / words.length < 0.4) {
    return { coherent: false, reason: 'Slová sa príliš opakujú.' };
  }
  const realLooking = words.filter((w) => /[aeiouyáéíóúýäô]/i.test(w) && w.length >= 2).length;
  if (realLooking / words.length < 0.5) {
    return { coherent: false, reason: 'Väčšina slov nevyzerá ako reálne slová.' };
  }
  return { coherent: true, reason: '' };
}

function mockEvaluate(input: SubmissionInput, context: AIValidationContext): AIValidationResult {
  // Score only the student's actual text — strip our injected section labels.
  const cleanResponse = stripFieldLabels(input.studentResponse);
  const cleanEvidence = stripFieldLabels(input.evidenceText);
  const combined = `${cleanResponse}\n${cleanEvidence}`;
  const length = cleanResponse.length;

  const coherence = assessCoherence(combined);
  if (!coherence.coherent) {
    const rubric = context.rubric ?? [];
    const reasons: AIReason[] = [
      { criterion: 'zrozumiteľnosť vstupu', result: 'unmet', explanation: coherence.reason },
      ...rubric.map((c) => ({
        criterion: c.label,
        result: 'unmet' as const,
        explanation: `Vstup nedáva zmysel — kritérium „${c.label}" nemožno posúdiť.`,
      })),
    ];
    return {
      valid: false,
      score: Math.max(0, Math.min(15, Math.round(length / 30))),
      confidence: 0.32,
      reasons,
      detectedCompetencies: [],
      suggestedTeacherReview: true,
      model: MOCK_MODEL,
      source: 'mock',
    };
  }

  const evidenceSignals = countKeywords(combined, EVIDENCE_KEYWORDS);
  const solutionSignals = countKeywords(combined, SOLUTION_KEYWORDS);
  const reflectionSignals = countKeywords(combined, REFLECTION_KEYWORDS);
  const problemSignals = countKeywords(combined, PROBLEM_KEYWORDS);
  const totalSignals = evidenceSignals + solutionSignals + reflectionSignals + problemSignals;

  // Rubric-aware bonus: if a criterion's specific keywords appear, add points
  let rubricBonus = 0;
  if (context.rubric) {
    for (const criterion of context.rubric) {
      const keywords = CRITERION_KEYWORDS[criterion.id] ?? CLARITY_KEYWORDS;
      if (countKeywords(combined, keywords) >= 1) rubricBonus += 3;
    }
  }

  const words = combined.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  const uniqueRatio = words.length ? new Set(words).size / words.length : 0;
  const vocabularyBonus = clamp((uniqueRatio - 0.5) * 30, 0, 15);

  // Length contributes up to ~35 pts, signals up to ~25, rubric bonus up to ~21,
  // vocabulary diversity up to ~15 — total caps at 100.
  const lengthScore = clamp(length / 10, 0, 35);
  const signalScore = clamp(totalSignals * 5, 0, 25);
  const score = Math.round(clamp(lengthScore + signalScore + rubricBonus + vocabularyBonus, 0, 100));

  // Confidence grows with both length and signal density; capped at 0.90
  // so the mock never appears certain enough to bypass teacher review.
  const confidence = round2(clamp(0.30 + length / 1600 + totalSignals * 0.04 + uniqueRatio * 0.15, 0.30, 0.90));

  const hasEvidence = cleanEvidence.length >= 10;
  const valid = score >= 50 && length >= 40 && totalSignals >= 1 && hasEvidence;

  // Formative bias: low confidence, weak evidence, borderline score → teacher review
  const suggestedTeacherReview = !valid || confidence < 0.78 || !hasEvidence || totalSignals < 2;

  const reasons = buildReasons(context, { score, hasEvidence, combined });
  const detectedCompetencies = valid
    ? buildDetectedCompetencies(context, {
        evidenceSignals,
        solutionSignals,
        reflectionSignals,
        communitySignals: countKeywords(combined, COMMUNITY_KEYWORDS),
        problemSignals,
      })
    : [];

  return {
    valid,
    score,
    confidence,
    reasons,
    detectedCompetencies,
    suggestedTeacherReview,
    model: MOCK_MODEL,
    source: 'mock',
  };
}

function buildReasons(
  context: AIValidationContext,
  signals: { score: number; hasEvidence: boolean; combined: string },
): AIReason[] {
  const result = (met: boolean, partial: boolean): AIReason['result'] =>
    met ? 'met' : partial ? 'partial' : 'unmet';

  if (context.rubric && context.rubric.length > 0) {
    return context.rubric.map((criterion) => {
      const keywords = CRITERION_KEYWORDS[criterion.id] ?? CLARITY_KEYWORDS;
      const hits = countKeywords(signals.combined, keywords);
      const met = hits >= 2 && signals.score >= 55;
      const partial = hits >= 1 || signals.score >= 40;
      return {
        criterion: criterion.label,
        result: result(met, partial),
        explanation: met
          ? `Odovzdanie napĺňa kritérium „${criterion.label}".`
          : partial
            ? `Kritérium „${criterion.label}" je naznačené — dôkazy môžu byť silnejšie.`
            : `Pre kritérium „${criterion.label}" chýba dostatočný dôkaz.`,
      };
    });
  }

  // Fallback when no rubric provided
  return [
    {
      criterion: 'relevantnosť',
      result: result(signals.score >= 60, signals.score >= 40),
      explanation:
        signals.score >= 60
          ? 'Odovzdanie reaguje na zadanie a naznačuje konkrétny krok.'
          : 'Odovzdanie zatiaľ jasne nereaguje na zadanie.',
    },
    {
      criterion: 'jasnosť pomenovania',
      result: result(signals.score >= 55 && countKeywords(signals.combined, PROBLEM_KEYWORDS) > 0, signals.score >= 35),
      explanation:
        countKeywords(signals.combined, PROBLEM_KEYWORDS) > 0
          ? 'Žiak pomenoval problém alebo situáciu.'
          : 'Pomenovaný problém nie je dostatočne jasný.',
    },
    {
      criterion: 'konkrétnosť návrhu',
      result: result(countKeywords(signals.combined, SOLUTION_KEYWORDS) >= 2, countKeywords(signals.combined, SOLUTION_KEYWORDS) >= 1),
      explanation:
        countKeywords(signals.combined, SOLUTION_KEYWORDS) >= 1
          ? 'Žiak naznačil konkrétny návrh alebo riešenie.'
          : 'Chýba konkrétny návrh alebo prvý krok.',
    },
    {
      criterion: 'dôkaz splnenia',
      result: result(signals.hasEvidence, signals.score >= 40),
      explanation: signals.hasEvidence
        ? 'Dôkaz bol priložený.'
        : 'Chýba podporný dôkaz — vhodné pre učiteľské posúdenie.',
    },
    {
      criterion: 'reflexia / ďalší krok',
      result: result(countKeywords(signals.combined, REFLECTION_KEYWORDS) >= 1, signals.score >= 50),
      explanation:
        countKeywords(signals.combined, REFLECTION_KEYWORDS) >= 1
          ? 'Odovzdanie obsahuje reflexiu alebo ďalší krok.'
          : 'Reflexia alebo ďalší krok nie sú prítomné.',
    },
  ];
}

function buildDetectedCompetencies(
  context: AIValidationContext,
  signals: {
    evidenceSignals: number;
    solutionSignals: number;
    reflectionSignals: number;
    communitySignals: number;
    problemSignals: number;
  },
): DetectedCompetency[] {
  const targets = context.targetCompetencies ?? [];

  const strengthFor = (id: string): number => {
    if (id.includes('fact')) return clamp(0.25 + signals.evidenceSignals * 0.18 + signals.problemSignals * 0.1, 0, 1);
    if (id.includes('maker') || id.includes('solution')) return clamp(0.25 + signals.solutionSignals * 0.18, 0, 1);
    if (id.includes('self') || id.includes('captain')) return clamp(0.25 + signals.reflectionSignals * 0.18, 0, 1);
    if (id.includes('community') || id.includes('hero')) return clamp(0.25 + signals.communitySignals * 0.15, 0, 1);
    if (id.includes('team')) return clamp(0.3 + signals.communitySignals * 0.12, 0, 1);
    if (id.includes('planet')) return clamp(0.2 + signals.evidenceSignals * 0.12, 0, 1);
    if (id.includes('resource')) return clamp(0.2 + signals.solutionSignals * 0.1, 0, 1);
    return 0.35;
  };

  return targets.map((id) => ({
    id,
    strength: round2(strengthFor(id)),
    evidence: 'Odhadnuté z jazykových signálov v odpovedi (mock).',
  }));
}
