import { describe, it, expect } from 'vitest';
import { validateSubmission } from '../../backend/services/aiValidationService';

const rubric = [
  { id: 'clarity', label: 'Jasnosť', description: 'Problém je jasne pomenovaný.' },
  { id: 'evidence', label: 'Dôkazy', description: 'Tvrdenie je podložené dôkazom.' },
  { id: 'first_step', label: 'Prvý krok', description: 'Je opísaný prvý krok.' },
];

describe('aiValidationWorkflow', () => {
  it('returns valid shape for a strong submission', async () => {
    const result = await validateSubmission(
      {
        missionId: 'design_solution',
        studentResponse:
          'Navrhujem riešenie na plytvanie papierom, pretože som zistil, že triedy vyhodia veľa papiera každý týždeň. Prvý krok je vytlačiť menej, krok za krokom.',
        evidenceText: 'Zdroj: vlastné pozorovanie 5 dní, počítal som zošity v koši.',
        evidenceType: 'text',
      },
      { rubric, targetCompetencies: ['maker_venture', 'fact_detective'] },
    );

    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThan(50);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.reasons).toHaveLength(rubric.length);
    for (const reason of result.reasons) {
      expect(['met', 'partial', 'unmet']).toContain(reason.result);
      expect(typeof reason.explanation).toBe('string');
    }
    expect(result.detectedCompetencies).toHaveLength(2);
    expect(typeof result.suggestedTeacherReview).toBe('boolean');
    expect(result.model).toBeTruthy();
  });

  it('flags short weak submission as invalid with teacher review', async () => {
    const result = await validateSubmission({
      missionId: 'design_solution',
      studentResponse: 'Neviem čo napísať.',
      evidenceText: '',
      evidenceType: 'text',
    });
    expect(result.valid).toBe(false);
    expect(result.suggestedTeacherReview).toBe(true);
  });

  it('confidence is capped below 1 (never appears certain)', async () => {
    const result = await validateSubmission({
      missionId: 'map_school_problem',
      studentResponse: 'x'.repeat(500),
      evidenceText: 'dôkaz evidence zdroj údaj pretože lebo',
      evidenceType: 'text',
    });
    expect(result.confidence).toBeLessThan(1);
    expect(result.confidence).toBeLessThanOrEqual(0.92);
  });

  it('returns reasons for every rubric criterion', async () => {
    const result = await validateSubmission(
      { missionId: 'reflect_growth', studentResponse: 'x'.repeat(40), evidenceText: '', evidenceType: 'text' },
      { rubric, targetCompetencies: [] },
    );
    expect(result.reasons).toHaveLength(rubric.length);
  });
});
