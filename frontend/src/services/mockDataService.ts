/**
 * Frontend mock data service.
 *
 * Reads the curated JSON catalog + a pseudonymous demo seed. This keeps the UI
 * runnable with zero backend during the MVP. The frontend deliberately has its
 * OWN types (decoupled from the server) so it never imports server-only code.
 */
import competenciesData from '../../../data/competencies.json';
import missionsData from '../../../data/missions.json';
import badgesData from '../../../data/badges.json';
import seedData from '../../../data/seed.json';

export interface Competency {
  id: string;
  childName: string;
  childDescription: string;
  teacherDescription: string;
  curriculumMapping: { framework: string; area: string; note: string };
  measurementExamples: string[];
  icon: string;
}

export interface Mission {
  id: string;
  title: string;
  story: string;
  goal: string;
  evidenceRequired: { description: string; acceptedTypes: string[] };
  targetCompetencies: string[];
  rubric: { id: string; label: string; description: string }[];
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

export interface CompetencyProgress {
  competencyId: string;
  xp: number;
  level: number;
  mastery: number;
}

export interface StudentProfile {
  alias: string;
  avatar: string;
  level: number;
  totalXp: number;
  nextLevelXp: number;
  earnedBadgeIds: string[];
  competencyProgress: CompetencyProgress[];
  activeMissionIds: string[];
}

export interface ClassStudent {
  alias: string;
  level: number;
  openMissions: number;
}

export interface CompetencyCoverage {
  competencyId: string;
  classMastery: number;
}

export interface ClassOverview {
  name: string;
  grade: number;
  studentCount: number;
  activeMissionCount: number;
  pendingReviewCount: number;
  averageAiConfidence: number;
  students: ClassStudent[];
  competencyCoverage: CompetencyCoverage[];
}

export interface PendingReview {
  submissionId: string;
  studentAlias: string;
  missionId: string;
  aiValid: boolean;
  aiScore: number;
  aiConfidence: number;
  suggestedTeacherReview: boolean;
}

interface SeedShape {
  demoStudent: StudentProfile;
  demoClass: ClassOverview;
  demoPendingReviews: PendingReview[];
}

const competencies = competenciesData as unknown as Competency[];
const missions = missionsData as unknown as Mission[];
const badges = badgesData as unknown as Badge[];
const seed = seedData as unknown as SeedShape;

export function getCompetencies(): Competency[] {
  return competencies;
}

export function getCompetencyById(id: string): Competency | undefined {
  return competencies.find((competency) => competency.id === id);
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

export function getStudent(): StudentProfile {
  return seed.demoStudent;
}

export function getActiveMissions(student: StudentProfile = getStudent()): Mission[] {
  return student.activeMissionIds
    .map((id) => getMissionById(id))
    .filter((mission): mission is Mission => mission !== undefined);
}

export function getClassOverview(): ClassOverview {
  return seed.demoClass;
}

export function getPendingReviews(): PendingReview[] {
  return seed.demoPendingReviews;
}
