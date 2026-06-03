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

const EVIDENCE_KEYWORDS = ['lebo', 'pretože', 'zdroj', 'dôkaz', 'zistil', 'všimol', 'údaj', 'data'];
const SOLUTION_KEYWORDS = ['riešenie', 'navrhujem', 'zlepšiť', 'krok', 'plán', 'vyriešiť'];
const REFLECTION_KEYWORDS = ['naučil', 'nabudúce', 'cieľ', 'zlepším', 'uvedomil'];

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
  const totalSignals = evidenceSignals + solutionSignals + reflectionSignals;

  // Length contributes up to ~55 points, signals up to ~45.
  const lengthScore = clamp(length / 6, 0, 55);
  const signalScore = clamp(totalSignals * 9, 0, 45);
  const score = Math.round(clamp(lengthScore + signalScore, 0, 100));

  // Confidence grows with both length and signal density; stays humble.
  const confidence = round2(clamp(0.3 + length / 1200 + totalSignals * 0.06, 0.3, 0.95));

  const hasEvidence = input.evidenceText.trim().length > 0;
  const valid = score >= 50 && length >= 40;

  // Formative bias: low confidence, weak evidence or borderline score → teacher.
  const suggestedTeacherReview = !valid || confidence < 0.8 || !hasEvidence || (score >= 50 && score < 65);

  const reasons = buildReasons(context, { score, hasEvidence, evidenceSignals, solutionSignals });
  const detectedCompetencies = buildDetectedCompetencies(context, {
    evidenceSignals,
    solutionSignals,
    reflectionSignals,
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
  signals: { score: number; hasEvidence: boolean; evidenceSignals: number; solutionSignals: number },
): AIReason[] {
  const result = (ok: boolean, partial: boolean): AIReason['result'] =>
    ok ? 'met' : partial ? 'partial' : 'unmet';

  if (context.rubric && context.rubric.length > 0) {
    return context.rubric.map((criterion, index) => {
      const met = signals.score >= 65 && (index === 0 || signals.hasEvidence);
      const partial = signals.score >= 45;
      return {
        criterion: criterion.label,
        result: result(met, partial),
        explanation: met
          ? `Odovzdanie napĺňa kritérium „${criterion.label}".`
          : partial
            ? `Kritérium „${criterion.label}" je naznačené, no dôkazy by mohli byť silnejšie.`
            : `Pre kritérium „${criterion.label}" chýba dostatočný dôkaz.`,
      };
    });
  }

  return [
    {
      criterion: 'relevantnosť',
      result: result(signals.solutionSignals > 0, signals.score >= 45),
      explanation:
        signals.solutionSignals > 0
          ? 'Odovzdanie reaguje na zadanie a naznačuje konkrétny krok.'
          : 'Odovzdanie zatiaľ jasne nereaguje na zadanie.',
    },
    {
      criterion: 'dôkazy',
      result: result(signals.hasEvidence && signals.evidenceSignals > 0, signals.hasEvidence),
      explanation: signals.hasEvidence
        ? 'Žiak pripojil podporný dôkaz.'
        : 'Chýba podporný dôkaz – vhodné pre učiteľské posúdenie.',
    },
  ];
}

function buildDetectedCompetencies(
  context: AIValidationContext,
  signals: { evidenceSignals: number; solutionSignals: number; reflectionSignals: number },
): DetectedCompetency[] {
  const targets = context.targetCompetencies ?? [];
  const strengthFor = (id: string): number => {
    if (id.includes('fact')) return clamp(0.3 + signals.evidenceSignals * 0.2, 0, 1);
    if (id.includes('maker') || id.includes('solution')) return clamp(0.3 + signals.solutionSignals * 0.2, 0, 1);
    if (id.includes('self') || id.includes('captain')) return clamp(0.3 + signals.reflectionSignals * 0.2, 0, 1);
    return 0.4;
  };

  return targets.map((id) => ({
    id,
    strength: round2(strengthFor(id)),
    evidence: 'Odhadnuté z jazykových signálov v odpovedi (mock).',
  }));
}
