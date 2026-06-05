/**
 * Problem proposal scoring (SERVER-ONLY).
 *
 * Entrepreneurship is a PROCESS: noticing a problem, naming it, saying who it
 * affects, bringing evidence, and proposing a first direction. A quality
 * proposal earns a PROVISIONAL reward (10–40% of mission XP) even before the
 * full mission is solved. Final XP is still gated by a teacher review.
 *
 * The rubric rewards evidence, observation and specificity — NOT made-up
 * problems. Weak/vague proposals score low and flag teacher review.
 *
 * Do NOT import from frontend code.
 */
import type { SubmissionInput } from '../validators/submissionValidator';
import type { AIValidationResult } from './aiValidationService';
import { validateSubmissionWithAI } from './aiValidationService';
import { getMissionById } from './missionService';
import { problemProposalXp } from './progressService';

/** Competencies typically developed by naming/mapping a problem. */
export const PROBLEM_COMPETENCIES = ['fact_detective', 'maker_venture', 'community_hero'];

/** Rubric for evaluating a problem proposal (criterion ids drive mock scoring). */
export const PROBLEM_RUBRIC = [
  { id: 'clarity', label: 'Jasnosť problému', description: 'Problém je jasne pomenovaný.' },
  { id: 'specificity', label: 'Konkrétnosť', description: 'Problém je konkrétny, nie všeobecný.' },
  { id: 'evidence', label: 'Dôkaz / pozorovanie', description: 'Žiak doložil pozorovanie alebo dôkaz.' },
  { id: 'impact', label: 'Koho sa týka', description: 'Je jasné, koho problém ovplyvňuje.' },
  { id: 'feasibility', label: 'Prvý návrh', description: 'Prvý nápad riešenia je realizovateľný.' },
  { id: 'value', label: 'Dopad na komunitu', description: 'Riešenie by prinieslo hodnotu triede alebo škole.' },
  { id: 'first_step', label: 'Všímavosť', description: 'Žiak si všimol niečo zmysluplné.' },
];

export interface ProblemProposalScore {
  evaluation: AIValidationResult;
  qualityScore: number;
  provisionalXp: number;
}

/**
 * Score a problem proposal against the problem rubric and compute its
 * provisional reward XP (10–40% of mission base XP, scaled by quality).
 */
export async function scoreProblemProposal(input: SubmissionInput): Promise<ProblemProposalScore> {
  const mission = getMissionById(input.missionId);
  // Score the full proposal text as submitted (do not overwrite with evidence).
  const evaluation = await validateSubmissionWithAI(input, {
    rubric: PROBLEM_RUBRIC,
    targetCompetencies: PROBLEM_COMPETENCIES,
  });
  const qualityScore = evaluation.score;
  const provisionalXp = problemProposalXp(mission?.baseXp ?? 100, qualityScore);
  return { evaluation, qualityScore, provisionalXp };
}
