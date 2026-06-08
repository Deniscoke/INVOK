/**
 * Student quest store (frontend).
 *
 * v1: localStorage-backed CRUD scoped per pseudonymous student. The shape
 * mirrors what the future Supabase `student_quests` table will use so that
 * swapping in the API only changes the data source, not the call sites.
 *
 * State machine:
 *   draft ──────────► pending_approval ──┬──► approved ──► submitted ──► completed
 *                                        ├──► changes_requested (back to draft)
 *                                        └──► rejected
 *
 * Limits:
 *   - Max 5 *active* quests per student (active = not completed / not rejected).
 *   - Student can delete own quests in draft / pending_approval / changes_requested.
 *   - Once approved by teacher, deletion requires teacher action (out of scope v1).
 */

import { getSnapshot } from './authService';

export type QuestSource = 'student' | 'ai';

export type QuestState =
  | 'draft'
  | 'pending_approval'
  | 'changes_requested'
  | 'approved'
  | 'submitted'
  | 'completed'
  | 'rejected';

export interface StudentQuest {
  id: string;
  ownerKey: string; // pseudonymous student key (alias or supabase student id)
  title: string;
  description?: string;
  goal?: string;
  affectedGroup?: string;
  evidence?: string;
  firstIdea?: string;
  source: QuestSource;
  state: QuestState;
  proposedDeadline?: string; // ISO date — student-set
  approvedDeadline?: string; // ISO date — teacher-set
  teacherFeedback?: string;
  xpEstimate?: number;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'invok_student_quests_v1';
const MAX_ACTIVE_QUESTS = 5;

function isActive(state: QuestState): boolean {
  return state !== 'completed' && state !== 'rejected';
}

function ownerKey(): string {
  const user = getSnapshot().user;
  return user?.id ?? user?.displayName ?? 'anon';
}

function readAll(): StudentQuest[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StudentQuest[]) : [];
  } catch {
    return [];
  }
}

function writeAll(quests: StudentQuest[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quests));
  } catch {
    /* quota / disabled storage — best-effort */
  }
}

function newId(): string {
  // crypto.randomUUID is available in all modern browsers/runtimes we target.
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? (crypto as Crypto).randomUUID()
    : `q_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function listQuests(): StudentQuest[] {
  const owner = ownerKey();
  return readAll()
    .filter((q) => q.ownerKey === owner)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function getActiveQuestCount(): number {
  return listQuests().filter((q) => isActive(q.state)).length;
}

export interface CreateQuestInput {
  title: string;
  description?: string;
  goal?: string;
  affectedGroup?: string;
  evidence?: string;
  firstIdea?: string;
  source: QuestSource;
  proposedDeadline?: string;
}

export interface QuestMutationResult {
  ok: boolean;
  quest?: StudentQuest;
  error?: string;
}

export function createQuest(input: CreateQuestInput): QuestMutationResult {
  if (!input.title || input.title.trim().length < 3) {
    return { ok: false, error: 'Misia potrebuje aspoň krátky názov.' };
  }
  if (getActiveQuestCount() >= MAX_ACTIVE_QUESTS) {
    return {
      ok: false,
      error: `Máš už ${MAX_ACTIVE_QUESTS} aktívnych misií. Zruš alebo dokonči nejakú predtým než pridáš ďalšiu.`,
    };
  }
  const now = new Date().toISOString();
  const quest: StudentQuest = {
    id: newId(),
    ownerKey: ownerKey(),
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    goal: input.goal?.trim() || undefined,
    affectedGroup: input.affectedGroup?.trim() || undefined,
    evidence: input.evidence?.trim() || undefined,
    firstIdea: input.firstIdea?.trim() || undefined,
    source: input.source,
    state: 'pending_approval', // submitted for teacher approval immediately
    proposedDeadline: input.proposedDeadline,
    createdAt: now,
    updatedAt: now,
  };
  const all = readAll();
  all.push(quest);
  writeAll(all);
  return { ok: true, quest };
}

export function deleteQuest(id: string): QuestMutationResult {
  const all = readAll();
  const owner = ownerKey();
  const quest = all.find((q) => q.id === id && q.ownerKey === owner);
  if (!quest) return { ok: false, error: 'Misia sa nenašla.' };
  if (quest.state === 'approved' || quest.state === 'submitted') {
    return {
      ok: false,
      error: 'Schválenú alebo odovzdanú misiu už nemôžeš sám zmazať — popros učiteľa.',
    };
  }
  writeAll(all.filter((q) => q.id !== id));
  return { ok: true, quest };
}

/** Reserved for the future approval workflow (called from teacher UI / API). */
export function updateQuestState(id: string, next: QuestState, patch?: Partial<StudentQuest>): QuestMutationResult {
  const all = readAll();
  const idx = all.findIndex((q) => q.id === id);
  if (idx < 0) return { ok: false, error: 'Misia sa nenašla.' };
  const updated: StudentQuest = {
    ...all[idx],
    ...patch,
    state: next,
    updatedAt: new Date().toISOString(),
  };
  all[idx] = updated;
  writeAll(all);
  return { ok: true, quest: updated };
}

export const QUEST_LIMITS = {
  MAX_ACTIVE: MAX_ACTIVE_QUESTS,
};
