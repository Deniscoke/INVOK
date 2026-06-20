/**
 * Catch-all for /api/ai/* — one Vercel Function (keeps us under the Hobby limit).
 *
 *   POST /api/ai/validate-submission  → formative AI validation (unchanged)
 *   POST /api/ai/smarta-chat          → Smarta assistant chat (OpenAI)
 *   POST /api/ai/smarta-tts           → Smarta text-to-speech (ElevenLabs|OpenAI)
 *
 * The OpenAI / ElevenLabs keys stay SERVER-ONLY. All routes are rate-limited.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { routeSegments } from '../../backend/lib/routePath.js';
import { validateSubmissionInput } from '../../backend/validators/submissionValidator.js';
import { validateSubmissionWithAI } from '../../backend/services/aiValidationService.js';
import { getMissionById } from '../../backend/services/missionService.js';
import { resolveContext, requireAuth } from '../../backend/lib/requestContext.js';
import { enforceAiRateLimit, ipHashFromHeader } from '../../backend/lib/rateLimit.js';
import { getServerEnv, missingServerSecrets } from '../../backend/lib/env.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const route = routeSegments(req, 'ai')[0] ?? 'validate-submission';
  if (route === 'smarta-chat') return handleSmartaChat(req, res);
  if (route === 'smarta-tts') return handleSmartaTts(req, res);
  return handleValidateSubmission(req, res);
}

// ---------------------------------------------------------------------------
// Smarta assistant
// ---------------------------------------------------------------------------
const SMARTA_SYSTEM = `Si „Smarta" — priateľská AI sprievodkyňa platformy INVOK pre slovenské základné školy.
Pomáhaš žiakom (hlavne 8.–9. ročník) aj učiteľom orientovať sa v platforme, vysvetľuješ úlohy a misie,
motivuješ a podporuješ učenie. Hovoríš jednoducho, vrúcne a povzbudivo, po slovensky.

Zásady:
- Si SPRIEVODKYŇA, nie hodnotiteľ. Známky a finálne XP udeľuje vždy učiteľ — ak sa pýtajú na hodnotenie,
  povzbuď ich a odkáž na učiteľa.
- Odpovedaj krátko (2–5 viet), konkrétne a priateľsky. Občas vhodné emoji, ale s mierou.
- Keď žiak nevie ako začať misiu: poraď prvý malý krok (všimni si problém → pomenuj → navrhni riešenie).
- Nevymýšľaj si fakty o konkrétnych dátach žiaka. Ak niečo nevieš, povedz to a navrhni, kde to nájde.
- Nikdy nežiadaj o heslá ani osobné údaje.`;

const SMARTA_FALLBACK = 'Ahoj! Som Smarta 🦊 Práve sa neviem spojiť so serverom, ale rada ti pomôžem o chvíľu. Skús to prosím znova.';
const OPENAI_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer'];

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Keep only well-formed user/assistant turns, capped in size and count. */
function sanitizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMessage[] = [];
  for (const item of raw.slice(-12)) {
    if (typeof item !== 'object' || item === null) continue;
    const m = item as Record<string, unknown>;
    const role = m.role === 'assistant' ? 'assistant' : m.role === 'user' ? 'user' : null;
    const content = typeof m.content === 'string' ? m.content.trim().slice(0, 2000) : '';
    if (role && content) out.push({ role, content });
  }
  return out;
}

function supportsTemperature(model: string): boolean {
  return !/^(gpt-5|o\d)/i.test(model);
}

