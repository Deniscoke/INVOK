/**
 * Client-side demo submission + mock AI evaluation.
 *
 * Used when /api/* is unavailable (plain `npm run dev`) or the network fails.
 *
 * Scoring is intentionally formative but STRICT enough to reject obvious
 * gibberish ("asdasdasd"), pure repetition, and copy-pasted form labels.
 * Concretely it:
 *   1. Strips the structured field labels we inject in the payload so the
 *      keyword counter cannot reward students for them.
 *   2. Runs a coherence/gibberish detector (vocabulary diversity, vowel
 *      ratio, character repetition).
 *   3. Hard-caps the score and forces teacher review when coherence fails.
 */
import type { PhotoEvidence, SubmissionKind, SubmissionPayload, SubmissionResult, AiEvaluation } from './submissionApi';
import { getMissions } from './mockDataService';
import { getSnapshot } from './authService';

const DEMO_SUBMISSIONS_KEY = 'invok_demo_submissions';

const EVIDENCE_KEYWORDS = ['lebo', 'pretože', 'zdroj', 'zistil', 'údaj', 'data', 'videl', 'počul', 'meral', 'pozoroval', 'spýtal'];
const SOLUTION_KEYWORDS = ['navrhujem', 'zlepšiť', 'plán', 'vyriešiť', 'zmeniť', 'urobiť', 'pomôcť', 'zaviesť'];
const REFLECTION_KEYWORDS = ['naučil', 'nabudúce', 'cieľ', 'zlepším', 'uvedomil', 'skúsim', 'podarilo', 'ťažké'];
const PROBLEM_KEYWORDS = ['chyba', 'zlé', 'chýba', 'nedostatok', 'trápi', 'sťažuje', 'bráni', 'málo', 'veľa'];
const CLARITY_KEYWORDS = ['teda', 'napríklad', 'konkrétne', 'znamená', 'čiže', 'takto'];
const COMMUNITY_KEYWORDS = ['škola', 'trieda', 'spolužiaci', 'učiteľ', 'komunita', 'okolie', 'ľudia', 'rodičia'];

const PROBLEM_RUBRIC = [
  { id: 'clarity', label: 'Jasnosť problému', description: 'Problém je jasne pomenovaný.' },
  { id: 'specificity', label: 'Konkrétnosť', description: 'Problém je konkrétny, nie všeobecný.' },
  { id: 'evidence', label: 'Dôkaz / pozorovanie', description: 'Žiak doložil pozorovanie alebo dôkaz.' },
  { id: 'impact', label: 'Koho sa týka', description: 'Je jasné, koho problém ovplyvňuje.' },
  { id: 'feasibility', label: 'Prvý návrh', description: 'Prvý nápad riešenia je realizovateľný.' },
  { id: 'value', label: 'Dopad na komunitu', description: 'Riešenie by prinieslo hodnotu triede alebo škole.' },
  { id: 'first_step', label: 'Všímavosť', description: 'Žiak si všimol niečo zmysluplné.' },
];

/**
 * Strip the structured labels we add in submissionApi.ts so the scorer
 * cannot reward students for the keywords contained in label words like
 * "Problém:", "Dôkaz:", "Prvý nápad na riešenie:". Without this the form
 * itself would push every submission above the passing threshold.
 */
const LABEL_RE = /(^|\n)\s*(problém|koho sa týka|čo (?:som si|si si) všimol|dôkaz(?: alebo pozorovanie)?|prvý nápad(?: na riešenie)?|riešenie\s*\/\s*odpoveď|riešenie|prínos\s*\/\s*koho sa týka|prínos|prvý krok|foto dôkaz|popis fotky)\s*:[^\n]*/giu;

function stripLabels(text: string): string {
  return text
    .replace(LABEL_RE, (match) => {
      // Keep what comes after the colon — that's the actual student content.
      const colonIdx = match.indexOf(':');
      return colonIdx >= 0 ? '\n' + match.slice(colonIdx + 1) : '';
    })
    .replace(/[ \t]+/g, ' ')
    .trim();
}

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

