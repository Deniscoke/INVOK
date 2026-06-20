/**
 * MVP lip-sync via the Web Audio API.
 *
 * Routes a playing <audio> element through an AnalyserNode and, every animation
 * frame, computes its loudness (0..1) and forwards it to a callback (which the
 * avatar maps to mouth opening). Entirely optional — if Web Audio is missing or
 * the graph can't be built, audio still plays normally, the mouth just won't move.
 *
 * Future: replace the single loudness value with per-frequency-band visemes for
 * more accurate mouth shapes — the public surface (onLevel) stays the same.
 */
export interface LipSyncEngine {
  attach: (audio: HTMLAudioElement) => void;
  start: () => void;
  stop: () => void;
}

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

export function createLipSync(onLevel: (level: number) => void): LipSyncEngine {
  let ctx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let data: Uint8Array<ArrayBuffer> | null = null;
  let raf = 0;

  function attach(audio: HTMLAudioElement): void {
    try {
      const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
      const source = ctx.createMediaElementSource(audio);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      data = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      source.connect(analyser);
      analyser.connect(ctx.destination); // keep audio audible
    } catch {
      analyser = null; // lip-sync is best-effort; playback continues regardless
    }
  }

  function tick(): void {
    if (!analyser || !data) return;
    analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i += 1) sum += data[i];
    const avg = sum / data.length / 255; // 0..1
    onLevel(Math.min(1, avg * 2.2));
    raf = requestAnimationFrame(tick);
  }

  function start(): void {
    void ctx?.resume();
    if (analyser) raf = requestAnimationFrame(tick);
  }

  function stop(): void {
    cancelAnimationFrame(raf);
    onLevel(0);
    void ctx?.close().catch(() => undefined);
    ctx = null;
    analyser = null;
    data = null;
  }

  return { attach, start, stop };
}
