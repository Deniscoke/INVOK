/**
 * Client-side demo submission + mock AI evaluation.
 *
 * Used when /api/* is unavailable (plain `npm run dev`) or the network fails.
 * Mirrors the server mock scorer closely enough for pilot demos — never sends
 * data off-device.
 */
import type { SubmissionKind, SubmissionPayload, SubmissionResult, AiEvaluation } from './submissionApi';
import { getMissions } from './mockDataService';
import { getSnapshot } from './authService';

const DEMO_SUBMISSIONS_KEY = 'invok_demo_submissions';

const EVIDENCE_KEYWORDS = ['lebo', 'pretože', 'zdroj', 'dôkaz', 'zistil', 'všimol', 'údaj', 'data', 'videl', 'počul', 'foto', 'obrázok'];
const SOLUTION_KEYWORDS = ['riešenie', 'navrhujem', 'zlepšiť', 'krok', 'plán', 'vyriešiť', 'zmeniť', 'idea', 'nápad'];
const REFLECTION_KEYWORDS = ['naučil', 'nabudúce', 'cieľ', 'zlepším', 'uvedomil', 'skúsim', 'podarilo', 'ťažké'];
const PROBLEM_KEYWORDS = ['problém', 'chyba', 'zlé', 'chýba', 'nedostatok', 'trápi', 'sťažuje', 'bráni'];
const CLARITY_KEYWORDS = ['pretože', 'teda', 'napríklad', 'konkrétne', 'znamená', 'čiže', 'tým', 'takto'];
const COMMUNITY_KEYWORDS = ['škola', 'trieda', 'spolužiaci', 'učiteľ', 'komunita', 'okolie', 'ľudia'];

const PROBLEM_RUBRIC = [
  { id: 'clarity', label: 'Jasnosť problému', description: 'Problém je jasne pomenovaný.' },
  { id: 'specificity', label: 'Konkrétnosť', description: 'Problém je konkrétny, nie všeobecný.' },
  { id: 'evidence', label: 'Dôkaz / pozorovanie', description: 'Žiak doložil pozorovanie alebo dôkaz.' },
  { id: 'impact', label: 'Koho sa týka', description: 'Je jasné, koho problém ovplyvňuje.' },
  { id: 'feasibility', label: 'Prvý návrh', description: 'Prvý nápad riešenia je realizovateľný.' },
  { id: 'value', label: 'Dopad na komunitu', description: 'Riešenie by prinieslo hodnotu triede alebo škole.' },
  { id: 'first_step', label: 'Všímavosť', description: 'Žiak si všimol niečo zmysluplné.' },
];

