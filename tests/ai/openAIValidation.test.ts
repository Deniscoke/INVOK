import { describe, it, expect } from 'vitest';
import {
  validateSubmissionWithAI,
  openAIValidateSubmission,
  mockValidateSubmission,
} from '../../backend/services/aiValidationService';

// OFFLINE tests: no OPENAI_API_KEY / OPENAI_VALIDATION_PROVIDER set, so the
// OpenAI path must fall back safely without any network call.

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
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('mockValidateSubmission alias returns a mock result', async () => {
    const result = await mockValidateSubmission(input);
    expect(result.source).toBe('mock');
  });

  it('openAI provider without API key falls back safely (no throw, no network)', async () => {
    const result = await openAIValidateSubmission(input);
    expect(result.source).toBe('mock_fallback');
    expect(typeof result.valid).toBe('boolean');
    expect(typeof result.suggestedTeacherReview).toBe('boolean');
  });

  it('result always has the required shape regardless of provider', async () => {
    const result = await validateSubmissionWithAI(input, {
      rubric: [{ id: 'relevance', label: 'Relevantnosť', description: '...' }],
      targetCompetencies: ['maker_venture'],
    });
    for (const key of ['valid', 'score', 'confidence', 'reasons', 'detectedCompetencies', 'suggestedTeacherReview', 'model', 'source']) {
      expect(result).toHaveProperty(key);
    }
  });

  it('source is never "anthropic" anymore', async () => {
    const result = await validateSubmissionWithAI(input);
    expect(result.source).not.toBe('anthropic');
  });
});