export interface CoherenceCheck {
  coherent: boolean;
  reasons: string[];
}

/**
 * Detect inputs that are clearly not real Slovak (or any) writing:
 *   - too short
 *   - very few unique characters
 *   - repeated short pattern (asdasd, abcabc, qqqq)
 *   - vowel ratio outside the human-writing range
 *   - too few distinct words / words of unrealistic length
 *
 * Tuned to PASS short but real sentences ("Triedenie odpadu chýba na chodbe.")
 * while REJECTING strings like "asdasdasd" or "aaaaaaaa".
 */
export function checkCoherence(rawText: string): CoherenceCheck {
  const reasons: string[] = [];
  const text = rawText.trim();
  if (text.length < 15) reasons.push('Text je príliš krátky na zmysluplné vyhodnotenie.');

  const letters = text.toLowerCase().replace(/[^a-záäčďéíľĺňóôŕšťúýž]/g, '');
  if (letters.length >= 8) {
    const unique = new Set(letters).size;
    if (unique < 6) reasons.push('Príliš málo rôznych písmen — vyzerá to ako náhodné znaky.');

    // Repeated short pattern (asdasdasd, abab, qweqwe)
    for (let patternLen = 2; patternLen <= 4; patternLen++) {
      const pattern = letters.slice(0, patternLen);
      if (pattern.length < patternLen) continue;
      let i = 0;
      while (i + patternLen <= letters.length && letters.slice(i, i + patternLen) === pattern) i += patternLen;
      if (i >= letters.length * 0.6 && i >= patternLen * 3) {
        reasons.push('Text sa skladá z opakovaného vzoru znakov.');
        break;
      }
    }

    const vowels = (letters.match(/[aáäeéiíoóôuúyý]/g) ?? []).length;
    const vowelRatio = vowels / letters.length;
    if (vowelRatio < 0.18 || vowelRatio > 0.65) {
      reasons.push('Pomer samohlások a spoluhlások nezodpovedá bežnému jazyku.');
    }
  }

  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 3) {
    reasons.push('Príliš málo slov.');
  } else {
    const avgLen = words.reduce((s, w) => s + w.length, 0) / words.length;
    if (avgLen < 2.4) reasons.push('Priemerná dĺžka slova je príliš krátka.');
    if (avgLen > 14) reasons.push('Priemerná dĺžka slova je nereálne dlhá.');
    const uniqueWords = new Set(words).size;
    if (uniqueWords / words.length < 0.4 && words.length >= 5) {
      reasons.push('Slová sa opakujú — chýba pestrosť výpovede.');
    }
    const realWordLike = words.filter((w) => /[aeiouyáéíóúýäô]/i.test(w) && w.length >= 2).length;
    if (realWordLike / words.length < 0.5) {
      reasons.push('Väčšina slov nevyzerá ako reálne slová.');
    }
  }

  return { coherent: reasons.length === 0, reasons };
}

