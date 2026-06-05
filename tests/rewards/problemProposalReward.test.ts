import { describe, it, expect } from 'vitest';
import { problemProposalXp } from '../../backend/services/progressService';
import { scoreProblemProposal } from '../../backend/services/problemProposalService';

describe('problemProposalXp (10–40% reward rule)', () => {
  it('gives 10% at score 0 and 40% at score 100', () => {
    expect(problemProposalXp(100, 0)).toBe(10);
    expect(problemProposalXp(100, 100)).toBe(40);
  });

  it('scales linearly in between', () => {
    expect(problemProposalXp(100, 50)).toBe(25);
    expect(problemProposalXp(200, 50)).toBe(50);
  });

  it('clamps the quality score to 0..100', () => {
    expect(problemProposalXp(100, 500)).toBe(40);
    expect(problemProposalXp(100, -50)).toBe(10);
  });
});

const strong = {
  missionId: 'map_school_problem',
  studentResponse:
    'Problém: dlhé rady v jedálni. Koho sa týka: žiakov 2. stupňa. Čo som si všimol: pretože ' +
    'som tri dni meral čas čakania a videl konkrétne, že rady sú dlhé. Dôkaz: zapisoval som údaje. ' +
    'Prvý nápad: navrhujem rozdeliť príchod tried, lebo to skráti čakanie pre celú školu.',
  evidenceText: 'Tri dni som meral čas čakania a mám zapísané údaje ako dôkaz.',
  evidenceType: 'text' as const,
};

const vague = {
  missionId: 'map_school_problem',
  studentResponse: 'Nieco je zle a nepáči sa mi to.',
  evidenceText: '',
  evidenceType: 'text' as const,
};

describe('scoreProblemProposal (offline mock)', () => {
  it('rewards a quality, evidence-backed proposal with provisional XP', async () => {
    const result = await scoreProblemProposal(strong);
    expect(result.evaluation.source).toBe('mock');
    expect(result.qualityScore).toBeGreaterThan(0);
    expect(result.provisionalXp).toBeGreaterThan(0);
  });

  it('scores a vague proposal lower than a quality one', async () => {
    const strongScore = await scoreProblemProposal(strong);
    const vagueScore = await scoreProblemProposal(vague);
    expect(strongScore.qualityScore).toBeGreaterThan(vagueScore.qualityScore);
    expect(strongScore.provisionalXp).toBeGreaterThan(vagueScore.provisionalXp);
  });

  it('flags a proposal without evidence for teacher review', async () => {
    const result = await scoreProblemProposal(vague);
    expect(result.evaluation.suggestedTeacherReview).toBe(true);
  });
});
