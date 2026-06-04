/**
 * SERVER-ONLY Anthropic client.
 *
 * ⚠️  Uses `ANTHROPIC_API_KEY`. NEVER import this from any file under
 *     `frontend/` — it would leak the key into the browser bundle.
 *
 * The key is never logged, never exported, and never returned to clients.
 */
import Anthropic from '@anthropic-ai/sdk';
import { getServerEnv } from './env';

let cached: Anthropic | null = null;

/** Returns a cached Anthropic client, or null if no API key is configured. */
export function getAnthropicClient(): Anthropic | null {
  const env = getServerEnv();
  if (!env.anthropicApiKey) return null;
  if (cached) return cached;
  cached = new Anthropic({ apiKey: env.anthropicApiKey });
  return cached;
}
