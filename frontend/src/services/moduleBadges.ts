/**
 * INVOK module badges — the four collectible achievements from the program spec
 * (Lovec hoaxov · Inovátor školy · Tímový stratég · Mladý rečník), one per module.
 *
 * A badge unlocks from REAL measured progress: the mapped competency must reach a
 * 1–5 level threshold (mastery comes from AI-evaluated, teacher-confirmed
 * submissions). Until then it shows locked, with a clear "how to unlock" hint.
 * This is purely derived data — it changes nothing in the existing badge/quest
 * systems and is safe to extend (e.g. quest→module tagging) later.
 */
import { strengthToLevel } from './competencyScale';

export interface ModuleBadge {
  id: string;
  name: string;
  emoji: string;
  /** Program module this badge belongs to. */
  module: string;
  /** Competency whose 1–5 level gates the badge. */
  competencyId: string;
  /** Level (1–5) required to unlock. */
  unlockLevel: number;
  /** Child-friendly explanation of how to earn it. */
  unlockHint: string;
}

export const MODULE_BADGES: readonly ModuleBadge[] = [
  {
    id: 'lovec_hoaxov',
    name: 'Lovec hoaxov',
    emoji: '\u{1F50D}',
    module: 'Kritické a mediálne myslenie',
    competencyId: 'fact_detective',
    unlockLevel: 3,
    unlockHint: 'Overuj zdroje a rozpoznaj manipuláciu — dosiahni úroveň 3/5 v Detektívovi faktov.',
  },
  {
    id: 'inovator_skoly',
    name: 'Inovátor školy',
    emoji: '\u{1F4A1}',
    module: 'Podnikavosť a inovácie',
    competencyId: 'maker_venture',
    unlockLevel: 3,
    unlockHint: 'Premeň nápad na konkrétne riešenie — dosiahni úroveň 3/5 v Tvorcovi riešení.',
  },
  {
    id: 'timovy_strateg',
    name: 'Tímový stratég',
    emoji: '\u{1F91D}',
    module: 'Tímová spolupráca',
    competencyId: 'team_builder',
    unlockLevel: 3,
    unlockHint: 'Spolupracuj a dodrž dohody — dosiahni úroveň 3/5 v Staviteľovi tímu.',
  },
  {
    id: 'mlady_recnik',
    name: 'Mladý rečník',
    emoji: '\u{1F3A4}',
    module: 'Komunikácia a prezentácia',
    competencyId: 'digital_navigator',
    unlockLevel: 3,
    unlockHint: 'Zrozumiteľne odprezentuj svoj výstup — dosiahni úroveň 3/5 v Digitálnom navigátorovi.',
  },
];

export interface BadgeProgressInput {
  competencyProgress: { competencyId: string; mastery: number }[];
}

export interface ModuleBadgeState {
  badge: ModuleBadge;
  earned: boolean;
  /** Current 1–5 level (0 = competency not started yet). */
  level: number;
}

/** Resolve earned/locked state for every module badge from live progress. */
export function computeModuleBadges(progress: BadgeProgressInput): ModuleBadgeState[] {
  return MODULE_BADGES.map((badge) => {
    const cp = progress.competencyProgress.find((p) => p.competencyId === badge.competencyId);
    const level = cp ? strengthToLevel(cp.mastery) : 0;
    return { badge, earned: level >= badge.unlockLevel, level };
  });
}

/** How many module badges are currently earned. */
export function earnedBadgeCount(progress: BadgeProgressInput): number {
  return computeModuleBadges(progress).filter((s) => s.earned).length;
}
