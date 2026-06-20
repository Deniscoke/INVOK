/**
 * Catch-all router for /api/student/*
 *
 * Dispatch table:
 *   POST   /api/student/join                  → joinClass (pseudonymous login)
 *   POST   /api/student/session               → verifyStudentSession
 *
 *   GET    /api/student/quests                → list own quests
 *   POST   /api/student/quests                → create a quest (pending approval)
 *   DELETE /api/student/quests/:id            → delete an unapproved quest
 *   POST   /api/student/quests/generate       → AI-generate quest draft (no save)
 *
 * Student auth is pseudonymous: the client sends the session token via
 *   Authorization: Bearer <token>
 * (or `?token=…` for GET requests, since we can't set headers easily there).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { joinClass, verifyStudentSession } from '../../backend/services/studentAccessService.js';
import {
  createOwnQuest,
  deleteOwnQuest,
  listOwnQuests,
  loadQuestForStudent,
} from '../../backend/services/studentQuestService.js';
import { generateQuest } from '../../backend/services/questGeneratorService.js';
import { saveQuestionnaire, listMyQuestionnaires } from '../../backend/services/questionnaireService.js';
import { routeSegments } from '../../backend/lib/routePath.js';
import { createQuestUploadUrl, listQuestFiles, isAllowedAttachmentType, ATTACH_MAX_FILE_BYTES } from '../../backend/lib/storage.js';

function bearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization ?? '';
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  if (typeof req.query.token === 'string' && req.query.token.length > 0) return req.query.token;
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const segments = routeSegments(req, 'student');
  const route = segments[0] ?? '';
  const subroute = segments[1] ?? '';
  const body = (req.body ?? {}) as Record<string, unknown>;

  // Legacy: /api/student/join
  if (route === 'join') {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }
    const result = await joinClass({
      code: String(body.code ?? ''),
      pseudonym: typeof body.pseudonym === 'string' ? body.pseudonym : undefined,
    });
    res.status(result.ok ? 200 : 400).json(result);
    return;
  }

  if (route === 'session') {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }
    const result = await verifyStudentSession(body.sessionToken);
    res.status(result.valid ? 200 : 401).json(result);
    return;
  }

  // POST /api/student/upload — issue a signed upload URL for one quest attachment.
  if (route === 'upload') {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }
    const token = bearerToken(req);
    if (!token) {
      res.status(401).json({ ok: false, error: 'Chýba študentský session token.' });
      return;
    }
    const session = await verifyStudentSession(token);
    if (!session.valid || !session.studentAccessCodeId) {
      res.status(401).json({ ok: false, error: 'Neplatná študentská session.' });
      return;
    }
    const questId = typeof body.studentQuestId === 'string' ? body.studentQuestId : '';
    const fileName = typeof body.fileName === 'string' ? body.fileName : '';
    const contentType = typeof body.contentType === 'string' ? body.contentType : 'application/octet-stream';
    const sizeBytes = Number(body.sizeBytes ?? 0);
    if (!questId || !fileName) {
      res.status(400).json({ ok: false, error: 'Chýba misia alebo názov súboru.' });
      return;
    }
    if (!isAllowedAttachmentType(contentType)) {
      res.status(400).json({ ok: false, error: 'Nepodporovaný typ súboru.' });
      return;
    }
    if (sizeBytes > ATTACH_MAX_FILE_BYTES) {
      res.status(400).json({ ok: false, error: 'Súbor je príliš veľký (max 50 MB).' });
      return;
    }
    // The quest must belong to this student and be in a submittable state.
    const quest = await loadQuestForStudent(session.studentAccessCodeId, questId);
    if (!quest) {
      res.status(403).json({ ok: false, error: 'Táto misia nepatrí tebe.' });
      return;
    }
    if (quest.state !== 'approved' && quest.state !== 'changes_requested') {
      res.status(409).json({ ok: false, error: 'Súbory môžeš pridať až keď je misia schválená učiteľom.' });
      return;
    }
    const signed = await createQuestUploadUrl(questId, fileName);
    if (!signed) {
      res.status(500).json({ ok: false, error: 'Nahrávanie momentálne nie je dostupné.' });
      return;
    }
    res.status(200).json({ ok: true, ...signed });
    return;
  }

  // /api/student/questionnaire — pseudonymous input/output competency self-assessment.
  if (route === 'questionnaire') {
    const token = bearerToken(req);
    if (!token) {
      res.status(401).json({ ok: false, error: 'Chýba študentský session token.' });
      return;
    }
    if (req.method === 'POST') {
      const result = await saveQuestionnaire(token, body.phase, body.answers, body.openAnswers);
      res.status(result.ok ? 200 : (result.status ?? 500)).json(result);
      return;
    }
    if (req.method === 'GET') {
      const result = await listMyQuestionnaires(token);
      res.status(result.ok ? 200 : (result.status ?? 500)).json(result);
      return;
    }
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  // /api/student/quests* — pseudonymous student-owned quests.
  if (route === 'quests') {
    const token = bearerToken(req);
    if (!token) {
      res.status(401).json({ ok: false, error: 'Chýba študentský session token.' });
      return;
    }

    // /api/student/quests/generate OR /api/student/quests?mode=generate — AI draft.
    // (Vercel's catch-all only matches one path segment under a custom-rewrites
    // config, so the query form is what the frontend actually uses.)
    if (subroute === 'generate' || req.query.mode === 'generate') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
      }
      const session = await verifyStudentSession(token);
      if (!session.valid) {
        res.status(401).json({ ok: false, error: 'Neplatná študentská session.' });
        return;
      }
      const result = await generateQuest({
        ...body,
        studentAlias: session.studentAlias,
      });
      res.status(result.ok ? 200 : 400).json(result);
      return;
    }

    // GET /api/student/quests?action=files&questId=… — own quest's attachments
    // (the student's file history, with fresh signed download URLs).
    if (req.query.action === 'files' && req.method === 'GET') {
      const session = await verifyStudentSession(token);
      if (!session.valid || !session.studentAccessCodeId) {
        res.status(401).json({ ok: false, error: 'Neplatná študentská session.' });
        return;
      }
      const questId = typeof req.query.questId === 'string' ? req.query.questId : '';
      const quest = await loadQuestForStudent(session.studentAccessCodeId, questId);
      if (!quest) {
        res.status(403).json({ ok: false, error: 'Táto misia nepatrí tebe.' });
        return;
      }
      res.status(200).json({ ok: true, files: await listQuestFiles(questId) });
      return;
    }

    if (req.method === 'GET') {
      const result = await listOwnQuests(token);
      if (!result.ok) {
        res.status(result.status ?? 500).json({ ok: false, error: result.error });
        return;
      }
      res.status(200).json({ ok: true, quests: result.data, source: result.source });
      return;
    }

    if (req.method === 'POST') {
      const result = await createOwnQuest(token, body);
      if (!result.ok) {
        res.status(result.status ?? 500).json({ ok: false, error: result.error });
        return;
      }
      res.status(200).json({ ok: true, quest: result.data, source: result.source });
      return;
    }

    if (req.method === 'DELETE') {
      const id = subroute || (typeof req.query.id === 'string' ? req.query.id : '') || String(body.id ?? '');
      if (!id) {
        res.status(400).json({ ok: false, error: 'Chýba ID misie.' });
        return;
      }
      const result = await deleteOwnQuest(token, id);
      if (!result.ok) {
        res.status(result.status ?? 500).json({ ok: false, error: result.error });
        return;
      }
      res.status(200).json({ ok: true, deleted: true, source: result.source });
      return;
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  res.status(404).json({ error: 'Not Found' });
}