async function handleSmartaChat(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  const ctx = await resolveContext(req);
  const decision = enforceAiRateLimit(ctx, ipHashFromHeader(req.headers['x-forwarded-for']));
  if (!decision.allowed) {
    res.setHeader('Retry-After', String(Math.ceil(decision.retryAfterMs / 1000)));
    res.status(429).json({ reply: 'Pomalšie prosím 🙂 skús to o chvíľu.', source: 'fallback' });
    return;
  }

  const messages = sanitizeMessages((req.body as Record<string, unknown> | undefined)?.messages);
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    res.status(400).json({ error: 'Napíš mi prosím otázku.' });
    return;
  }

  const env = getServerEnv();
  if (!env.openaiApiKey) {
    res.status(200).json({ reply: SMARTA_FALLBACK, source: 'fallback' });
    return;
  }

  try {
    const { getOpenAIClient } = await import('../../backend/lib/openaiClient.js');
    const client = getOpenAIClient();
    if (!client) {
      res.status(200).json({ reply: SMARTA_FALLBACK, source: 'fallback' });
      return;
    }
    const completion = await client.chat.completions.create({
      model: env.smartaChatModel,
      ...(supportsTemperature(env.smartaChatModel) ? { temperature: 0.6 } : {}),
      max_completion_tokens: 500,
      messages: [{ role: 'system', content: SMARTA_SYSTEM }, ...messages],
    });
    const reply = completion.choices[0]?.message?.content?.trim() || SMARTA_FALLBACK;
    res.status(200).json({ reply, source: 'openai' });
  } catch {
    res.status(200).json({ reply: SMARTA_FALLBACK, source: 'fallback' });
  }
}

