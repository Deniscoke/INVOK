/**
 * Speak a reply and animate Smarta's mouth.
 *
 * Reliability first: we play the audio element DIRECTLY (no Web Audio routing,
 * which would make playback depend on a resumed AudioContext and often go
 * silent under autoplay rules). The mouth is driven by a simple timer while the
 * audio plays — so it visibly "talks" on every browser, even if precise volume
 * analysis isn't available.
 *
 * Fully degradable: if TTS is unavailable or playback is blocked, this resolves
 * quietly — the text reply is always already on screen.
 */
import type { SmartaAvatar } from './avatar';
import { fetchSpeechUrl } from './smartaApi';

let current: HTMLAudioElement | null = null;
let flapTimer = 0;

function stopFlap(): void {
  if (flapTimer) {
    window.clearInterval(flapTimer);
    flapTimer = 0;
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
  current = audio;
  avatar.setSpeaking(true);

  const startFlap = (): void => {
    stopFlap();
    let open = false;
    flapTimer = window.setInterval(() => {
      open = !open;
      // Extreme values so the 2-frame avatar clearly swaps open/closed.
      avatar.setMouthOpen(open ? 0.55 + Math.random() * 0.45 : 0);
    }, 110);
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
