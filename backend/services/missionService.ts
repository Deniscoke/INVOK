/**
 * Mission / competency / badge catalog access.
 *
 * Reads the curated JSON catalog under `data/`. In a later phase these will be
 * served from Supabase, but the service interface stays the same so callers
 * (API routes) do not change.
 */
// Node 22 ESM requires explicit `with { type: 'json' }` import attributes
// for JSON modules. Without them the function crashes at load time on
// Vercel (which runs @vercel/node@3 under Node 22 ESM).
import competenciesData from '../../data/competencies.json' with { type: 'json' };
import missionsData from '../../data/missions.json' with { type: 'json' };
import badgesData from '../../data/badges.json' with { type: 'json' };

export interface CompetencyMapping {
  framework: string;
  area: string;
  note: string;
}

export interface Competency {
  id: string;
  childName: string;
  childDescription: string;
  teacherDescription: string;
  curriculumMapping: CompetencyMapping;
  measurementExamples: string[];
  icon: string;
}

export interface RubricCriterion {
  id: string;
  label: string;
  description: string;
}

export interface Mission {
  id: string;
  title: string;
  story: string;
  goal: string;
  evidenceRequired: { description: string; acceptedTypes: string[] };
  targetCompetencies: string[];
  rubric: RubricCriterion[];
  baseXp: number;
  difficulty: 'easy' | 'medium' | 'hard';
  suggestedMode: 'individual' | 'team';
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  criteria: string;
  relatedCompetency: string | null;
}

const competencies = competenciesData as unknown as Competency[];
const missions = missionsData as unknown as Mission[];
const badges = badgesData as unknown as Badge[];

export function getCompetencies(): Competency[] {
  return competencies;
}

export function getMissions(): Mission[] {
  return missions;
}

export function getMissionById(id: string): Mission | undefined {
  return missions.find((mission) => mission.id === id);
}

export function getBadges(): Badge[] {
  return badges;
}
