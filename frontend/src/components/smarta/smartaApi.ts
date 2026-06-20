/**
 * Smarta API client. Talks to the server-only endpoints — the OpenAI /
 * ElevenLabs keys never reach the browser.
 *
 *   POST /api/ai/smarta-chat  → { reply, source }
 *   POST /api/ai/smarta-tts   → audio/mpeg (or 204/!ok → text-only)
 */
export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatReply {
  reply: string;
  source: 'openai' | 'fallback' | 'error';
}

export async function askSmarta(messages: ChatTurn[]): Promise<ChatReply> {
  try {
    const res = await fetch('/api/ai/smarta-chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    const data = (await res.json().catch(() => null)) as { reply?: string; error?: string; source?: ChatReply['source'] } | null;
    if (!res.ok || !data?.reply) {
      return { reply: data?.error ?? 'Prepáč, niečo sa pokazilo. Skús to znova o chvíľu. 🙂', source: 'error' };
    }
    return { reply: data.reply, source: data.source ?? 'openai' };
  } catch {
    return { reply: 'Vyzerá to, že nie som online. Skontroluj pripojenie a skús to znova.', source: 'error' };
  }
}

/**
 * Fetches speech audio for `text`. Returns an object URL to play, or null when
 * TTS is unavailable/failed (caller keeps the text-only reply). Never throws.
 */
export async function fetchSpeechUrl(text: string): Promise<string | null> {
  try {
    const res = await fetch('/api/ai/smarta-tts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok || res.status === 204) return null;
    const blob = await res.blob();
    if (blob.size === 0) return null;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}
