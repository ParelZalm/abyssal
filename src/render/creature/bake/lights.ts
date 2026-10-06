/**
 * Light organs, side-on: photophores along the belly, Flash Sense's lamps, and a glaring
 * body's embers. Each is a hot pixel plus an emitter the view can hang a bloom on — a lamp
 * a single texel across is only a lamp if light comes off it.
 */
import { photophoreOf, type Genome } from '../../../content/genome';
import { edgeAt, spineAt, R, type Form, type PlanArt } from '../../../content/form';
import { tAt } from './body';
import { fbm } from '../../../core/noise';
import { hash01, lerp } from '../../../core/util';
import { toInt, type Palette, type RGB } from './palette';
import { STANDS, type Sheet } from './sheet';

/** The accent pushed toward white: a photophore is a light, not a paint colour. */
export const lamp = (c: RGB): RGB => [lerp(c[0], 255, 0.35), lerp(c[1], 255, 0.35), lerp(c[2], 255, 0.35)];

/**
 * Photophores — the deep ocean's one universal adaptation, and the thing that makes an
 * animal read as deep before anything else about it does. A row along the belly, because
 * counter-illumination only works pointing down; a strong one grows a second row above it.
 * Side-on, these are the dotted lines down a dragonfish that say "midnight" on sight.
 */
export function photophores(s: Sheet, f: Form, pal: Palette, g: Genome, A: PlanArt, seed: number) {
  const k = photophoreOf(g);
  const c = lamp(pal.accent);
  if (A.sparkle) return sparkle(s, f, c, k, seed);
  // spaced in texels, not in t: a row of lights one pixel apart is a stripe, not a row
  const gap = Math.max(s.texel * 3, f.len * R * 0.05 / (0.6 + k));
  const rows = k > 0.6 ? [0.7, 0.3] : [0.7];
  rows.forEach((row, ri) => {
    let i = 0;
    for (let x = spineAt(0.15, f); x > spineAt(0.9, f); x -= gap * (ri ? 1.6 : 1)) {
      const t = tAt(x, f);
      if (fbm(t * 13, ri, seed + 37, 1) < 0.2) continue;
      // drawn, the lens is the photophore's picture, and the light only hangs its bloom on it
      const y = edgeAt(t, f, row), strength = (ri ? 0.3 : 0.5) * Math.min(1.2, k + 0.3) * (i++ % 2 ? 0.8 : 1);
      if (s.mark('photophore', x, y, { layer: 'skin', least: STANDS })) s.emit(x, y, c, strength);
      else s.light(x, y, c, strength);
    }
  });
}

/**
 * The photophores as a sparkle (`PlanArt.sparkle`): specks over the head and back, thickest
 * up top where the reference's are. Only one in five is an emitter — a bloom per speck is
 * twenty lights on one animal, and the lure has to stay the brightest thing on it.
 */
function sparkle(s: Sheet, f: Form, c: RGB, k: number, seed: number) {
  const n = Math.round(f.len * R * s.res * (0.2 + k * 0.35));
  for (let i = 0; i < n; i++) {
    const t = 0.06 + hash01(seed * 31 + i * 2) * 0.72;
    const up = hash01(seed * 17 + i * 2 + 1);
    const x = spineAt(t, f), y = edgeAt(t, f, -0.9 + up * up * 1.1);
    // the emitters keep the speck's colour: `light`'s white hot pixel is a lamp, and these
    // are a skin catching the light
    s.dot(x, y, c, i % 5 === 0 ? 1 : 0.55 + up * 0.35);
    if (i % 5 === 0) s.lights.push({ x, y, color: toInt(c), strength: 0.15 });
  }
}

/**
 * Flash Sense: the photophores have run up onto the flank — one bright row along the
 * middle, larger than the belly's, because these point outward: they are the flash.
 */
export function flankLights(s: Sheet, f: Form, pal: Palette) {
  const c = lamp(pal.accent);
  for (let i = 0; i < 6; i++) {
    const t = 0.2 + i * 0.12;
    const x = spineAt(t, f), y = edgeAt(t, f, -0.05);
    // drawn, the belly's photophore run up the flank
    if (s.mark('photophore', x, y, { layer: 'skin', least: STANDS })) s.emit(x, y, c, 0.8);
    else s.light(x, y, c, 0.8, true);
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
    if (s.mark('coal', x, y, { layer: 'skin', least: STANDS })) { s.emit(x, y, [255, 60, 30], 0.9); continue; }
    s.blot(x, y, s.texel * 1.5, [255, 90, 40], 0.6);
    s.light(x, y, [255, 60, 30], 0.9, true);
  }
}
