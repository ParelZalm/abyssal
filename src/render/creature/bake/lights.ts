/**
 * Light organs: photophores along the flank, Flash Sense's lamps, and a glaring body's embers.
 */
import { Graphics } from 'pixi.js';
import { photophoreOf, type Genome } from '../../../content/genome';
import { halfWidth, spineAt, R, type Form } from '../../../content/form';
import { fbm, fbmSigned } from '../../../core/noise';
import { hsl } from '../../../core/util';
import type { Palette } from './palette';

/**
 * Photophores — the deep ocean's one universal adaptation, and the thing that makes an
 * animal read as deep before anything else about it does. Two ventral rows, because
 * counter-illumination only works pointing down: the animal lights its own belly to
 * erase the silhouette it would otherwise show to something hunting from below.
 *
 * Drawn after the mottle so the lights sit on the skin rather than under it, and as a
 * soft disc under a hard core — a single flat dot reads as a hole, not a lamp.
 */
export function photophores(gr: Graphics, f: Form, pal: Palette, g: Genome, seed: number) {
  const lit = Math.min(1.5, photophoreOf(g));
  const n = Math.round(10 + lit * 22);
  const scale = 0.7 + lit * 0.5;
  for (let i = 0; i < n; i++) {
    const t = 0.16 + (i / n) * 0.74;
    const w = halfWidth(t, f);
    const x = spineAt(t, f);
    for (const dir of [-1, 1] as const) {
      // the row wanders, because a ruled line of dots reads as machinery
      const y = dir * w * (0.78 + fbmSigned(t * 21, dir * 5.1, seed + 53) * 0.09);
      const r = R * 0.035 * scale;
      gr.circle(x, y, r * 2.4).fill({ color: pal.accent, alpha: 0.16 });
      gr.circle(x, y, r).fill({ color: pal.accent, alpha: 0.85 });
      gr.circle(x, y, r * 0.45).fill({ color: 0xffffff, alpha: 0.7 });
    }
  }
}

/**
 * Flash Sense: the photophores have run up onto the flank. One bright row along each side,
 * larger than the belly's and set wide, because these point outward — they are the flash,
 * not the counter-illumination — and a row at the very edge of the silhouette is what makes
 * the whole outline light when it fires.
 */
export function flankLights(gr: Graphics, f: Form, pal: Palette) {
  const n = 12;
  for (let i = 0; i < n; i++) {
    const t = 0.14 + (i / (n - 1)) * 0.66;
    const w = halfWidth(t, f);
    const x = spineAt(t, f);
    const r = R * 0.05 * (1 - Math.abs(t - 0.45) * 0.8);
    for (const dir of [-1, 1] as const) {
      const y = dir * w * 0.93;
      gr.circle(x, y, r * 2.6).fill({ color: 0xe8fbff, alpha: 0.14 });
      gr.circle(x, y, r).fill({ color: 0xe8fbff, alpha: 0.9 });
    }
  }
}

/**
 * Blood Lamp: the body burns. Three coals down the back, each a hot core in a wide soft
 * halo, in the red that the deep takes first — so in dark water the curse is visible from
 * as far as it is felt, which is the point of drawing it.
 */
export function embers(gr: Graphics, f: Form, seed: number) {
  const hot = hsl(8, 0.95, 0.55), core = hsl(34, 1, 0.72);
  for (let i = 0; i < 3; i++) {
    const t = 0.3 + i * 0.17 + (fbm(i * 5.3, 1, seed + 241) - 0.5) * 0.04;
    const w = halfWidth(t, f);
    const x = spineAt(t, f);
    gr.circle(x, 0, w * 0.9).fill({ color: hot, alpha: 0.16 });
    gr.circle(x, 0, w * 0.5).fill({ color: hot, alpha: 0.5 });
    gr.circle(x, 0, w * 0.22).fill({ color: core, alpha: 0.95 });
  }
}
