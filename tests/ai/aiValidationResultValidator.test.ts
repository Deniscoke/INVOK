import { describe, it, expect } from 'vitest';
import { parseAIValidationResult } from '../../backend/validators/aiValidationResultValidator';

describe('parseAIValidationResult', () => {
  it('parses valid JSON', () => {
    const raw = JSON.stringify({
      valid: true,
      score: 82,
      confidence: 0.78,
      reasons: [{ criterion: 'relevantnosť', result: 'met', explanation: 'OK' }],
      detectedCompetencies: [{ id: 'maker_venture', strength: 0.7, evidence: 'návrh' }],
      suggestedTeacherReview: false,
    });
    const result = parseAIValidationResult(raw, 'claude-test');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.score).toBe(82);
      expect(result.value.confidence).toBe(0.78);
      expect(result.value.model).toBe('claude-test');
      expect(result.value.reasons).toHaveLength(1);
    }
  });

  it('extracts JSON from surrounding prose / markdown fences', () => {
    const raw = '```json\n{"valid":true,"score":50,"confidence":0.6,"reasons":[],"detectedCompetencies":[],"suggestedTeacherReview":true}\n```';
    const result = parseAIValidationResult(raw, 'm');
    expect(result.ok).toBe(true);
  });

  it('clamps score to 0..100 and confidence to 0..1', () => {
    const raw = JSON.stringify({ valid: true, score: 250, confidence: 5, reasons: [], detectedCompetencies: [], suggestedTeacherReview: false });
    const result = parseAIValidationResult(raw, 'm');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.score).toBe(100);
      expect(result.value.confidence).toBe(1);
    }
  });

  it('forces teacher review when confidence is low', () => {
    const raw = JSON.stringify({ valid: true, score: 60, confidence: 0.4, reasons: [], detectedCompetencies: [], suggestedTeacherReview: false });
    const result = parseAIValidationResult(raw, 'm');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.suggestedTeacherReview).toBe(true);
  });

  it('falls back safely on invalid JSON', () => {
    const result = parseAIValidationResult('this is not json at all', 'm');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fallback.suggestedTeacherReview).toBe(true);
      expect(result.fallback.valid).toBe(false);
      expect(result.fallback.reasons[0].explanation).toContain('could not be parsed safely');
    }
  });

  it('falls back when required fields are missing/wrong type', () => {
    const raw = JSON.stringify({ valid: 'yes', score: 'high' });
    const result = parseAIValidationResult(raw, 'm');
    expect(result.ok).toBe(false);
  });
});
