import { describe, it, expect } from 'vitest';
import {
  validateSubmissionWithAI,
  anthropicValidateSubmission,
  mockValidateSubmission,
} from '../../backend/services/aiValidationService';

// These tests are OFFLINE: no ANTHROPIC_API_KEY / AI_VALIDATION_PROVIDER set,
// so the anthropic path must fall back safely without any network call.

const input = {
  missionId: 'design_solution',
  studentResponse: 'Navrhujem riešenie, pretože som zistil problém. Prvý krok je plán.',
  evidenceText: 'Pozoroval som situáciu, mám dôkaz.',
  evidenceType: 'text' as const,
};

describe('provider switching (offline)', () => {
  it('mock provider works and is tagged source=mock', async () => {
    const result = await validateSubmissionWithAI(input);
    expect(result.source).toBe('mock');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('mockValidateSubmission alias returns a mock result', async () => {
    const result = await mockValidateSubmission(input);
    expect(result.source).toBe('mock');
  });

  it('anthropic provider without API key falls back safely (no throw, no network)', async () => {
    const result = await anthropicValidateSubmission(input);
    expect(result.source).toBe('mock_fallback');
    expect(typeof result.valid).toBe('boolean');
    expect(typeof result.suggestedTeacherReview).toBe('boolean');
  });

  it('result always has the required shape regardless of provider', async () => {
    const result = await validateSubmissionWithAI(input, {
      rubric: [{ id: 'relevance', label: 'Relevantnosť', description: '...' }],
      targetCompetencies: ['maker_venture'],
    });
    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('reasons');
    expect(result).toHaveProperty('detectedCompetencies');
    expect(result).toHaveProperty('suggestedTeacherReview');
    expect(result).toHaveProperty('model');
    expect(result).toHaveProperty('source');
  });
});
