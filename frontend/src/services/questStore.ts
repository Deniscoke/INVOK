/**
 * Student quest store (frontend).
 *
 * Routes through the configured backend when Supabase is set up:
 *   GET    /api/student/quests
 *   POST   /api/student/quests
 *   DELETE /api/student/quests/<id>
 *   POST   /api/student/quests/generate   (AI draft, no save)
 *
 * Falls back to localStorage in demo mode (no Supabase configured) so the
 * UX preview works without any backend. Schema is identical in both paths.
 *
 * State machine (mirrors supabase/migrations/007_student_quests.sql):
 *   draft → pending_approval → changes_requested ↔ pending_approval
 *                              approved → submitted → completed
 *                              rejected (terminal)
 */

import { isSupabaseConfigured } from './supabaseClient';
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
  ownerKey: string;            // pseudonymous key (localStorage mode) or empty
  studentAccessCodeId?: string; // db mode
  classId?: string;             // db mode
  studentAlias?: string;
  title: string;
  description?: string;
  goal?: string;
  affectedGroup?: string;
  evidence?: string;
  firstIdea?: string;
  source: QuestSource;
  aiModel?: string;
  state: QuestState;
  proposedDeadline?: string;
  approvedDeadline?: string;
  teacherFeedback?: string;
  xpEstimate?: number;
  createdAt: string;
  updatedAt: string;
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
  aiModel?: string;
  aiPrompt?: string;
}

export interface GenerateInput {
  topic: string;
  grade?: number;
  proposedDeadline?: string;
}

export interface QuestMutationResult {
  ok: boolean;
  quest?: StudentQuest;
  error?: string;
  source?: 'db' | 'local';
}

export interface GenerateDraftResult {
  ok: boolean;
  draft?: CreateQuestInput & {
    description: string;
    affectedGroup: string;
    evidence: string;
    firstIdea: string;
    learningOutcomes?: string[];
    xpEstimate: number;
    rationale?: string;
    rvpAlignment?: string;
  };
  error?: string;
  source?: 'openai' | 'mock';
}

const STORAGE_KEY = 'invok_student_quests_v1';
const SESSION_KEY = 'invok_student_session';
const MAX_ACTIVE_QUESTS = 5;

function isActive(state: QuestState): boolean {
  return state !== 'completed' && state !== 'rejected';
}

function getStudentToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(SESSION_KEY);
}

function isApiMode(): boolean {
  return isSupabaseConfigured && Boolean(getStudentToken());
}

function ownerKey(): string {
  const user = getSnapshot().user;
  return user?.id ?? user?.displayName ?? 'anon';
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? (crypto as Crypto).randomUUID()
    : `q_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// localStorage path (demo mode + offline fallback)
// ---------------------------------------------------------------------------

function readLocal(): StudentQuest[] {
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

function writeLocal(all: StudentQuest[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* best-effort */
  }
}

function listLocal(): StudentQuest[] {
  const owner = ownerKey();
  return readLocal()
    .filter((q) => q.ownerKey === owner)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function createLocal(input: CreateQuestInput): QuestMutationResult {
  if (!input.title || input.title.trim().length < 3) {
    return { ok: false, error: 'Misia potrebuje aspoň krátky názov.' };
  }
  const owner = ownerKey();
  const active = readLocal().filter((q) => q.ownerKey === owner && isActive(q.state)).length;
  if (active >= MAX_ACTIVE_QUESTS) {
    return {
      ok: false,
      error: `Máš už ${MAX_ACTIVE_QUESTS} aktívnych misií. Zruš alebo dokonči nejakú predtým než pridáš ďalšiu.`,
    };
  }
  const now = new Date().toISOString();
  const quest: StudentQuest = {
    id: newId(),
    ownerKey: owner,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    goal: input.goal?.trim() || undefined,
    affectedGroup: input.affectedGroup?.trim() || undefined,
    evidence: input.evidence?.trim() || undefined,
    firstIdea: input.firstIdea?.trim() || undefined,
    source: input.source,
    aiModel: input.aiModel,
    state: 'pending_approval',
    proposedDeadline: input.proposedDeadline,
    createdAt: now,
    updatedAt: now,
  };
  const all = readLocal();
  all.push(quest);
  writeLocal(all);
  return { ok: true, quest, source: 'local' };
}

function deleteLocal(id: string): QuestMutationResult {
  const all = readLocal();
  const owner = ownerKey();
  const quest = all.find((q) => q.id === id && q.ownerKey === owner);
  if (!quest) return { ok: false, error: 'Misia sa nenašla.' };
  if (quest.state === 'approved' || quest.state === 'submitted' || quest.state === 'completed') {
    return {
      ok: false,
      error: 'Schválenú alebo odovzdanú misiu už nemôžeš sám zmazať — popros učiteľa.',
    };
  }
  writeLocal(all.filter((q) => q.id !== id));
  return { ok: true, quest, source: 'local' };
}

// ---------------------------------------------------------------------------
// API path (Supabase-backed, real teacher-approval workflow)
// ---------------------------------------------------------------------------

function authHeaders(): Record<string, string> {
  const token = getStudentToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiList(): Promise<StudentQuest[]> {
  const res = await fetch('/api/student/quests', { headers: authHeaders() });
  if (!res.ok) throw new Error(`api ${res.status}`);
  const data = (await res.json()) as { quests: StudentQuest[] };
  return Array.isArray(data.quests) ? data.quests : [];
}

async function apiCreate(input: CreateQuestInput): Promise<QuestMutationResult> {
  const res = await fetch('/api/student/quests', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as { ok: boolean; quest?: StudentQuest; error?: string; source?: 'db' | 'mock' };
  if (!res.ok || !data.ok) {
    return { ok: false, error: data.error ?? 'Uloženie misie zlyhalo.' };
  }
  return { ok: true, quest: data.quest, source: data.source === 'mock' ? 'local' : 'db' };
}

async function apiDelete(id: string): Promise<QuestMutationResult> {
  const res = await fetch(`/api/student/quests/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok || !data.ok) {
    return { ok: false, error: data.error ?? 'Mazanie zlyhalo.' };
  }
  return { ok: true, source: 'db' };
}