function mockEvaluate(
  studentResponse: string,
  evidenceText: string,
  rubric: { id: string; label: string; description: string }[],
  photo?: PhotoEvidence,
): AiEvaluation {
  // Look ONLY at what the student actually wrote — without our injected
  // section labels (which used to leak keywords like "problém", "dôkaz", …).
  const cleanResponse = stripLabels(studentResponse);
  const cleanEvidence = stripLabels(evidenceText);
  const combined = `${cleanResponse}\n${cleanEvidence}`;
  const length = cleanResponse.length;

  const coherence = checkCoherence(combined);

  // Hard-reject incoherent input regardless of length / accidental keywords.
  if (!coherence.coherent) {
    const failureReasons = rubric.map((criterion) => ({
      criterion: criterion.label,
      result: 'unmet' as const,
      explanation: `Vstup nedáva zmysel — kritérium „${criterion.label}" nemožno posúdiť.`,
    }));
    return {
      valid: false,
      score: Math.max(0, Math.min(15, Math.round(length / 30))),
      confidence: 0.32,
      reasons: [
        {
          criterion: 'Zrozumiteľnosť vstupu',
          result: 'unmet',
          explanation: coherence.reasons.join(' ') || 'Text nedáva zmysel.',
        },
        ...failureReasons,
      ],
      detectedCompetencies: [],
      suggestedTeacherReview: true,
      model: 'demo-formative-validator-v1',
    };
  }

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
    if (countKeywords(combined, keywords) >= 1) rubricBonus += 3;
  }

  // Photo only helps if the rest of the answer is at least minimally coherent.
  const photoBonus = photo
    ? (photo.caption && photo.caption.trim().length >= 5 ? 10 : 4)
    : 0;

  // Real Slovak text typically has avg word length 4–7 chars; reward that.
  const words = combined.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  const uniqueWordRatio = words.length ? new Set(words).size / words.length : 0;
  const vocabularyBonus = clamp((uniqueWordRatio - 0.5) * 30, 0, 15);

  // Length matters but is capped: 200+ chars of coherent text reaches the cap.
  const lengthScore = clamp(length / 10, 0, 35);
  const signalScore = clamp(totalSignals * 5, 0, 25);
  const rawScore = lengthScore + signalScore + rubricBonus + photoBonus + vocabularyBonus;
  const score = Math.round(clamp(rawScore, 0, 100));

  const confidence = Math.round(
    clamp(0.30 + length / 1600 + totalSignals * 0.04 + (photo ? 0.06 : 0) + uniqueWordRatio * 0.15, 0.30, 0.90) * 100,
  ) / 100;

  const hasEvidence = cleanEvidence.length >= 10 || Boolean(photo);
  // Pass criteria: coherent, substantial length, at least some signals.
  const valid = score >= 50 && length >= 40 && totalSignals >= 1 && hasEvidence;
  const suggestedTeacherReview = !valid || confidence < 0.78 || !hasEvidence || totalSignals < 2;

  const reasons = rubric.map((criterion) => {
    const keywords =
      criterion.id === 'evidence' ? EVIDENCE_KEYWORDS
      : criterion.id === 'impact' || criterion.id === 'value' ? COMMUNITY_KEYWORDS
      : criterion.id === 'first_step' || criterion.id === 'feasibility' ? SOLUTION_KEYWORDS
      : criterion.id === 'clarity' || criterion.id === 'specificity' ? CLARITY_KEYWORDS
      : SOLUTION_KEYWORDS;
    const hits = countKeywords(combined, keywords);
    const met = hits >= 2 && score >= 60 && valid;
    const partial = (hits >= 1 && score >= 45) || (score >= 55 && valid);
    return {
      criterion: criterion.label,
      result: met ? 'met' as const : partial ? 'partial' as const : 'unmet' as const,
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
  const detectedCompetencies = valid
    ? targetIds.map((id, index) => ({
        id,
        strength: clamp(0.35 + score / 200 + index * 0.05, 0.2, 0.95),
      }))
    : [];

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

export function submitDemo(payload: SubmissionPayload, photo?: PhotoEvidence): SubmissionResult {
  const mission = getMissions().find((m) => m.id === payload.missionId);
  const isProposal = payload.submissionKind === 'problem_proposal';
  const rubric = isProposal ? PROBLEM_RUBRIC : (mission?.rubric ?? []);
  const evaluation = mockEvaluate(payload.studentResponse, payload.evidenceText, rubric, photo);
  const baseXp = mission?.baseXp ?? 100;
  const xpAwarded = !evaluation.valid
    ? 0
    : isProposal
      ? problemProposalXp(baseXp, evaluation.score)
      : Math.floor(baseXp * (evaluation.score / 100) * 0.8);
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
    photo: photo ? {
      fileName: photo.fileName,
      mimeType: photo.mimeType,
      sizeBytes: photo.sizeBytes,
      caption: photo.caption,
    } : null,
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
