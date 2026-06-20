/**
 * Catch-all router for /api/teacher/*
 *
 * Dispatch table:
 *   POST /api/teacher/reviews                     → createTeacherReview
 *   GET  /api/teacher/reviews?decision=…          → listTeacherReviews
 *   GET  /api/teacher/reviews/[submissionId]      → getTeacherReviewForSubmission
 *   GET  /api/teacher/submissions                 → getTeacherSubmissions
 *   GET  /api/teacher/quests?classId=…            → listClassPendingQuests
 *   POST /api/teacher/quests/review               → reviewQuest (approve/reject/changes)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveContext, isTeacherOrAdmin, requireAuth } from '../../backend/lib/requestContext.js';
import { routeSegments } from '../../backend/lib/routePath.js';
import {
  createTeacherReview,
  listTeacherReviews,
  getTeacherReviewForSubmission,
} from '../../backend/services/teacherReviewService.js';
import { REVIEW_DECISIONS, type ReviewDecision } from '../../backend/validators/teacherReviewValidator.js';
import { getTeacherSubmissions } from '../../backend/services/submissionService.js';
import { validateQueryFilter } from '../../backend/validators/submissionValidator.js';
import { listClassPendingQuests, reviewQuest, listQuestAttachments } from '../../backend/services/studentQuestService.js';
import { getClassQuestionnaireStats } from '../../backend/services/questionnaireService.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const segments = routeSegments(req, 'teacher');
  const root = segments[0] ?? '';

  // /api/teacher/submissions
  if (root === 'submissions') {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }
    const ctx = await resolveContext(req);
    if (!isTeacherOrAdmin(ctx)) {
      res.status(403).json({ error: 'Prístup len pre učiteľov a adminov.' });
      return;
    }
    const filter = validateQueryFilter(req.query as Record<string, unknown>);
    if (!filter.ok) {
      res.status(400).json({ error: 'Neplatné filtre.', issues: filter.issues });
      return;
    }
    try {
      res.status(200).json({ submissions: await getTeacherSubmissions(ctx, filter.value) });
    } catch {
      res.status(500).json({ error: 'Interná chyba servera.' });
    }
    return;
  }

  // /api/teacher/stats — class-level questionnaire growth (input vs output).
  if (root === 'stats') {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }
    const ctx = await resolveContext(req);
    if (!isTeacherOrAdmin(ctx)) {
      res.status(403).json({ error: 'Prístup len pre učiteľov a adminov.' });
      return;
    }
    const classId = typeof req.query.classId === 'string' ? req.query.classId : undefined;
    const result = await getClassQuestionnaireStats(ctx, classId);
    res.status(result.ok ? 200 : (result.status ?? 500)).json(result);
    return;
  }

  // /api/teacher/reviews and /api/teacher/reviews/[submissionId]
  // (single-segment Vercel catch-all → the id may arrive as ?submissionId=)
  if (root === 'reviews') {
    const submissionId = segments[1] ?? (typeof req.query.submissionId === 'string' ? req.query.submissionId : undefined);

    // GET /api/teacher/reviews/[submissionId]
    if (submissionId) {
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
      }
      const ctx = await resolveContext(req);
      if (!requireAuth(ctx)) {
        res.status(401).json({ error: 'Nie si prihlásený.' });
        return;
      }
      try {
        const review = await getTeacherReviewForSubmission(ctx, submissionId.trim());
        res.status(200).json({ review });
      } catch {
        res.status(500).json({ error: 'Interná chyba servera.' });
      }
      return;
    }

    // POST or GET /api/teacher/reviews (teacher/admin only)
    const ctx = await resolveContext(req);
    if (!isTeacherOrAdmin(ctx)) {
      res.status(403).json({ error: 'Prístup len pre učiteľov a adminov.' });
      return;
    }
    if (req.method === 'POST') {
      try {
        const result = await createTeacherReview(ctx, req.body);
        res.status(result.ok ? 200 : 400).json(result);
      } catch {
        res.status(500).json({ error: 'Interná chyba servera.' });
      }
      return;
    }
    if (req.method === 'GET') {
      const raw = typeof req.query.decision === 'string' ? req.query.decision : undefined;
      const decision = (REVIEW_DECISIONS as readonly string[]).includes(raw ?? '') ? (raw as ReviewDecision) : undefined;
      const reviews = await listTeacherReviews(ctx, { decision });
      res.status(200).json({ reviews });
      return;
    }
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  // /api/teacher/quests* — student-proposed quests awaiting teacher approval.
  if (root === 'quests') {
    const sub = segments[1] ?? '';
    const ctx = await resolveContext(req);
    if (!isTeacherOrAdmin(ctx)) {
      res.status(403).json({ error: 'Prístup len pre učiteľov a adminov.' });
      return;
    }

    // Approve/reject. Path 'quests/review' OR (single-segment Vercel catch-all)
    // 'quests?action=review'.
    if ((sub === 'review' || req.query.action === 'review') && req.method === 'POST') {
      const result = await reviewQuest(ctx, (req.body ?? {}) as Parameters<typeof reviewQuest>[1]);
      if (!result.ok) {
        res.status(result.status ?? 500).json({ ok: false, error: result.error });
        return;
      }
      res.status(200).json({ ok: true, quest: result.data, source: result.source });
      return;
    }

    // GET /api/teacher/quests?action=files&questId=… → a quest's attachments.
    if (req.query.action === 'files' && req.method === 'GET') {
      const questId = typeof req.query.questId === 'string' ? req.query.questId : '';
      const result = await listQuestAttachments(ctx, questId);
      if (!result.ok) {
        res.status(result.status ?? 500).json({ ok: false, error: result.error });
        return;
      }
      res.status(200).json({ ok: true, files: result.data });
      return;
    }

    if (!sub && req.method === 'GET') {
      const classId = typeof req.query.classId === 'string' ? req.query.classId : undefined;
      const result = await listClassPendingQuests(ctx, classId);
      if (!result.ok) {
        res.status(result.status ?? 500).json({ ok: false, error: result.error });
        return;
      }
      res.status(200).json({ ok: true, quests: result.data, source: result.source });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  res.status(404).json({ error: 'Not Found' });
}
