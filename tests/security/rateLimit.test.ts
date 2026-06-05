import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkRateLimit,
  resetRateLimits,
  enforceAiRateLimit,
  rateLimitIdentity,
  ipHashFromHeader,
} from '../../backend/lib/rateLimit';
import type { RequestContext } from '../../backend/lib/requestContext';

const student: RequestContext = { mode: 'student_session', studentAccessCodeId: 'c1', pseudonym: 'Líška-07', classId: 'cl1' };
const teacher: RequestContext = { mode: 'supabase_user', userId: 't1', role: 'teacher' };
const anon: RequestContext = { mode: 'anonymous' };

beforeEach(() => resetRateLimits());

describe('checkRateLimit', () => {
  it('allows up to max, then blocks', () => {
    for (let i = 0; i < 3; i += 1) expect(checkRateLimit('k', 3, 60_000).allowed).toBe(true);
    const blocked = checkRateLimit('k', 3, 60_000);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('keeps separate keys independent', () => {
    expect(checkRateLimit('a', 1, 60_000).allowed).toBe(true);
    expect(checkRateLimit('a', 1, 60_000).allowed).toBe(false);
    expect(checkRateLimit('b', 1, 60_000).allowed).toBe(true);
  });

  it('resets after the window elapses', () => {
    vi.useFakeTimers();
    try {
      expect(checkRateLimit('w', 1, 1000).allowed).toBe(true);
      expect(checkRateLimit('w', 1, 1000).allowed).toBe(false);
      vi.advanceTimersByTime(1001);
      expect(checkRateLimit('w', 1, 1000).allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('rateLimitIdentity', () => {
  it('separates student, teacher and anonymous tiers', () => {
    expect(rateLimitIdentity(student).tier).toBe('student');
    expect(rateLimitIdentity(teacher).tier).toBe('teacher');
    expect(rateLimitIdentity(anon).tier).toBe('anonymous');
    expect(rateLimitIdentity(student).key).not.toBe(rateLimitIdentity(teacher).key);
  });
});

describe('enforceAiRateLimit', () => {
  it('blocks a student after the per-window limit (default 5)', () => {
    for (let i = 0; i < 5; i += 1) expect(enforceAiRateLimit(student).allowed).toBe(true);
    const blocked = enforceAiRateLimit(student);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('gives teachers a higher limit than students', () => {
    let allowed = 0;
    for (let i = 0; i < 10; i += 1) if (enforceAiRateLimit(teacher).allowed) allowed += 1;
    expect(allowed).toBeGreaterThan(5);
  });

  it('429 decision contains no secrets', () => {
    for (let i = 0; i < 6; i += 1) enforceAiRateLimit(student);
    const serialized = JSON.stringify(enforceAiRateLimit(student));
    expect(serialized).not.toContain('OPENAI_API_KEY');
    expect(serialized).not.toContain('SERVICE_ROLE');
    expect(serialized).not.toContain('sk-');
  });
});

describe('ipHashFromHeader', () => {
  it('hashes the IP (never plaintext) and handles a missing header', () => {
    const hash = ipHashFromHeader('203.0.113.7, 70.41.3.18');
    expect(typeof hash).toBe('string');
    expect(hash).not.toContain('203.0.113.7');
    expect(ipHashFromHeader(undefined)).toBeUndefined();
  });
});
