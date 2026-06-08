/**
 * Catch-all router for /api/submissions/* — consolidates 3 endpoints.
 *
 * Dispatch table:
 *   POST /api/submissions          → createSubmission (rate-limited)
 *   GET  /api/submissions/me       → getOwnSubmissions
 *   GET  /api/submissions/[id]     → getSubmissionById + teacher review (if any)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveContext, requireAuth } from '../../backend/lib/requestContext.js';
import { enforceAiRateLimit, ipHashFromHeader } from '../../backend/lib/rateLimit.js';
import { validateSubmissionInput } from '../../backend/validators/submissionValidator.js';
import {
  createSubmission,
  getOwnSubmissions,
  getSubmissionById,
} from '../../backend/services/submissionService.js';
import { getTeacherReviewForSubmission } from '../../backend/services/teacherReviewService.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const segments = (req.query.path as string[] | undefined) ?? [];
  const ctx = await resolveContext(req);
  if (!requireAuth(ctx)) {
    res.status(401).json({ error: 'Nie si prihlásený.' });
    return;
  }

  // POST /api/submissions  (no path segments)
  if (segments.length === 0) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }
    const decision = enforceAiRateLimit(ctx, ipHashFromHeader(req.headers['x-forwarded-for']));
    if (!decision.allowed) {
      res.setHeader('Retry-After', String(Math.ceil(decision.retryAfterMs / 1000)));
      res.status(429).json({ error: 'RATE_LIMITED', message: 'Skús to znova o chvíľu.', retryAfterMs: decision.retryAfterMs });
      return;
    }
    const parsed = validateSubmissionInput(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: 'Neplatné vstupy.', issues: parsed.issues });
      return;
    }
    try {
      const result = await createSubmission(ctx, parsed.value);
      res.status(result.ok ? 200 : 400).json(result);
    } catch {
      res.status(500).json({ error: 'Interná chyba servera.', suggestedTeacherReview: true });
    }
    return;
  }

  // GET /api/submissions/me
  if (segments[0] === 'me') {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }
    try {
      res.status(200).json({ submissions: await getOwnSubmissions(ctx) });
    } catch {
      res.status(500).json({ error: 'Interná chyba servera.' });
    }
    return;
  }

  // GET /api/submissions/[id]
  if (segments.length === 1) {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }
    const id = segments[0].trim();
    if (!id) {
      res.status(400).json({ error: 'Chýba ID odovzdania.' });
      return;
    }
    try {
      const submission = await getSubmissionById(ctx, id);
      if (!submission) {
        res.status(404).json({ error: 'Odovzdanie nenájdené alebo nemáš prístup.' });
        return;
      }
      const review = await getTeacherReviewForSubmission(ctx, id);
      res.status(200).json({ submission, review });
    } catch {
      res.status(500).json({ error: 'Interná chyba servera.' });
    }
    return;
  }

  res.status(404).json({ error: 'Not Found' });
}