function countKeywords(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.reduce((n, word) => (lower.includes(word) ? n + 1 : n), 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function problemProposalXp(baseXp: number, qualityScore: number): number {
  const score = Math.min(100, Math.max(0, qualityScore));
  return Math.round(Math.max(0, baseXp) * (0.1 + 0.3 * (score / 100)));
}

function mockEvaluate(
  studentResponse: string,
  evidenceText: string,
  rubric: { id: string; label: string; description: string }[],
): AiEvaluation {
  const combined = `${studentResponse}\n${evidenceText}`;
  const length = studentResponse.trim().length;
  const evidenceSignals = countKeywords(combined, EVIDENCE_KEYWORDS);
  const solutionSignals = countKeywords(combined, SOLUTION_KEYWORDS);
  const reflectionSignals = countKeywords(combined, REFLECTION_KEYWORDS);
  const problemSignals = countKeywords(combined, PROBLEM_KEYWORDS);
  const totalSignals = evidenceSignals + solutionSignals + reflectionSignals + problemSignals;

  let rubricBonus = 0;
  for (const criterion of rubric) {
    const keywords =
      criterion.id === 'evidence' ? EVIDENCE_KEYWORDS
      : criterion.id === 'impact' || criterion.id === 'value' ? COMMUNITY_KEYWORDS
      : criterion.id === 'first_step' || criterion.id === 'feasibility' ? SOLUTION_KEYWORDS
      : criterion.id === 'clarity' || criterion.id === 'specificity' ? CLARITY_KEYWORDS
      : CLARITY_KEYWORDS;
    if (countKeywords(combined, keywords) >= 1) rubricBonus += 5;
  }

  const lengthScore = clamp(length / 8, 0, 50);
  const signalScore = clamp(totalSignals * 7, 0, 35);
  const score = Math.round(clamp(lengthScore + signalScore + rubricBonus, 0, 100));
  const confidence = Math.round(clamp(0.28 + length / 1400 + totalSignals * 0.05, 0.28, 0.92) * 100) / 100;
  const hasEvidence = evidenceText.trim().length > 0;
  const valid = score >= 45 && length >= 30;
  const suggestedTeacherReview = !valid || confidence < 0.75 || !hasEvidence;

  const reasons = rubric.map((criterion) => {
    const keywords =
      criterion.id === 'evidence' ? EVIDENCE_KEYWORDS
      : criterion.id === 'impact' || criterion.id === 'value' ? COMMUNITY_KEYWORDS
      : SOLUTION_KEYWORDS;
    const hits = countKeywords(combined, keywords);
    const met = hits >= 2 && score >= 55;
    const partial = hits >= 1 || score >= 40;
    return {
      criterion: criterion.label,
      result: met ? 'met' : partial ? 'partial' : 'unmet',
      explanation: met
        ? `Odovzdanie napĺňa kritérium „${criterion.label}".`
        : partial
          ? `Kritérium „${criterion.label}" je naznačené — dôkazy môžu byť silnejšie.`
          : `Pre kritérium „${criterion.label}" chýba dostatočný dôkaz.`,
    };
  });

  const targetIds = rubric.length > 3
    ? ['fact_detective', 'maker_venture', 'community_hero']
    : ['maker_venture', 'self_captain'];
  const detectedCompetencies = targetIds.map((id, index) => ({
    id,
    strength: clamp(0.35 + score / 200 + index * 0.05, 0.2, 0.95),
  }));

  return {
    valid,
    score,
    confidence,
    reasons,
    detectedCompetencies,
    suggestedTeacherReview,
    model: 'demo-formative-validator-v1',
  };
}

function saveDemoSubmission(record: Record<string, unknown>): void {
  try {
    const existing = JSON.parse(localStorage.getItem(DEMO_SUBMISSIONS_KEY) ?? '[]') as Record<string, unknown>[];
    existing.unshift(record);
    localStorage.setItem(DEMO_SUBMISSIONS_KEY, JSON.stringify(existing.slice(0, 50)));
  } catch {
    // ignore quota / parse errors in demo
  }
}

export function submitDemo(payload: SubmissionPayload): SubmissionResult {
  const mission = getMissions().find((m) => m.id === payload.missionId);
  const isProposal = payload.submissionKind === 'problem_proposal';
  const rubric = isProposal ? PROBLEM_RUBRIC : (mission?.rubric ?? []);
  const evaluation = mockEvaluate(payload.studentResponse, payload.evidenceText, rubric);
  const baseXp = mission?.baseXp ?? 100;
  const xpAwarded = isProposal
    ? problemProposalXp(baseXp, evaluation.score)
    : evaluation.valid
      ? Math.floor(baseXp * (evaluation.score / 100) * 0.8)
      : 0;
  const submissionId = `demo-${Date.now()}`;
  const alias = getSnapshot().user?.displayName ?? 'Demo žiak';

  saveDemoSubmission({
    id: submissionId,
    missionId: payload.missionId,
    submissionKind: payload.submissionKind ?? 'solution_submission',
    studentResponse: payload.studentResponse,
    evidenceText: payload.evidenceText,
    pseudonym: alias,
    xpAwarded,
    evaluation,
    createdAt: new Date().toISOString(),
  });

  return {
    ok: true,
    submissionId,
    xpAwarded,
    kind: (payload.submissionKind ?? 'solution_submission') as SubmissionKind,
    provisional: isProposal,
    evaluation,
    source: 'mock',
  };
}
