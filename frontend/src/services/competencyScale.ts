/**
 * INVOK competency scale — a single, research-friendly 1–5 level used everywhere
 * (student feedback, teacher review, later exports). Higher = stronger mastery.
 *
 * The labels are written to be understandable for BOTH the pupil and the teacher,
 * and map onto the INVOK competencies (detský názov) which themselves carry the
 * ŠVP ZV / RVP curriculum mapping (see data/competencies.json -> curriculum_*).
 *
 * 1 = začiatok · 2 = rozvíja sa · 3 = dobre · 4 = veľmi dobre · 5 = výborne
 */
import { getCompetencies } from './mockDataService';

export const LEVEL_LABELS: Record<number, string> = {
  1: 'začiatok',
  2: 'rozvíja sa',
  3: 'dobre',
  4: 'veľmi dobre',
  5: 'výborne',
};

export function clampLevel(level: number): number {
  return Math.max(1, Math.min(5, Math.round(level)));
}

/** Map an overall AI score (0–100) to a 1–5 level. */
export function scoreToLevel(score0to100: number): number {
  return clampLevel(score0to100 / 20);
}

/** Map a per-competency AI strength (0–1) to a 1–5 level. */
export function strengthToLevel(strength0to1: number): number {
  return clampLevel(1 + strength0to1 * 4);
}

export function levelLabel(level: number): string {
  return LEVEL_LABELS[clampLevel(level)] ?? '';
}

/** Child-facing competency name (e.g. "Detektív faktov") for a competency id. */
export function competencyName(id: string): string {
  return getCompetencies().find((c) => c.id === id)?.childName ?? id;
}
