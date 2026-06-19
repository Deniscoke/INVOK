import { describe, it, expect } from 'vitest';
import type { VercelRequest } from '@vercel/node';
import { routeSegments } from '../../backend/lib/routePath';

/**
 * The consolidated catch-all routers rely on routeSegments to know which
 * sub-endpoint was requested. In production (custom rewrites in vercel.json)
 * `req.query.path` can arrive empty, so URL parsing must be a reliable
 * fallback — otherwise every consolidated route 404s. These tests lock that.
 */
function mockReq(opts: { path?: unknown; url?: string }): VercelRequest {
  return { query: opts.path === undefined ? {} : { path: opts.path }, url: opts.url } as unknown as VercelRequest;
}

describe('routeSegments', () => {
  it('uses req.query.path when Vercel populates it (array)', () => {
    expect(routeSegments(mockReq({ path: ['quests', 'generate'], url: '/api/student/quests/generate' }), 'student'))
      .toEqual(['quests', 'generate']);
  });

  it('uses req.query.path when it is a string', () => {
    expect(routeSegments(mockReq({ path: 'join', url: '/api/student/join' }), 'student')).toEqual(['join']);
  });

  it('falls back to the URL when req.query.path is missing', () => {
    expect(routeSegments(mockReq({ url: '/api/student/join' }), 'student')).toEqual(['join']);
  });

  it('parses multi-segment URLs in the fallback', () => {
    expect(routeSegments(mockReq({ url: '/api/admin/student-codes/abc-123' }), 'admin'))
      .toEqual(['student-codes', 'abc-123']);
  });

  it('strips the query string in the fallback', () => {
    expect(routeSegments(mockReq({ url: '/api/dashboard/summary?classId=c1&from=2026-01-01' }), 'dashboard'))
      .toEqual(['summary']);
  });

  it('returns [] for the bare base path', () => {
    expect(routeSegments(mockReq({ url: '/api/submissions' }), 'submissions')).toEqual([]);
    expect(routeSegments(mockReq({ url: '/api/submissions/' }), 'submissions')).toEqual([]);
  });

  it('decodes percent-encoded segments safely', () => {
    expect(routeSegments(mockReq({ url: '/api/teacher/reviews/a%20b' }), 'teacher'))
      .toEqual(['reviews', 'a b']);
  });

  it('handles a URL already relative to the function mount', () => {
    expect(routeSegments(mockReq({ url: '/me' }), 'submissions')).toEqual(['me']);
  });
});
