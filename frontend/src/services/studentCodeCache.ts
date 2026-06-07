/**
 * Local cache of student access codes generated through the pilot setup.
 *
 * This exists purely as a demo-mode safety net: while the serverless API is
 * being stabilised, the codes the teacher just generated would otherwise be
 * unverifiable. By caching them locally (in the teacher's browser) we let
 * the full flow be demonstrated end-to-end on a single machine without a
 * working `/api/student/join` endpoint.
 *
 * Caveats — call sites must keep them in mind:
 *
 *   • Plaintext: codes are stored unencrypted in `localStorage`. In a real
 *     deployment students should always be validated by the server (hashed
 *     comparison). This file MUST NOT be the source of truth in production.
 *   • Browser-bound: codes live only in the browser that generated them.
 *     Students on a different device cannot use this fallback.
 *   • Demo only: as soon as `/api/student/join` is reachable, the API
 *     response wins and the cache is only used as a fallback.
 */
import type { GeneratedCode } from './pilotSetupApi';

const CACHE_KEY = 'invok_pilot_demo_codes';

export interface CachedStudentCode {
  classId: string;
  className?: string;
  pseudonym: string;
  /** Plaintext code — case-insensitive on lookup. */
  code: string;
  createdAt: string;
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function read(): CachedStudentCode[] {
  const storage = safeStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is CachedStudentCode =>
        !!entry &&
        typeof (entry as CachedStudentCode).classId === 'string' &&
        typeof (entry as CachedStudentCode).pseudonym === 'string' &&
        typeof (entry as CachedStudentCode).code === 'string',
    );
  } catch {
    return [];
  }
}

function write(entries: CachedStudentCode[]): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(CACHE_KEY, JSON.stringify(entries));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

/**
 * Persist a batch of freshly generated codes for a class. Existing entries
 * for the same (classId, pseudonym) tuple are replaced so re-generating a
 * code list for a class doesn't accumulate stale duplicates.
 */
export function rememberStudentCodes(
  classId: string,
  codes: GeneratedCode[],
  className?: string,
): void {
  if (!classId || codes.length === 0) return;
  const existing = read();
  const filtered = existing.filter(
    (entry) => !(entry.classId === classId && codes.some((c) => c.pseudonym === entry.pseudonym)),
  );
  const now = new Date().toISOString();
  const fresh: CachedStudentCode[] = codes.map((c) => ({
    classId,
    className,
    pseudonym: c.pseudonym,
    code: c.code,
    createdAt: now,
  }));
  write([...filtered, ...fresh]);
}

/** Return all cached codes for a class (empty if none). */
export function getCachedCodesForClass(classId: string): CachedStudentCode[] {
  return read().filter((entry) => entry.classId === classId);
}

/** Lightweight summary for the student-join diagnostic panel. */
export interface CachedCodesSummary {
  total: number;
  classes: { classId: string; className?: string; count: number; samplePseudonyms: string[] }[];
}

export function summarizeCachedCodes(): CachedCodesSummary {
  const entries = read();
  const byClass = new Map<string, CachedStudentCode[]>();
  for (const entry of entries) {
    const list = byClass.get(entry.classId) ?? [];
    list.push(entry);
    byClass.set(entry.classId, list);
  }
  return {
    total: entries.length,
    classes: Array.from(byClass.entries()).map(([classId, list]) => ({
      classId,
      className: list[0]?.className,
      count: list.length,
      samplePseudonyms: list.slice(0, 5).map((c) => c.pseudonym),
    })),
  };
}

/**
 * Find a cached code matching the supplied access code and (optional)
 * pseudonym. Pseudonym matching is case-insensitive; when omitted the
 * first code match wins.
 */
export function findCachedStudent(code: string, pseudonym?: string): CachedStudentCode | null {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) return null;
  const matches = read().filter((entry) => entry.code.toUpperCase() === normalizedCode);
  if (matches.length === 0) return null;
  const wantedPseudonym = pseudonym?.trim().toLowerCase();
  if (wantedPseudonym) {
    return matches.find((m) => m.pseudonym.toLowerCase() === wantedPseudonym) ?? matches[0];
  }
  return matches[0];
}

/** Wipe the local cache (e.g. after a teacher resets pilot data). */
export function clearCachedStudentCodes(): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}
