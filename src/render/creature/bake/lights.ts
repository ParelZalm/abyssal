/**
 * Light organs, side-on: photophores along the belly, Flash Sense's lamps, and a glaring
 * body's embers. Each is a hot pixel plus an emitter the view can hang a bloom on — a lamp
 * a single texel across is only a lamp if light comes off it.
 */
import { photophoreOf, type Genome } from '../../../content/genome';
import { edgeAt, spineAt, R, type Form } from '../../../content/form';
import { tAt } from './body';
import { fbm } from '../../../core/noise';
import { lerp } from '../../../core/util';
import type { Palette, RGB } from './palette';
import type { Sheet } from './sheet';

/** The accent pushed toward white: a photophore is a light, not a paint colour. */
const lamp = (c: RGB): RGB => [lerp(c[0], 255, 0.35), lerp(c[1], 255, 0.35), lerp(c[2], 255, 0.35)];

/**
 * Photophores — the deep ocean's one universal adaptation, and the thing that makes an
 * animal read as deep before anything else about it does. A row along the belly, because
 * counter-illumination only works pointing down; a strong one grows a second row above it.
 * Side-on, these are the dotted lines down a dragonfish that say "midnight" on sight.
 */
export function photophores(s: Sheet, f: Form, pal: Palette, g: Genome, seed: number) {
  const k = photophoreOf(g);
  const c = lamp(pal.accent);
  // spaced in texels, not in t: a row of lights one pixel apart is a stripe, not a row
  const gap = Math.max(s.texel * 3, f.len * R * 0.05 / (0.6 + k));
  const rows = k > 0.6 ? [0.7, 0.3] : [0.7];
  rows.forEach((row, ri) => {
    let i = 0;
    for (let x = spineAt(0.15, f); x > spineAt(0.9, f); x -= gap * (ri ? 1.6 : 1)) {
      const t = tAt(x, f);
      if (fbm(t * 13, ri, seed + 37, 1) < 0.2) continue;
      s.light(x, edgeAt(t, f, row), c, (ri ? 0.3 : 0.5) * Math.min(1.2, k + 0.3) * (i++ % 2 ? 0.8 : 1));
    }
  });
}

/**
 * Flash Sense: the photophores have run up onto the flank — one bright row along the
 * middle, larger than the belly's, because these point outward: they are the flash.
 */
export function flankLights(s: Sheet, f: Form, pal: Palette) {
  const c = lamp(pal.accent);
  for (let i = 0; i < 6; i++) {
    const t = 0.2 + i * 0.12;
    s.light(spineAt(t, f), edgeAt(t, f, -0.05), c, 0.8, true);
  }
}

/**
 * Blood Lamp: the body burns. Three coals down the back in the red the deep takes first, so
 * in dark water the curse is visible from as far as it is felt.
 */
export function embers(s: Sheet, f: Form, seed: number) {
  for (let i = 0; i < 3; i++) {
    const t = 0.3 + i * 0.18 + (fbm(i, 3, seed + 91, 1) - 0.5) * 0.06;
    const x = spineAt(t, f), y = edgeAt(t, f, -0.55);
    s.blot(x, y, s.texel * 1.5, [255, 90, 40], 0.6);
    s.light(x, y, [255, 60, 30], 0.9, true);
  }
}
