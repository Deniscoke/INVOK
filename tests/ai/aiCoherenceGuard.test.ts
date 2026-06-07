import { describe, it, expect } from 'vitest';
import { validateSubmission } from '../../backend/services/aiValidationService';

const PROBLEM_RUBRIC = [
  { id: 'clarity', label: 'Jasnosť problému', description: '...' },
  { id: 'specificity', label: 'Konkrétnosť', description: '...' },
  { id: 'evidence', label: 'Dôkaz / pozorovanie', description: '...' },
  { id: 'impact', label: 'Koho sa týka', description: '...' },
  { id: 'feasibility', label: 'Prvý návrh', description: '...' },
];

/**
 * The mock validator must reject obvious gibberish even when the submission
 * is wrapped in our structured field labels (which contain rubric keywords).
 * This guards against students earning XP by pasting random characters into
 * every field.
 */
describe('aiValidationService – gibberish guard', () => {
  it('rejects asdasd-style input wrapped in field labels', async () => {
    const result = await validateSubmission(
      {
        missionId: 'map_school_problem',
        studentResponse: [
          'Problém: asdasdasdasdasd',
          'Koho sa týka: asdasdasdasdasdasd',
          'Čo som si všimol: asdasdasdasdasdasdasd',
          'Dôkaz alebo pozorovanie: asdasdasdadaasdasdasd',
          'Prvý nápad na riešenie: asdasdasdasdasdasdsad',
        ].join('\n'),
        evidenceText: 'asdasdasdadaasdasdasd',
        evidenceType: 'text',
      },
      { rubric: PROBLEM_RUBRIC, targetCompetencies: ['fact_detective', 'maker_venture'] },
    );

    expect(result.valid).toBe(false);
    expect(result.score).toBeLessThan(25);
    expect(result.suggestedTeacherReview).toBe(true);
    expect(result.detectedCompetencies).toHaveLength(0);
  });

  it('rejects pure repetition', async () => {
    const result = await validateSubmission({
      missionId: 'map_school_problem',
      studentResponse: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      evidenceText: 'aaaaaaaaaaaaaa',
      evidenceType: 'text',
    });
    expect(result.valid).toBe(false);
    expect(result.suggestedTeacherReview).toBe(true);
  });

  it('rejects all-consonant keyboard mash', async () => {
    const result = await validateSubmission({
      missionId: 'map_school_problem',
      studentResponse: 'qwrtpsdfghjklzxcvbnm qwrtpsdfghjklzxcvbnm qwrtpsdfghjklzxcvbnm',
      evidenceText: 'qwrtpsdfghjkl',
      evidenceType: 'text',
    });
    expect(result.valid).toBe(false);
  });

  it('accepts a real Slovak problem proposal', async () => {
    const result = await validateSubmission(
      {
        missionId: 'map_school_problem',
        studentResponse: [
          'Problém: V škole nemáme koše na triedenie odpadu na chodbách.',
          'Koho sa týka: žiakov 2. stupňa a učiteľov',
          'Čo som si všimol: všimol som si, že spolužiaci hádžu plast aj papier do jedného koša.',
          'Dôkaz alebo pozorovanie: tri dni som pozoroval situáciu počas prestávok, nikto neseparoval.',
          'Prvý nápad na riešenie: navrhujem osloviť vedenie školy a spolu so školníkom vyrobiť koše.',
        ].join('\n'),
        evidenceText: 'tri dni som pozoroval situáciu počas prestávok, nikto neseparoval odpad.',
        evidenceType: 'text',
      },
      { rubric: PROBLEM_RUBRIC, targetCompetencies: ['fact_detective', 'community_hero'] },
    );

    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.detectedCompetencies.length).toBeGreaterThan(0);
  });

  it('does not reward submissions that are just our own labels', async () => {
    const result = await validateSubmission(
      {
        missionId: 'map_school_problem',
        studentResponse: [
          'Problém:',
          'Koho sa týka:',
          'Čo som si všimol:',
          'Dôkaz alebo pozorovanie:',
          'Prvý nápad na riešenie:',
        ].join('\n'),
        evidenceText: '',
        evidenceType: 'text',
      },
      { rubric: PROBLEM_RUBRIC },
    );

    expect(result.valid).toBe(false);
    expect(result.score).toBeLessThan(30);
  });
});
