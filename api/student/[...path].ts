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
} from '../../backend/services/studentQuestService.js';
import { generateQuest } from '../../backend/services/questGeneratorService.js';

function bearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization ?? '';
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  if (typeof req.query.token === 'string' && req.query.token.length > 0) return req.query.token;
  return null;
}

function segmentsOf(req: VercelRequest): string[] {
  const raw = req.query.path;
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string' && raw.length > 0) return [raw];
  return [];
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const segments = segmentsOf(req);
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

  // /api/student/quests* — pseudonymous student-owned quests.
  if (route === 'quests') {
    const token = bearerToken(req);
    if (!token) {
      res.status(401).json({ ok: false, error: 'Chýba študentský session token.' });
      return;
    }

    // /api/student/quests/generate — AI draft (does not persist).
    if (subroute === 'generate') {
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
      const id = subroute || String(body.id ?? '');
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