async function apiGenerate(input: GenerateInput): Promise<GenerateDraftResult> {
  const res = await fetch('/api/student/quests/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as {
    ok: boolean;
    data?: GenerateDraftResult['draft'];
    error?: string;
    source?: 'openai' | 'mock';
  };
  if (!res.ok || !data.ok || !data.data) {
    return { ok: false, error: data.error ?? 'AI návrh sa nepodarilo vygenerovať.' };
  }
  return { ok: true, draft: data.data, source: data.source };
}

// ---------------------------------------------------------------------------
// Public, async-only API
// ---------------------------------------------------------------------------

export async function listQuests(): Promise<StudentQuest[]> {
  if (isApiMode()) {
    try {
      return await apiList();
    } catch {
      return listLocal();
    }
  }
  return listLocal();
}

export async function createQuest(input: CreateQuestInput): Promise<QuestMutationResult> {
  if (isApiMode()) {
    try {
      return await apiCreate(input);
    } catch {
      // Network failure — fall back to local so the student doesn't lose work.
      return createLocal(input);
    }
  }
  return createLocal(input);
}

export async function deleteQuest(id: string): Promise<QuestMutationResult> {
  if (isApiMode()) {
    try {
      return await apiDelete(id);
    } catch {
      return deleteLocal(id);
    }
  }
  return deleteLocal(id);
}

export async function generateQuestDraft(input: GenerateInput): Promise<GenerateDraftResult> {
  if (isApiMode()) {
    try {
      return await apiGenerate(input);
    } catch {
      return {
        ok: false,
        error: 'AI návrh momentálne nedostupný — skús „Navrhni vlastný problém“.',
      };
    }
  }
  // Demo mode: deterministic offline scaffold so /quests still works.
  return {
    ok: true,
    source: 'mock',
    draft: {
      title: `Misia: ${input.topic.charAt(0).toUpperCase()}${input.topic.slice(1)}`,
      description: `V tejto misii sa pozrieš na oblasť „${input.topic}“ vo svojej škole a komunite. Zistíš, ako to vyzerá teraz, navrhneš jedno konkrétne zlepšenie a vyskúšaš ho v malom.`,
      goal: `Urobiť 1 merateľný krok, ktorý zlepší situáciu v oblasti „${input.topic}“.`,
      affectedGroup: 'naša trieda',
      evidence: `3–5 dní krátkeho pozorovania alebo prieskumu v oblasti „${input.topic}“.`,
      firstIdea: `Navrhnúť 1 konkrétne lacné zlepšenie v oblasti „${input.topic}“ a otestovať ho v jednom týždni.`,
      learningOutcomes: [
        `Naučíš sa pozorovať a zmerať súčasný stav v oblasti „${input.topic}“.`,
        'Navrhneš konkrétne riešenie a vyskúšaš ho v malom.',
        'Vyhodnotíš, či tvoj nápad zabral.',
      ],
      xpEstimate: 100,
      source: 'ai',
      aiModel: 'mock-quest-scaffold-v1',
    },
  };
}

export function countActive(quests: StudentQuest[]): number {
  return quests.filter((q) => isActive(q.state)).length;
}

export const QUEST_LIMITS = {
  MAX_ACTIVE: MAX_ACTIVE_QUESTS,
};
