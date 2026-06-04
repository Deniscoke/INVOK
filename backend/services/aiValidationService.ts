/**
 * AI formative validation service.
 *
 * IMPORTANT: AI is a FORMATIVE assistant, never the final grader. The teacher
 * stays the guarantor. This module returns a structured, explainable result
 * (valid / score / confidence / reasons / detectedCompetencies /
 * suggestedTeacherReview).
 *
 * Today it runs a DETERMINISTIC MOCK. The architecture is ready for a real
 * Claude call: build the prompt with `buildAIValidationPrompt`, call the
 * model, parse the JSON, and return the same `AIValidationResult` shape — the
 * callers and tests do not change.
 */
import type { SubmissionInput } from '../validators/submissionValidator';

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

function mockEvaluate(input: SubmissionInput, context: AIValidationContext): AIValidationResult {
  const combined = `${input.studentResponse}\n${input.evidenceText}`;
  const length = input.studentResponse.trim().length;

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
      if (countKeywords(combined, keywords) >= 1) rubricBonus += 5;
    }
  }

  // Length contributes up to ~50 points, signals up to ~35, rubric bonus up to ~15
  const lengthScore = clamp(length / 8, 0, 50);
  const signalScore = clamp(totalSignals * 7, 0, 35);
  const score = Math.round(clamp(lengthScore + signalScore + rubricBonus, 0, 100));

  // Confidence grows with both length and signal density; deliberately capped at 0.92
  // so the mock never appears certain enough to bypass teacher review.
  const confidence = round2(clamp(0.28 + length / 1400 + totalSignals * 0.05, 0.28, 0.92));

  const hasEvidence = input.evidenceText.trim().length > 0;
  const valid = score >= 45 && length >= 30;

  // Formative bias: low confidence, weak evidence, borderline score → teacher review
  const suggestedTeacherReview = !valid || confidence < 0.75 || !hasEvidence;

  const reasons = buildReasons(context, { score, hasEvidence, combined });
  const detectedCompetencies = buildDetectedCompetencies(context, {
    evidenceSignals,
    solutionSignals,
    reflectionSignals,
    communitySignals: countKeywords(combined, COMMUNITY_KEYWORDS),
    problemSignals,
  });

  return {
    valid,
    score,
    confidence,
    reasons,
    detectedCompetencies,
    suggestedTeacherReview,
    model: MOCK_MODEL,
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
