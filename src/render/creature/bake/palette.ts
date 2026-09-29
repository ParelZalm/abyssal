/**
 * The colours a body is painted in, from its genome, its menace and its plan's tone.
 *
 * A body is one ramp of six values, outline to rim, hue-shifted the way pixel art shades:
 * the darks lean toward indigo and the lights toward cyan, so a step down the ramp is a
 * change of colour as well as of value. A ramp that only changes lightness reads as grey
 * paint laid over the animal. Everything else on the animal — accent, bone, the inside of
 * the mouth — is a single colour picked against that ramp.
 */
import { fadeOf, type Genome } from '../../../content/genome';
import type { PlanArt } from '../../../content/form';
import { clamp, lerp } from '../../../core/util';

export type RGB = [number, number, number];

export interface Palette {
  ramp: RGB[];
  accent: RGB;
  dark: RGB;
  bone: RGB;
  mouth: RGB;
  filament: RGB;
  /** Pigment against light: 0 lit from above only, 1 a dark back over a pale belly. */
  counter: number;
  /** Speckle amplitude, as a share of the ramp. */
  grain: number;
  alpha: number;
  seed: number;
}

export function rgbOf(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360 / 360;
  s = clamp(s, 0, 1); l = clamp(l, 0, 1);
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
  };
  return [f(0), f(8), f(4)];
}

export const toInt = (c: RGB) => (c[0] << 16) | (c[1] << 8) | c[2];

/** Outline to highlight in `n` steps, the darks shifted one way round the wheel and the lights the other. */
export function ramp(hue: number, sat: number, lo: number, hi: number, n = 6, shift = 24): RGB[] {
  const out: RGB[] = [];
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    // the shift runs toward blue in the shadows whichever side of it the hue sits, so a
    // warm animal still falls into the same cold dark as the water it swims in
    const toward = hue > 60 && hue < 240 ? 1 : -1;
    out.push(rgbOf(hue + shift * (0.5 - k) * 2 * toward, sat * (0.75 + 0.25 * Math.sin(k * Math.PI)),
                   lerp(lo, hi, k ** 1.15)));
  }
  return out;
}

export function palette(g: Genome, men: number, A: PlanArt, seed: number): Palette {
  const t = A.tone;
  // the more dangerous it is, the darker the mass and the hotter its accent
  const hi = (0.74 - men * 0.2) * t;
  const accentHue = lerp(g.accentHue, g.accentHue > 180 ? 22 : 8, men * 0.75);
  return {
    ramp: ramp(g.hue, 0.34 + men * 0.1, 0.035, Math.max(0.2, hi)),
    accent: rgbOf(accentHue, 0.6 + men * 0.3, 0.58),
    dark: rgbOf(g.hue, 0.5, 0.06),
    bone: rgbOf(72, 0.22, 0.78),
    mouth: rgbOf(g.hue - 30, 0.55, 0.09),
    filament: rgbOf(g.hue, 0.3, Math.max(0.3, hi * 0.72)),
    counter: 0.62 * A.shade,
    grain: 0.2 * A.mottle,
    alpha: 1 - Math.min(0.55, fadeOf(g) * 0.6),
    seed,
  };
}
