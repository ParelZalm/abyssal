import type { TankId } from '../content/tanks';
import { audioContext, isMuted } from './sound';
import nursery from './music/nursery.m4a';
import reef from './music/reef.m4a';
import deep from './music/deep.m4a';

/**
 * A track for each tank, looped, crossfaded at a descent. The title borrows the nursery's,
 * since the title sits over the nursery and the first run starts there: Hatch goes on into
 * the same music rather than cutting it.
 *
 * Each track streams from an `<audio>` element routed through the heartbeat's context, so
 * the fades are gain ramps on the audio clock and the mute is one gain. Decoding a track
 * into a buffer would loop without the encoder's gap, but the deep's four minutes would be
 * ~80 MB of samples held for the whole run.
 *
 * The tracks came as 256 kbps mp3s and are shipped as 128 kbps AAC, half the download: the
 * one encoder macOS carries (`afconvert -f m4af -d aac -b 128000 -q 127`) writes AAC, not
 * mp3, and every browser the game runs in plays it.
 */
export type Cue = 'title' | TankId;

const TRACKS: Record<Cue, string> = { title: nursery, nursery, reef, deep };

/** Under the heartbeat, which has to be heard over it. */
const VOLUME = 0.45;
const FADE_OUT = 1.5;
const FADE_IN = 2.5;

interface Voice { el: HTMLAudioElement; gain: GainNode }

const voices = new Map<string, Voice>();
let master: GainNode | null = null;
let playing: string | null = null;
let mutedNow: boolean | null = null;

function voice(ctx: AudioContext, url: string): Voice {
  let v = voices.get(url);
  if (v) return v;
  const el = new Audio(url);
  el.loop = true;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  ctx.createMediaElementSource(el).connect(gain).connect(master!);
  voices.set(url, v = { el, gain });
  return v;
}

function ramp(ctx: AudioContext, g: GainNode, to: number, secs: number) {
  const now = ctx.currentTime;
  g.gain.cancelScheduledValues(now);
  g.gain.setValueAtTime(g.gain.value, now);
  g.gain.linearRampToValueAtTime(to, now + secs);
}

/**
 * The music the game should be playing now; call every frame. Nothing sounds until a gesture
 * has made the context, and a cue whose track is already playing changes nothing.
 */
export function music(cue: Cue) {
  const ctx = audioContext();
  if (!ctx || ctx.state !== 'running') return;
  if (!master) { master = ctx.createGain(); master.connect(ctx.destination); }
  if (isMuted() !== mutedNow) {
    mutedNow = isMuted();
    ramp(ctx, master, mutedNow ? 0 : 1, 0.2);
  }

  const url = TRACKS[cue];
  if (url === playing) return;
  if (playing) {
    const old = voices.get(playing)!;
    ramp(ctx, old.gain, 0, FADE_OUT);
    // paused once silent, unless it was cued again meanwhile
    setTimeout(() => { if (voices.get(playing ?? '') !== old) old.el.pause(); }, FADE_OUT * 1000 + 100);
  }
  playing = url;
  const v = voice(ctx, url);
  v.el.currentTime = 0;
  // the fade starts once the stream does, or a slow load would eat it
  v.el.play().then(() => { if (playing === url) ramp(ctx, v.gain, VOLUME, FADE_IN); }, () => {});
}
