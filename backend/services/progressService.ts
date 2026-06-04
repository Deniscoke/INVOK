/**
 * Progression math: XP → level, mastery and reward application.
 *
 * Leveling curve (transparent + integer friendly):
 *   cumulative XP needed to REACH level L  =  100 * (L - 1)^2
 *   → L1: 0, L2: 100, L3: 400, L4: 900, L5: 1600, L6: 2500 ...
 *
 * Rationale: an accelerating curve keeps early wins frequent (motivation for
 * younger pupils) while making higher levels feel earned. XP is tied to
 * quality, not mere completion — see docs/GAMIFICATION_MODEL.md.
 */

export interface CompetencyProgress {
  competencyId: string;
  xp: number;
  level: number;
  mastery: number; // 0..1
}

export interface LevelProgress {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  xpIntoLevel: number;
  xpForSpan: number;
  ratio: number; // 0..1 progress towards next level
}

/** Cumulative XP required to reach a given level (level >= 1). */
export function xpForLevel(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  return 100 * (safeLevel - 1) ** 2;
}

/** Level reached for a given total XP. */
export function levelForXp(xp: number): number {
  if (xp <= 0) return 1;
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

/** Detailed progress towards the next level, for progress bars. */
export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const xpForSpan = nextLevelXp - currentLevelXp;
  const xpIntoLevel = xp - currentLevelXp;
  return {
    level,
    currentLevelXp,
    nextLevelXp,
    xpIntoLevel,
    xpForSpan,
    ratio: xpForSpan > 0 ? Math.min(1, xpIntoLevel / xpForSpan) : 0,
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export type ReviewDecisionKind = 'approved' | 'adjusted' | 'needs_revision' | 'rejected';

/**
 * Final XP committed after a teacher review.
 *  - approved / adjusted → XP scaled by the final (teacher-confirmed) score
 *  - needs_revision / rejected → no XP (student keeps the chance to improve)
 *
 * This is intentionally simple and auditable: XP is always traceable to a
 * teacher decision + a final score.
 */
export function finalXpForReview(baseXp: number, finalScore: number, decision: ReviewDecisionKind): number {
  if (decision === 'approved' || decision === 'adjusted') {
    const score = Math.min(100, Math.max(0, finalScore));
    return Math.round(Math.max(0, baseXp) * (score / 100));
  }
  return 0;
}

/**
 * Apply earned XP to a competency progress record, recomputing the level.
 * `masteryDelta` nudges the mastery estimate (clamped to [0,1]); mastery is a
 * formative signal, not a grade.
 */
export function applyXp(
  progress: CompetencyProgress,
  earnedXp: number,
  masteryDelta = 0,
): CompetencyProgress {
  const xp = Math.max(0, progress.xp + Math.max(0, earnedXp));
  return {
    competencyId: progress.competencyId,
    xp,
    level: levelForXp(xp),
    mastery: clamp01(progress.mastery + masteryDelta),
  };
}