async function handleSmartaTts(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  const ctx = await resolveContext(req);
  const decision = enforceAiRateLimit(ctx, ipHashFromHeader(req.headers['x-forwarded-for']));
  if (!decision.allowed) {
    res.setHeader('Retry-After', String(Math.ceil(decision.retryAfterMs / 1000)));
    res.status(429).json({ error: 'RATE_LIMITED' });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const text = (typeof body.text === 'string' ? body.text : '').trim().slice(0, 800);
  if (!text) {
    res.status(400).json({ error: 'Prázdny text.' });
    return;
  }
  const env = getServerEnv();

  // ?debug=1 → report WHY ElevenLabs fails (status + message), never the key.
  const debug = req.query.debug === '1';

  // 1) ElevenLabs (preferred when configured). If it fails, fall through to
  //    OpenAI rather than killing TTS — a mis-set voice/key shouldn't mute Smarta.
  if (env.elevenLabsApiKey && env.elevenLabsVoiceId) {
    try {
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(env.elevenLabsVoiceId)}`, {
        method: 'POST',
        headers: { 'xi-api-key': env.elevenLabsApiKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
      });
      if (debug) {
        const detail = r.ok ? '(audio ok)' : (await r.text()).slice(0, 500);
        res.status(200).json({
          provider: 'elevenlabs', status: r.status, ok: r.ok, detail,
          keyLen: env.elevenLabsApiKey.length, voiceIdLen: env.elevenLabsVoiceId.length,
          voiceIdPreview: `${env.elevenLabsVoiceId.slice(0, 4)}…${env.elevenLabsVoiceId.slice(-2)}`,
        });
        return;
      }
      if (r.ok) {
        res.setHeader('X-TTS-Provider', 'elevenlabs');
        sendAudio(res, Buffer.from(await r.arrayBuffer()));
        return;
      }
      // non-2xx (bad key/voice/quota) → continue to OpenAI fallback
    } catch (err) {
      if (debug) {
        res.status(200).json({ provider: 'elevenlabs', error: (err instanceof Error ? err.message : String(err)).slice(0, 200) });
        return;
      }
      // network error → continue to OpenAI fallback
    }
  } else if (debug) {
    res.status(200).json({ provider: 'elevenlabs', configured: false, keyPresent: Boolean(env.elevenLabsApiKey), voicePresent: Boolean(env.elevenLabsVoiceId) });
    return;
  }

  // 2) OpenAI TTS fallback.
  try {
    if (!env.openaiApiKey) {
      res.status(204).end(); // no provider → frontend stays text-only
      return;
    }
    const { getOpenAIClient } = await import('../../backend/lib/openaiClient.js');
    const client = getOpenAIClient();
    if (!client) {
      res.status(204).end();
      return;
    }
    const voice =
      typeof body.voice === 'string' && OPENAI_VOICES.includes(body.voice)
        ? body.voice
        : OPENAI_VOICES.includes(env.openaiTtsVoice)
          ? env.openaiTtsVoice
          : 'coral';
    const speech = await client.audio.speech.create({
      model: env.openaiTtsModel,
      voice,
      input: text,
      response_format: 'mp3',
      instructions: 'Hovor po slovensky priateľsky, vrúcne a povzbudivo, prirodzeným ľudským tempom — ako milá a trpezlivá asistentka pre žiakov základnej školy.',
    });
    res.setHeader('X-TTS-Provider', 'openai');
    sendAudio(res, Buffer.from(await speech.arrayBuffer()));
  } catch {
    res.status(502).json({ error: 'TTS zlyhalo.' });
  }
}

function sendAudio(res: VercelResponse, buffer: Buffer): void {
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(buffer);
}

// ---------------------------------------------------------------------------
// Existing: POST /api/ai/validate-submission  (behavior preserved)
// ---------------------------------------------------------------------------
async function handleValidateSubmission(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const ctx = await resolveContext(req);
  const decision = enforceAiRateLimit(ctx, ipHashFromHeader(req.headers['x-forwarded-for']));
  if (!decision.allowed) {
    res.setHeader('Retry-After', String(Math.ceil(decision.retryAfterMs / 1000)));
    res.status(429).json({ error: 'RATE_LIMITED', message: 'Skús to znova o chvíľu.', retryAfterMs: decision.retryAfterMs });
    return;
  }

  // Mode 2: validate an existing submission by ID (requires auth)
  if (body.submissionId) {
    if (!requireAuth(ctx)) {
      res.status(401).json({ error: 'Nie si prihlásený.' });
      return;
    }
    if (typeof body.submissionId !== 'string') {
      res.status(400).json({ error: 'submissionId musí byť reťazec.' });
      return;
    }
    if (missingServerSecrets(getServerEnv()).length > 0) {
      res.status(200).json({ info: 'Supabase nie je nakonfigurované — použite inline mode.', suggestedTeacherReview: true });
      return;
    }
    try {
      const { getSupabaseAdmin } = await import('../../backend/lib/supabaseAdmin.js');
      const admin = getSupabaseAdmin();
      const { data: sub } = await admin
        .from('submissions')
        .select('id, mission_id, response_text, evidence_text, evidence_type')
        .eq('id', body.submissionId)
        .maybeSingle();
      if (!sub) { res.status(404).json({ error: 'Odovzdanie nenájdené.' }); return; }
      const row = sub as Record<string, unknown>;
      const mission = getMissionById(String(row.mission_id));
      const evaluation = await validateSubmissionWithAI(
        { missionId: String(row.mission_id), studentResponse: String(row.response_text), evidenceText: String(row.evidence_text ?? ''), evidenceType: 'text' },
        { rubric: mission?.rubric, targetCompetencies: mission?.targetCompetencies },
      );
      await admin.from('ai_evaluations').upsert({
        submission_id: String(row.id),
        valid: evaluation.valid, score: evaluation.score, confidence: evaluation.confidence,
        reasons: evaluation.reasons, detected_competencies: evaluation.detectedCompetencies,
        suggested_teacher_review: evaluation.suggestedTeacherReview, model: evaluation.model,
      }, { onConflict: 'submission_id' });
      await admin.from('submissions').update({ status: 'ai_reviewed' }).eq('id', String(row.id));
      res.status(200).json({ source: evaluation.source, model: evaluation.model, evaluation });
    } catch {
      res.status(500).json({ error: 'Validácia zlyhala.', suggestedTeacherReview: true });
    }
    return;
  }

  // Mode 1: inline validation (no DB write). Anonymous → force mock.
  const parsed = validateSubmissionInput(body);
  if (!parsed.ok) {
    res.status(400).json({ error: 'Neplatné vstupy.', issues: parsed.issues });
    return;
  }

  try {
    const mission = getMissionById(parsed.value.missionId);
    const evaluation = await validateSubmissionWithAI(
      parsed.value,
      { rubric: mission?.rubric, targetCompetencies: mission?.targetCompetencies },
      { forceMock: ctx.mode === 'anonymous' },
    );
    res.status(200).json({ source: evaluation.source, model: evaluation.model, evaluation });
  } catch {
    res.status(500).json({ error: 'Validácia zlyhala.', suggestedTeacherReview: true });
  }
}
