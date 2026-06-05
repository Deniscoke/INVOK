/**
 * SERVER-ONLY OpenAI client.
 *
 * ⚠️  Uses `OPENAI_API_KEY`. NEVER import this from any file under `frontend/`
 *     — it would leak the key into the browser bundle.
 *
 * The key is never logged, never exported, and never returned to clients.
 */
import OpenAI from 'openai';
import { getServerEnv } from './env';

let cached: OpenAI | null = null;

/** Returns a cached OpenAI client, or null if no API key is configured. */
export function getOpenAIClient(): OpenAI | null {
  const env = getServerEnv();
  if (!env.openaiApiKey) return null;
  if (cached) return cached;
  cached = new OpenAI({ apiKey: env.openaiApiKey });
  return cached;
}
