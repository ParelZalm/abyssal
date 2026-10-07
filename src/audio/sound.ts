/**
 * The game's one sound effect: a heartbeat for hunger. Synthesised, not sampled — two short
 * low sine thumps, lub and dub — because a warning has to be heard over the music and one
 * voice needs no asset pipeline. The context is made on the first user gesture, since a
 * browser will not start audio before one, and a stored mute outlives the page. The music
 * (`music.ts`) plays through the same context.
 */
const MUTE_KEY = 'abyssal.mute';

let ctx: AudioContext | null = null;
let muted = (() => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } })();

// the loop stops in a hidden tab, so the music would play on over a game that is not moving
addEventListener('visibilitychange', () => {
  if (document.hidden) void ctx?.suspend();
  else void ctx?.resume();
});

/** Call from inside a user gesture; later calls are free. */
export function wakeAudio() {
  if (ctx || typeof AudioContext === 'undefined') { void ctx?.resume(); return; }
  try { ctx = new AudioContext(); } catch { ctx = null; }
}

export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* a convenience */ }
  return muted;
}

export const isMuted = () => muted;

/** The context once a gesture has made it, else null. */
export const audioContext = () => ctx;

function thump(at: number, freq: number, gain: number) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, at);
  // a pitch drop is what makes a sine read as a knock rather than a tone
  osc.frequency.exponentialRampToValueAtTime(freq * 0.55, at + 0.12);
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
  osc.connect(amp).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + 0.18);
}

/** One heartbeat, `urgency` 0..1 making it louder. */
export function heartbeat(urgency: number) {
  if (!ctx || muted || ctx.state !== 'running') return;
  const t = ctx.currentTime + 0.01;
  const g = 0.12 + urgency * 0.18;
  thump(t, 62, g);
  thump(t + 0.17, 54, g * 0.7);
}
