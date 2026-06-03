import { describe, it, expect } from 'vitest';
import { validateSubmission } from '../../backend/services/aiValidationService';

describe('aiValidationService (mock)', () => {
  it('returns a well-formed, explainable result for a strong submission', async () => {
    const result = await validateSubmission(
      {
        missionId: 'design_solution',
        studentResponse:
          'Navrhujem riešenie na dlhé rady v jedálni, pretože som si všimol problém. ' +
          'Prvý krok je rozdeliť príchod tried podľa rozvrhu, lebo to skráti čakanie.',
        evidenceText: 'Zdroj: tri dni som zapisoval dôkaz – čas čakania v rade.',
        evidenceType: 'text',
      },
      {
        rubric: [
          { id: 'relevance', label: 'Relevantnosť', description: '...' },
          { id: 'feasibility', label: 'Realizovateľnosť', description: '...' },
          { id: 'first_step', label: 'Prvý krok', description: '...' },
        ],
        targetCompetencies: ['maker_venture', 'self_captain'],
      },
    );

    expect(typeof result.valid).toBe('boolean');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);

    expect(result.reasons).toHaveLength(3);
    for (const reason of result.reasons) {
      expect(typeof reason.criterion).toBe('string');
      expect(['met', 'partial', 'unmet']).toContain(reason.result);
      expect(typeof reason.explanation).toBe('string');
    }

    expect(result.detectedCompetencies).toHaveLength(2);
    for (const detected of result.detectedCompetencies) {
      expect(typeof detected.id).toBe('string');
      expect(detected.strength).toBeGreaterThanOrEqual(0);
      expect(detected.strength).toBeLessThanOrEqual(1);
    }

    expect(typeof result.suggestedTeacherReview).toBe('boolean');
    expect(typeof result.model).toBe('string');
  });

  it('flags weak submissions as invalid and for teacher review', async () => {
    const result = await validateSubmission({
      missionId: 'design_solution',
      studentResponse: 'Neviem.',
      evidenceText: '',
      evidenceType: 'text',
    });

    expect(result.valid).toBe(false);
    expect(result.suggestedTeacherReview).toBe(true);
  });
});
