/**
 * Speak a reply and animate Smarta's mouth.
 *
 * Reliability first: the audio element plays DIRECTLY (no Web Audio routing,
 * which would make playback depend on a resumed AudioContext and often go
 * silent under autoplay rules). The mouth is driven by a 60fps requestAnimationFrame
 * oscillator (a couple of sine waves) while the audio plays, so it talks smoothly
 * without flicker on every browser.
 *
 * Fully degradable: if TTS is unavailable or playback is blocked, this resolves
 * quietly — the text reply is always already on screen.
 */
import type { SmartaAvatar } from './avatar';
import { fetchSpeechUrl } from './smartaApi';

const SPEAK_RATE = 1.2; // 20% faster than recorded
const MOUTH_HZ = 5.8; // mouth open/close rate while speaking

let current: HTMLAudioElement | null = null;
let flapRaf = 0;

function stopFlap(): void {
  if (flapRaf) {
    cancelAnimationFrame(flapRaf);
    flapRaf = 0;
  }
}

/** Stop any in-progress speech (e.g. when the user sends a new message / mutes). */
export function stopSpeaking(): void {
  stopFlap();
  if (current) {
    current.pause();
    current.src = '';
    current = null;
  }
}

export async function speak(text: string, avatar: SmartaAvatar): Promise<void> {
  const url = await fetchSpeechUrl(text);
  if (!url) return; // text-only fallback

  stopSpeaking();
  const audio = new Audio(url);
  audio.preload = 'auto';
  audio.playbackRate = SPEAK_RATE; // browsers preserve pitch by default
  current = audio;
  avatar.setSpeaking(true);

  const startFlap = (): void => {
    stopFlap();
    const t0 = performance.now();
    const loop = (now: number): void => {
      const t = (now - t0) / 1000;
      // Two sines → natural, irregular talking (not a rigid blink).
      const v = Math.sin(t * Math.PI * 2 * MOUTH_HZ) + 0.35 * Math.sin(t * Math.PI * 2 * 1.9);
      avatar.setMouthOpen(Math.max(0, Math.min(1, v * 0.85)));
      flapRaf = requestAnimationFrame(loop);
    };
    flapRaf = requestAnimationFrame(loop);
  };

  try {
    await audio.play(); // allowed after the user's send/click interaction
    startFlap();
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
    });
  } catch {
    // Autoplay blocked or playback failed — keep the text reply, skip audio.
  } finally {
    stopFlap();
    avatar.setMouthOpen(0);
    avatar.setSpeaking(false);
    if (current === audio) current = null;
    URL.revokeObjectURL(url);
  }
}
