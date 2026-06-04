/**
 * Validates and normalises the JSON returned by the AI model.
 *
 * The model is untrusted: it may return malformed JSON, markdown fences,
 * out-of-range numbers, or missing fields. This validator NEVER throws —
 * on any problem it returns a safe fallback that flags teacher review.
 */
import type { AIValidationResult, AIReason, DetectedCompetency } from '../services/aiValidationService';

export type ParseResult =
  | { ok: true; value: Omit<AIValidationResult, 'source'> }
  | { ok: false; fallback: Omit<AIValidationResult, 'source'> };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Extract the first balanced JSON object from a possibly-noisy string. */
function extractJson(text: string): string | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function safeFallback(model: string, reason: string): Omit<AIValidationResult, 'source'> {
  return {
    valid: false,
    score: 0,
    confidence: 0,
    reasons: [{ criterion: 'AI', result: 'unmet', explanation: reason }],
    detectedCompetencies: [],
    suggestedTeacherReview: true,
    model,
  };
}

function normaliseReasons(input: unknown): AIReason[] {
  if (!Array.isArray(input)) return [];
  const valid: AIReason['result'][] = ['met', 'partial', 'unmet'];
  return input
    .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
    .map((r) => ({
      criterion: String(r.criterion ?? ''),
      result: valid.includes(r.result as AIReason['result']) ? (r.result as AIReason['result']) : 'partial',
      explanation: String(r.explanation ?? ''),
    }));
}

function normaliseCompetencies(input: unknown): DetectedCompetency[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
    .map((c) => ({
      id: String(c.id ?? ''),
      strength: clamp(Number(c.strength ?? 0), 0, 1),
      evidence: String(c.evidence ?? ''),
    }))
    .filter((c) => c.id.length > 0);
}

/**
 * Parse raw model output into a validated AIValidationResult (minus `source`).
 * @param raw   Raw text from the model.
 * @param model Model name to record (safe to expose).
 */
export function parseAIValidationResult(raw: string, model: string): ParseResult {
  const json = extractJson(raw);
  if (!json) {
    return { ok: false, fallback: safeFallback(model, 'AI response could not be parsed safely') };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, fallback: safeFallback(model, 'AI response could not be parsed safely') };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, fallback: safeFallback(model, 'AI response could not be parsed safely') };
  }

  const obj = parsed as Record<string, unknown>;

  // Required core fields must be present and of the right primitive type.
  if (typeof obj.valid !== 'boolean' || typeof obj.score !== 'number' || typeof obj.confidence !== 'number') {
    return { ok: false, fallback: safeFallback(model, 'AI response could not be parsed safely') };
  }

  const score = clamp(Math.round(obj.score), 0, 100);
  const confidence = clamp(Number(obj.confidence), 0, 1);
  const reasons = normaliseReasons(obj.reasons);
  const detectedCompetencies = normaliseCompetencies(obj.detectedCompetencies);

  // Low confidence always flags teacher review, regardless of model claim.
  const suggestedTeacherReview =
    obj.suggestedTeacherReview === true || confidence < 0.75 || !obj.valid;

  return {
    ok: true,
    value: {
      valid: Boolean(obj.valid),
      score,
      confidence,
      reasons,
      detectedCompetencies,
      suggestedTeacherReview,
      model,
    },
  };
}
