// A short two-note "your turn" chime, synthesized with the Web Audio API
// rather than an audio file — no asset to source/license, and it's a
// handful of lines either way.
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audioContext ??= new Ctor();
  return audioContext;
}

function playTone(ctx: AudioContext, frequency: number, startAt: number, duration: number) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  // Ramp in/out rather than stepping straight to volume — avoids an
  // audible click at the start/end of the tone.
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.25, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration);
}

// Call this from a context that's already had a user gesture on the page
// (clicking to create/join a room counts) — browsers block audio without
// one, and this silently no-ops if playback isn't allowed yet.
export function playTurnChime() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  const now = ctx.currentTime;
  playTone(ctx, 660, now, 0.12);
  playTone(ctx, 880, now + 0.13, 0.18);
}
