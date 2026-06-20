/**
 * Speak a reply: fetch audio, play it, and drive the avatar's mouth via lip-sync.
 *
 * Fully degradable: if TTS is unavailable, audio is blocked (autoplay), or
 * Web Audio is missing, this resolves quietly — the text reply is always already
 * on screen, so nothing is lost.
 */
import type { SmartaAvatar } from './avatar';
import { createLipSync } from './lipSync';
import { fetchSpeechUrl } from './smartaApi';

let current: HTMLAudioElement | null = null;

/** Stop any in-progress speech (e.g. when the user sends a new message). */
export function stopSpeaking(): void {
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
  current = audio;
  const lip = createLipSync((level) => avatar.setMouthOpen(level));
  lip.attach(audio);
  avatar.setSpeaking(true);

  try {
    await audio.play();
    lip.start();
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
    });
  } catch {
    // Autoplay blocked or playback failed — keep the text reply, skip audio.
  } finally {
    lip.stop();
    avatar.setSpeaking(false);
    if (current === audio) current = null;
    URL.revokeObjectURL(url);
  }
}
